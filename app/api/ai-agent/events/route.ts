import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listEvents } from '@/lib/ai-agent/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const siteId = url.searchParams.get('siteId') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? '100');
  return NextResponse.json({
    events: listEvents({ siteId, limit: Number.isFinite(limit) ? limit : 100 }),
  });
}
