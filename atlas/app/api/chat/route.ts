import { NextRequest, NextResponse } from "next/server";
import { ask } from "@/lib/agents/analyst";
import { resolveTenant, TenantError } from "@/lib/tenancy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await resolveTenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 422 });
  }

  const result = await ask(tenantId, question.trim());
  return NextResponse.json(result);
}
