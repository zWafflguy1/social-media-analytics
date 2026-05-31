import { NextRequest, NextResponse } from "next/server";
import { enrichPending } from "@/lib/enrich/pipeline";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST — drain pending events through the enrichment pipeline. Call from a cron
// (Vercel Cron / Inngest) or a background worker. Auth: ingest secret.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-atlas-ingest-secret");
  if (!secret || secret !== process.env.ATLAS_INGEST_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Tenant header is optional here; the pipeline drains globally by oldest-first.
  try {
    await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) {
      /* allowed: global drain */
    } else throw e;
  }
  const processed = await enrichPending(50);
  return NextResponse.json({ processed });
}
