import { NextRequest, NextResponse } from "next/server";
import { receiveWebhook } from "@/connectors/runtime";
import { resolveTenant, TenantError } from "@/lib/tenancy";
import "@/connectors"; // ensure connectors are registered

export const runtime = "nodejs";

// Universal webhook endpoint. Any registered push connector is reachable at
// /api/connectors/<source>/webhook — no per-source route needed.
// The connector's own verify() (HMAC/token) authenticates the payload.
export async function POST(
  req: NextRequest,
  { params }: { params: { source: string } }
) {
  let tenantId: string;
  try {
    tenantId = await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  // Read the exact bytes — connectors need the raw body for signature checks.
  const rawBody = await req.text();
  const outcome = await receiveWebhook(tenantId, params.source, rawBody, req.headers);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
