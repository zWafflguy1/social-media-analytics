import { NextRequest, NextResponse } from "next/server";
import { generateBrief } from "@/lib/agents/recommender";
import { query } from "@/lib/db";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";
export const maxDuration = 120;

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// GET — list recent briefs.
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const rows = await query(
    `SELECT id, kind, period, content, created_at FROM briefs
      WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [tenantId]
  );
  return NextResponse.json({ briefs: rows });
}

// POST — generate a new brief: { kind: "weekly" | "quarterly" }.
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { kind = "weekly" } = (await req.json().catch(() => ({}))) as {
    kind?: "weekly" | "quarterly";
  };
  const result = await generateBrief(tenantId, kind);
  return NextResponse.json(result);
}
