import { NextRequest, NextResponse } from 'next/server';
import { detectAiBot, inferIntent } from '@/lib/ai-agent/detector';
import { getSiteByKey, logEvent } from '@/lib/ai-agent/store';
import { buildAgentResponse } from '@/lib/ai-agent/optimizer';
import { PUBLIC_CORS_HEADERS, withCors } from '@/lib/ai-agent/cors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}

// POST /api/ai-agent/query
// Body: { siteKey: string, query: string }
// Designed for AI agents that want to ask the site directly, the way a user
// would. We respond with a structured answer + citations + JSON-LD.
export async function POST(req: NextRequest) {
  let body: { siteKey?: string; query?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new NextResponse(
      JSON.stringify({ error: 'invalid_json' }),
      withCors({ status: 400, headers: { 'Content-Type': 'application/json' } })
    );
  }
  const siteKey = body.siteKey ?? req.headers.get('x-site-key') ?? undefined;
  const query = (body.query ?? '').trim();

  if (!siteKey) {
    return new NextResponse(
      JSON.stringify({ error: 'missing_site_key' }),
      withCors({ status: 400, headers: { 'Content-Type': 'application/json' } })
    );
  }
  if (!query) {
    return new NextResponse(
      JSON.stringify({ error: 'missing_query' }),
      withCors({ status: 400, headers: { 'Content-Type': 'application/json' } })
    );
  }

  const site = getSiteByKey(siteKey);
  if (!site) {
    return new NextResponse(
      JSON.stringify({ error: 'unknown_site' }),
      withCors({ status: 404, headers: { 'Content-Type': 'application/json' } })
    );
  }

  const bot = detectAiBot(req.headers.get('user-agent'));
  const intent = inferIntent(query, site.keywords);
  const payload = buildAgentResponse(site, {
    query,
    intent: intent?.intent,
    matchedKeywords: intent?.matchedKeywords,
    bot,
  });

  const serialized = JSON.stringify(payload);
  logEvent({
    siteId: site.id,
    siteKey: site.siteKey,
    bot,
    path: '/api/ai-agent/query',
    query,
    intent: intent?.intent,
    outcome: 'engaged',
    responseBytes: serialized.length,
  });

  return new NextResponse(serialized, withCors({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}
