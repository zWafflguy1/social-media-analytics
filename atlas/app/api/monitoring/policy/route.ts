import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getPolicy } from "@/lib/monitoring/policy";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// GET — the active monitoring policy (privacy-protective defaults if unset).
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json(await getPolicy(tenantId));
}

// PUT — update the monitoring policy.
export async function PUT(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const b = (await req.json().catch(() => ({}))) as any;
  await query(
    `INSERT INTO monitoring_policies
       (tenant_id, capture_content, captured_categories, excluded_apps,
        excluded_categories, active_hours, retention_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (tenant_id) DO UPDATE SET
       capture_content=EXCLUDED.capture_content,
       captured_categories=EXCLUDED.captured_categories,
       excluded_apps=EXCLUDED.excluded_apps,
       excluded_categories=EXCLUDED.excluded_categories,
       active_hours=EXCLUDED.active_hours,
       retention_days=EXCLUDED.retention_days,
       updated_at=now()`,
    [
      tenantId,
      Boolean(b.capture_content),
      b.captured_categories ?? [],
      b.excluded_apps ?? [],
      b.excluded_categories ?? ["personal", "banking", "health", "personal_messaging"],
      b.active_hours ?? null,
      Number(b.retention_days ?? 90),
    ]
  );
  await audit(tenantId, "user", "monitoring.policy_updated", undefined, {
    capture_content: Boolean(b.capture_content),
  });
  return NextResponse.json({ ok: true });
}
