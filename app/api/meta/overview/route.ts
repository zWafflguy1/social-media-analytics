import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMetaOverview } from '@/lib/meta';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.metaAccessToken) {
    return NextResponse.json({ error: 'Not authenticated with Meta' }, { status: 401 });
  }

  const preset = req.nextUrl.searchParams.get('preset') ?? '30d';

  try {
    const data = await getMetaOverview(session.metaAccessToken, preset);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Meta overview error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
