import { nanoid } from "nanoid";
import { complete } from "../anthropic";
import { query } from "../db";
import { audit } from "../audit";

interface BriefInputs {
  recentSummaries: string[];
  openActionItems: string[];
  metricDeltas: { name: string; domain: string; latest: number; prior: number | null }[];
  proposedDecisions: { title: string }[];
}

async function gatherInputs(tenantId: string, sinceDays: number): Promise<BriefInputs> {
  const recent = await query<{ summary: string }>(
    `SELECT en.summary
       FROM enrichments en JOIN events e ON e.id = en.event_id
      WHERE en.tenant_id=$1 AND e.occurred_at > now() - ($2 || ' days')::interval
      ORDER BY e.occurred_at DESC LIMIT 60`,
    [tenantId, sinceDays]
  );

  const actionItems = await query<{ items: string[] }>(
    `SELECT action_items AS items FROM enrichments
      WHERE tenant_id=$1 AND created_at > now() - ($2 || ' days')::interval
      LIMIT 100`,
    [tenantId, sinceDays]
  );

  // Latest vs prior value per metric — the efficiency deltas.
  const metricDeltas = await query<{
    name: string; domain: string; latest: number; prior: number | null;
  }>(
    `WITH ranked AS (
       SELECT name, domain, value,
              ROW_NUMBER() OVER (PARTITION BY name ORDER BY captured_at DESC) AS rn
         FROM metrics WHERE tenant_id=$1
     )
     SELECT a.name, a.domain, a.value AS latest, b.value AS prior
       FROM ranked a LEFT JOIN ranked b ON a.name=b.name AND b.rn=2
      WHERE a.rn=1`,
    [tenantId]
  );

  const decisions = await query<{ title: string }>(
    `SELECT title FROM decisions
      WHERE tenant_id=$1 AND status='proposed' ORDER BY decided_at DESC LIMIT 20`,
    [tenantId]
  );

  return {
    recentSummaries: recent.map((r) => r.summary),
    openActionItems: actionItems.flatMap((r) => r.items ?? []).slice(0, 80),
    metricDeltas,
    proposedDecisions: decisions,
  };
}

const SYSTEM = `You are Atlas, an executive analyst. From the business's recent
activity, produce a concise, high-signal brief in Markdown with these sections:
## Wins  ## Risks  ## Efficiency & Tendencies  ## Recommendations
Recommendations must be ranked by estimated impact and each must reference the
evidence it's based on. Be specific and actionable. Do not pad. If data is thin,
say what to start capturing.`;

/** Generate and persist a weekly or quarterly brief. */
export async function generateBrief(
  tenantId: string,
  kind: "weekly" | "quarterly"
): Promise<{ id: string; content: string }> {
  const sinceDays = kind === "weekly" ? 7 : 92;
  const inputs = await gatherInputs(tenantId, sinceDays);

  const prompt = `Period: last ${sinceDays} days (${kind} brief)

RECENT ACTIVITY (summaries):
${inputs.recentSummaries.map((s) => `- ${s}`).join("\n") || "(none)"}

OPEN ACTION ITEMS:
${inputs.openActionItems.map((s) => `- ${s}`).join("\n") || "(none)"}

METRIC MOVEMENT (latest vs prior):
${
    inputs.metricDeltas
      .map((m) => `- ${m.domain}/${m.name}: ${m.prior ?? "—"} → ${m.latest}`)
      .join("\n") || "(no metrics captured)"
  }

DECISIONS AWAITING CONFIRMATION:
${inputs.proposedDecisions.map((d) => `- ${d.title}`).join("\n") || "(none)"}`;

  const content = await complete(prompt, {
    tier: "heavy", // briefs are where deep reasoning pays off
    system: SYSTEM,
    cacheSystem: true,
    maxTokens: 2500,
  });

  const id = `brf_${nanoid(12)}`;
  const period =
    kind === "weekly"
      ? new Date().toISOString().slice(0, 10)
      : `Q${Math.floor(new Date().getMonth() / 3) + 1}-${new Date().getFullYear()}`;

  await query(
    `INSERT INTO briefs (id, tenant_id, kind, period, content) VALUES ($1,$2,$3,$4,$5)`,
    [id, tenantId, kind, period, content]
  );
  await audit(tenantId, "agent", "brief.generated", id, { kind, period });

  return { id, content };
}
