import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSite, listSites } from '@/lib/ai-agent/store';
import type { AgentSiteConfig } from '@/lib/ai-agent/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireSession() {
  const session = await getServerSession(authOptions);
  return session;
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ sites: listSites() });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Partial<AgentSiteConfig> = {};
  try {
    body = (await req.json()) as Partial<AgentSiteConfig>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.brandName || !body.domain) {
    return NextResponse.json(
      { error: 'missing_fields', message: 'brandName and domain are required' },
      { status: 400 }
    );
  }

  const site = createSite(body);
  return NextResponse.json({ site }, { status: 201 });
}
