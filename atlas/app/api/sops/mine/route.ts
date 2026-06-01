import { NextRequest, NextResponse } from "next/server";
import { mineSOPs } from "@/lib/agents/sop-miner";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST — mine SOPs from observed work. { role? } scopes the analysis.
// Produces 'proposed' SOPs for a human to confirm on the Workforce screen.
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { role } = (await req.json().catch(() => ({}))) as { role?: string };
  const created = await mineSOPs(tenantId, role);
  return NextResponse.json({ ok: true, proposed: created });
}
