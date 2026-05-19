import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getSite,
  updateSite,
  deleteSite,
  rotateSiteKey,
} from '@/lib/ai-agent/store';
import type { AgentSiteConfig } from '@/lib/ai-agent/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireSession() {
  return getServerSession(authOptions);
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const site = getSite(ctx.params.id);
  if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ site });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let patch: Partial<AgentSiteConfig> = {};
  try {
    patch = (await req.json()) as Partial<AgentSiteConfig>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Special action: rotate site key
  if ((patch as Record<string, unknown>).action === 'rotateKey') {
    const rotated = rotateSiteKey(ctx.params.id);
    if (!rotated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ site: rotated });
  }

  const updated = updateSite(ctx.params.id, patch);
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ site: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ok = deleteSite(ctx.params.id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
