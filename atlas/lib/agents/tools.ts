import { nanoid } from "nanoid";
import { query } from "../db";
import { audit } from "../audit";
import { autonomyCeiling } from "../tenancy";

// Permission tiers — the leash. Every tool declares the minimum tier it needs.
//   0 read-only · 1 draft/propose · 2 act-with-approval · 3 autonomous
export type Tier = 0 | 1 | 2 | 3;

export interface ToolDef {
  name: string;
  description: string;
  tier: Tier;
  // The actual side-effect. In this foundation, integrations are stubbed to log
  // their intent; wiring a real connector means implementing execute().
  execute: (tenantId: string, args: Record<string, unknown>) => Promise<unknown>;
}

export const TOOLS: Record<string, ToolDef> = {
  draft_reply: {
    name: "draft_reply",
    description: "Draft a reply to an email or message. Produces text only — never sends.",
    tier: 1,
    execute: async (_t, args) => ({ draft: args.body ?? "" }),
  },
  flag_risk: {
    name: "flag_risk",
    description: "Flag an account/deal as at-risk for human attention.",
    tier: 1,
    execute: async (_t, args) => ({ flagged: args.target, reason: args.reason }),
  },
  log_decision: {
    name: "log_decision",
    description: "Record a confirmed business decision in the decision log.",
    tier: 2,
    execute: async (tenantId, args) => {
      const id = `dec_${nanoid(12)}`;
      await query(
        `INSERT INTO decisions (id, tenant_id, title, rationale, status, confidence)
         VALUES ($1,$2,$3,$4,'confirmed',1)`,
        [id, tenantId, String(args.title), (args.rationale as string) ?? null]
      );
      return { decision_id: id };
    },
  },
  update_crm: {
    name: "update_crm",
    description: "Update a CRM record (deal stage, contact field).",
    tier: 2,
    execute: async (_t, args) => ({ updated: args }), // stub: wire HubSpot/SF here
  },
  schedule_meeting: {
    name: "schedule_meeting",
    description: "Create a calendar event with attendees.",
    tier: 2,
    execute: async (_t, args) => ({ scheduled: args }), // stub: wire Google/MS here
  },
  send_email: {
    name: "send_email",
    description: "Actually send an email. Highest blast radius.",
    tier: 3,
    execute: async (_t, args) => ({ sent: args }), // stub: wire Gmail/MS here
  },
};

export interface ProposeInput {
  tool: string;
  args: Record<string, unknown>;
  rationale?: string;
  evidence?: string[]; // event ids
  proposedBy?: string;
}

export interface ProposeResult {
  actionId: string;
  status: "executed" | "pending_approval";
  result?: unknown;
}

/**
 * The gate every AI action passes through. If the tool's tier is at or below
 * the tenant's autonomy ceiling, it executes immediately and is logged.
 * Otherwise it is queued to the approval inbox for a human.
 */
export async function proposeAction(
  tenantId: string,
  input: ProposeInput
): Promise<ProposeResult> {
  const tool = TOOLS[input.tool];
  if (!tool) throw new Error(`unknown tool: ${input.tool}`);

  const ceiling = await autonomyCeiling(tenantId);
  const actionId = `act_${nanoid(14)}`;
  const autoExecute = tool.tier <= ceiling;

  await query(
    `INSERT INTO actions
       (id, tenant_id, tool, tier, args, rationale, evidence, status, proposed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      actionId,
      tenantId,
      tool.name,
      tool.tier,
      JSON.stringify(input.args),
      input.rationale ?? null,
      JSON.stringify(input.evidence ?? []),
      autoExecute ? "approved" : "proposed",
      input.proposedBy ?? "agent",
    ]
  );

  if (!autoExecute) {
    await audit(tenantId, "agent", "action.proposed", actionId, {
      tool: tool.name,
      tier: tool.tier,
    });
    return { actionId, status: "pending_approval" };
  }

  return { actionId, status: "executed", result: await executeAction(tenantId, actionId) };
}

/** Run an approved action and record the result. Used by auto-exec and the approval inbox. */
export async function executeAction(tenantId: string, actionId: string): Promise<unknown> {
  const rows = await query<{ tool: string; args: any }>(
    `SELECT tool, args FROM actions WHERE id=$1 AND tenant_id=$2 AND status IN ('approved')`,
    [actionId, tenantId]
  );
  const row = rows[0];
  if (!row) throw new Error("action not approved or not found");
  const tool = TOOLS[row.tool];

  try {
    const result = await tool.execute(tenantId, row.args);
    await query(
      `UPDATE actions SET status='executed', result=$2, resolved_at=now() WHERE id=$1`,
      [actionId, JSON.stringify(result)]
    );
    await audit(tenantId, "agent", "action.executed", actionId, { tool: row.tool });
    return result;
  } catch (err) {
    await query(`UPDATE actions SET status='failed', resolved_at=now() WHERE id=$1`, [actionId]);
    await audit(tenantId, "agent", "action.failed", actionId, {
      error: (err as Error).message,
    });
    throw err;
  }
}
