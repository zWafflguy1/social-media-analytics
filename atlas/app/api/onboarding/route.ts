import { NextRequest, NextResponse } from "next/server";
import { onboardingBrief } from "@/lib/agents/onboarding";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST — generate a role-specific onboarding brief: { role, focus? }
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { role, focus } = (await req.json().catch(() => ({}))) as {
    role?: string;
    focus?: string;
  };
  if (!role?.trim()) {
    return NextResponse.json({ error: "role is required" }, { status: 422 });
  }
  const result = await onboardingBrief(tenantId, role.trim(), focus);
  return NextResponse.json(result);
}
