import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// GET — roster with enrollment + consent status.
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const rows = await query(
    `SELECT e.id, e.name, e.email, e.role, e.team, e.enrolled, e.consent_at, e.consent_method,
            COUNT(d.id)::int AS device_count
       FROM employees e LEFT JOIN devices d ON d.employee_id = e.id AND d.status='active'
      WHERE e.tenant_id=$1 GROUP BY e.id ORDER BY e.name`,
    [tenantId]
  );
  return NextResponse.json({ employees: rows });
}

// POST — add an employee, or update enrollment/consent.
//   create:  { name, email?, role?, team? }
//   update:  { id, enrolled?, consent?: true, consent_method? }
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const b = (await req.json().catch(() => ({}))) as any;

  if (b.id) {
    // Update enrollment / consent. Recording consent is an explicit, audited act.
    await query(
      `UPDATE employees SET
         enrolled = COALESCE($3, enrolled),
         consent_at = CASE WHEN $4 = true THEN now() ELSE consent_at END,
         consent_method = COALESCE($5, consent_method)
       WHERE tenant_id=$1 AND id=$2`,
      [tenantId, b.id, b.enrolled ?? null, b.consent === true, b.consent_method ?? null]
    );
    await audit(tenantId, "user", "employee.updated", b.id, {
      enrolled: b.enrolled,
      consent: b.consent === true,
    });
    return NextResponse.json({ ok: true, id: b.id });
  }

  if (!b.name) return NextResponse.json({ error: "name is required" }, { status: 422 });
  const id = `emp_${nanoid(12)}`;
  await query(
    `INSERT INTO employees (id, tenant_id, name, email, role, team)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, tenantId, b.name, b.email ?? null, b.role ?? null, b.team ?? null]
  );
  await audit(tenantId, "user", "employee.added", id, { name: b.name });
  return NextResponse.json({ ok: true, id });
}
