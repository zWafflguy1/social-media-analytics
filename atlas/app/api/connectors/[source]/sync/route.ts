import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/connectors/runtime";
import { resolveTenant, TenantError } from "@/lib/tenancy";
import "@/connectors";

export const runtime = "nodejs";
export const maxDuration = 300;

// Universal sync endpoint for pull connectors. Trigger from a cron/scheduler.
// Auth: the ingest secret (server-to-server), plus tenant header.
export async function POST(
  req: NextRequest,
  { params }: { params: { source: string } }
) {
  const secret = req.headers.get("x-atlas-ingest-secret");
  if (!secret || secret !== process.env.ATLAS_INGEST_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let tenantId: string;
  try {
    tenantId = await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const outcome = await runSync(tenantId, params.source);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
