import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStats } from '@/lib/ai-agent/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const siteId = new URL(req.url).searchParams.get('siteId') ?? undefined;
  return NextResponse.json({ stats: getStats(siteId) });
}
