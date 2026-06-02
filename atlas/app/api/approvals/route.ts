import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { executeAction } from "@/lib/agents/tools";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// GET — the approval inbox: actions awaiting a human.
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const rows = await query(
    `SELECT id, tool, tier, args, rationale, evidence, status, created_at
       FROM actions WHERE tenant_id=$1 AND status='proposed'
      ORDER BY created_at ASC`,
    [tenantId]
  );
  return NextResponse.json({ pending: rows });
}

// POST — approve or reject: { actionId, decision: "approve" | "reject", reviewer? }
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { actionId, decision, reviewer } = (await req.json().catch(() => ({}))) as {
    actionId?: string;
    decision?: "approve" | "reject";
    reviewer?: string;
  };
  if (!actionId || !decision) {
    return NextResponse.json({ error: "actionId and decision are required" }, { status: 422 });
  }

  if (decision === "reject") {
    await query(
      `UPDATE actions SET status='rejected', reviewed_by=$2, resolved_at=now()
        WHERE id=$1 AND tenant_id=$3 AND status='proposed'`,
      [actionId, reviewer ?? "user", tenantId]
    );
    // Rejections are the training signal — captured in the audit log.
    await audit(tenantId, `user:${reviewer ?? "?"}`, "action.rejected", actionId);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Approve → mark approved, then execute.
  const updated = await query(
    `UPDATE actions SET status='approved', reviewed_by=$2
      WHERE id=$1 AND tenant_id=$3 AND status='proposed' RETURNING id`,
    [actionId, reviewer ?? "user", tenantId]
  );
  if (!updated.length) {
    return NextResponse.json({ error: "action not found or already resolved" }, { status: 404 });
  }
  const result = await executeAction(tenantId, actionId);
  return NextResponse.json({ ok: true, status: "executed", result });
}
