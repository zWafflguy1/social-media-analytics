import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { resolveTenant, TenantError } from "@/lib/tenancy";
import { runSync } from "@/connectors/runtime";
import "@/connectors";

export const runtime = "nodejs";
export const maxDuration = 120;

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// POST — "Sync now" from the UI. Session-authenticated (a user triggering their
// own tenant's pull), unlike the cron route which uses the ingest secret.
export async function POST(
  req: NextRequest,
  { params }: { params: { source: string } }
) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const outcome = await runSync(tenantId, params.source);
  return NextResponse.json(outcome.body, { status: outcome.status });
}

// PATCH — toggle enabled (pause/resume a data input): { enabled: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { source: string } }
) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 422 });
  }
  const updated = await query(
    `UPDATE connector_accounts SET enabled=$3, updated_at=now()
      WHERE tenant_id=$1 AND source=$2 RETURNING source`,
    [tenantId, params.source, enabled]
  );
  if (!updated.length) {
    return NextResponse.json({ error: "connection not found" }, { status: 404 });
  }
  await audit(tenantId, "user", enabled ? "connector.enabled" : "connector.disabled", params.source);
  return NextResponse.json({ ok: true, source: params.source, enabled });
}

// DELETE — disconnect a source (removes config/secrets; ingested events remain).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { source: string } }
) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  await query(`DELETE FROM connector_accounts WHERE tenant_id=$1 AND source=$2`, [
    tenantId,
    params.source,
  ]);
  await query(`DELETE FROM connector_sync_state WHERE tenant_id=$1 AND source=$2`, [
    tenantId,
    params.source,
  ]);
  await audit(tenantId, "user", "connector.disconnected", params.source);
  return NextResponse.json({ ok: true, source: params.source });
}
