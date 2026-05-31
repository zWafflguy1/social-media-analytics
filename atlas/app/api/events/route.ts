import { NextRequest, NextResponse } from "next/server";
import { EventInputSchema } from "@/lib/events/schema";
import { ingestEvent } from "@/lib/events/ingest";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

// Connectors POST normalized events here. Auth: shared ingest secret.
export async function POST(req: NextRequest) {
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

  const json = await req.json().catch(() => null);
  const parsed = EventInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid event", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const result = await ingestEvent(tenantId, parsed.data, parsed.data.source);
  const code = result.status === "rejected" ? 422 : 202;
  return NextResponse.json(result, { status: code });
}
