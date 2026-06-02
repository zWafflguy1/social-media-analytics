import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// GET — the decision log (most recent first).
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const rows = await query(
    `SELECT id, title, rationale, decided_by, decided_at, status, confidence, source_event
       FROM decisions WHERE tenant_id=$1 ORDER BY decided_at DESC LIMIT 100`,
    [tenantId]
  );
  return NextResponse.json({ decisions: rows });
}

// POST — log a new decision, or confirm a proposed one.
//   { title, rationale?, alternatives?, decided_by? }  -> create confirmed
//   { confirm: "<decision_id>" }                        -> confirm proposed
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const body = (await req.json().catch(() => ({}))) as any;

  if (body.confirm) {
    await query(
      `UPDATE decisions SET status='confirmed', confidence=1 WHERE id=$1 AND tenant_id=$2`,
      [body.confirm, tenantId]
    );
    await audit(tenantId, "user", "decision.confirmed", body.confirm);
    return NextResponse.json({ ok: true, id: body.confirm });
  }

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 422 });
  }
  const id = `dec_${nanoid(12)}`;
  await query(
    `INSERT INTO decisions (id, tenant_id, title, rationale, alternatives, decided_by, status, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,'confirmed',1)`,
    [id, tenantId, body.title, body.rationale ?? null, body.alternatives ?? null, body.decided_by ?? null]
  );
  await audit(tenantId, "user", "decision.logged", id);
  return NextResponse.json({ ok: true, id });
}
