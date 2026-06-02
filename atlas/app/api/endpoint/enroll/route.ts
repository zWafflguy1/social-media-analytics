import { NextRequest, NextResponse } from "next/server";
import { enrollDevice } from "@/lib/monitoring/devices";
import { queryOne } from "@/lib/db";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

// POST — enroll a work computer for an employee (admin, session-authed).
//   { employeeId, label }  → returns { deviceId, agentKey } (agentKey shown ONCE)
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { employeeId, label } = (await req.json().catch(() => ({}))) as {
    employeeId?: string;
    label?: string;
  };
  if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 422 });

  // Guard: only enroll devices for employees who have consented.
  const emp = await queryOne<{ consent_at: string | null }>(
    `SELECT consent_at FROM employees WHERE id=$1 AND tenant_id=$2`,
    [employeeId, tenantId]
  );
  if (!emp) return NextResponse.json({ error: "employee not found" }, { status: 404 });
  if (!emp.consent_at) {
    return NextResponse.json(
      { error: "employee has not consented to monitoring; record consent first" },
      { status: 409 }
    );
  }

  const result = await enrollDevice(tenantId, employeeId, label ?? "Work computer");
  return NextResponse.json({
    ...result,
    note: "Store agentKey in the desktop agent now — it is not shown again.",
  });
}
