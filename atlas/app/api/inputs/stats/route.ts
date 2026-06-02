import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

// Capture overview — "what data are we actually collecting?" Powers the
// summary on the Data Inputs screen.
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const totals = await queryOne<{ total: number; enriched: number; pending: number; last_event_at: string | null }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status='enriched')::int AS enriched,
            COUNT(*) FILTER (WHERE status='pending')::int AS pending,
            MAX(occurred_at) AS last_event_at
       FROM events WHERE tenant_id=$1`,
    [tenantId]
  );

  const bySource = await query(
    `SELECT source, COUNT(*)::int AS count FROM events
      WHERE tenant_id=$1 GROUP BY source ORDER BY count DESC`,
    [tenantId]
  );
  const byType = await query(
    `SELECT type, COUNT(*)::int AS count FROM events
      WHERE tenant_id=$1 GROUP BY type ORDER BY count DESC LIMIT 20`,
    [tenantId]
  );
  const bySensitivity = await query(
    `SELECT sensitivity, COUNT(*)::int AS count FROM events
      WHERE tenant_id=$1 GROUP BY sensitivity ORDER BY count DESC`,
    [tenantId]
  );

  return NextResponse.json({
    totals: totals ?? { total: 0, enriched: 0, pending: 0, last_event_at: null },
    by_source: bySource,
    by_type: byType,
    by_sensitivity: bySensitivity,
  });
}
