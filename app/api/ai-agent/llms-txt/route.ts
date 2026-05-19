import { NextRequest, NextResponse } from 'next/server';
import { getSiteByKey, getSiteByDomain, logEvent } from '@/lib/ai-agent/store';
import { buildLlmsTxt } from '@/lib/ai-agent/optimizer';
import { detectAiBot } from '@/lib/ai-agent/detector';
import { PUBLIC_CORS_HEADERS, withCors } from '@/lib/ai-agent/cors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}

// GET /api/ai-agent/llms-txt?siteKey=... (or ?domain=...)
// Returns a markdown llms.txt-format document. Client sites can either:
//   1. Proxy this URL from /llms.txt on their own domain, or
//   2. Mirror the content statically and refresh on changes.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const siteKey = url.searchParams.get('siteKey') ?? req.headers.get('x-site-key') ?? undefined;
  const domain = url.searchParams.get('domain') ?? undefined;
  const site = siteKey ? getSiteByKey(siteKey) : domain ? getSiteByDomain(domain) : undefined;

  if (!site) {
    return new NextResponse('# Site not found\n', withCors({
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    }));
  }

  const bot = detectAiBot(req.headers.get('user-agent'));
  const content = buildLlmsTxt(site);

  logEvent({
    siteId: site.id,
    siteKey: site.siteKey,
    bot,
    path: '/llms.txt',
    outcome: 'elevated',
    responseBytes: content.length,
  });

  return new NextResponse(content, withCors({
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
      'X-AI-Agent': 'ai-search-elevation-agent/1.0',
    },
  }));
}
