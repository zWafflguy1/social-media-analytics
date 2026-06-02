import { NextRequest, NextResponse } from "next/server";
import { listSOPs, createSOP, setSOPStatus } from "@/lib/sops/store";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// GET — the SOP library (optionally filtered by ?role=).
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const role = req.nextUrl.searchParams.get("role") ?? undefined;
  return NextResponse.json({ sops: await listSOPs(tenantId, role) });
}

// POST — author a SOP, or change a SOP's status.
//   create: { title, role?, steps[], rationale? }
//   status: { id, status: "active" | "archived" | "proposed" }   (e.g. confirm a mined SOP)
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const b = (await req.json().catch(() => ({}))) as any;

  if (b.id && b.status) {
    await setSOPStatus(tenantId, b.id, b.status);
    return NextResponse.json({ ok: true, id: b.id, status: b.status });
  }
  if (!b.title || !Array.isArray(b.steps)) {
    return NextResponse.json({ error: "title and steps[] are required" }, { status: 422 });
  }
  const id = await createSOP(tenantId, {
    title: b.title,
    role: b.role,
    steps: b.steps,
    rationale: b.rationale,
    source: "authored",
  });
  return NextResponse.json({ ok: true, id });
}
