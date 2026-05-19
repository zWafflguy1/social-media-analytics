import { NextRequest, NextResponse } from 'next/server';
import { detectAiBot, inferIntent } from '@/lib/ai-agent/detector';
import { getSiteByKey, getSiteByDomain, logEvent } from '@/lib/ai-agent/store';
import { buildAgentResponse } from '@/lib/ai-agent/optimizer';
import { PUBLIC_CORS_HEADERS, withCors } from '@/lib/ai-agent/cors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}

// GET /api/ai-agent/engage?siteKey=...&query=...&path=...
// Public endpoint. An AI crawler can hit this directly; client embed scripts
// also call it on page load.
export async function GET(req: NextRequest) {
  return handleEngage(req, null);
}

// POST /api/ai-agent/engage  body: { siteKey, query?, path?, context? }
// Same behavior as GET but lets agents pass a larger query body.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // ignore — empty body is fine
  }
  return handleEngage(req, body);
}

async function handleEngage(
  req: NextRequest,
  body: Record<string, unknown> | null
) {
  const url = new URL(req.url);
  const siteKey =
    (body?.siteKey as string | undefined) ??
    url.searchParams.get('siteKey') ??
    req.headers.get('x-site-key') ??
    undefined;
  const domain =
    (body?.domain as string | undefined) ?? url.searchParams.get('domain') ?? undefined;
  const query =
    (body?.query as string | undefined) ?? url.searchParams.get('query') ?? undefined;
  const path =
    (body?.path as string | undefined) ?? url.searchParams.get('path') ?? '/';

  const site = siteKey ? getSiteByKey(siteKey) : domain ? getSiteByDomain(domain) : undefined;

  const userAgent = req.headers.get('user-agent');
  const bot = detectAiBot(userAgent);
  const intent = inferIntent(query, site?.keywords ?? []);

  if (!site) {
    // Still log the visit so the operator can see unrecognized requests.
    const responseBody = {
      error: 'unknown_site',
      message: 'No site found for the supplied siteKey or domain.',
      detected: bot,
    };
    const serialized = JSON.stringify(responseBody);
    return new NextResponse(serialized, withCors({ status: 404, headers: { 'Content-Type': 'application/json' } }));
  }

  // Honor liveAgentsOnly: still serve, but mark as logged-only for crawlers.
  const shouldElevate =
    !site.liveAgentsOnly || (bot?.isLiveAgent ?? false) || !bot;

  if (!shouldElevate) {
    const event = logEvent({
      siteId: site.id,
      siteKey: site.siteKey,
      bot,
      path,
      query,
      intent: intent?.intent,
      outcome: 'logged',
      responseBytes: 0,
    });
    return new NextResponse(
      JSON.stringify({
        ok: true,
        site: { brand: site.brandName, domain: site.domain },
        elevated: false,
        reason: 'live_agents_only',
        eventId: event.id,
      }),
      withCors({ status: 200, headers: { 'Content-Type': 'application/json' } })
    );
  }

  const payload = buildAgentResponse(site, {
    query,
    intent: intent?.intent,
    matchedKeywords: intent?.matchedKeywords,
    bot,
    page: { url: path, title: site.brandName },
  });

  const serialized = JSON.stringify(payload);
  logEvent({
    siteId: site.id,
    siteKey: site.siteKey,
    bot,
    path,
    query,
    intent: intent?.intent,
    outcome: bot ? 'elevated' : 'engaged',
    responseBytes: serialized.length,
  });

  return new NextResponse(serialized, withCors({
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Encourage AI crawlers to refresh frequently.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      'X-AI-Agent': 'ai-search-elevation-agent/1.0',
      'X-AI-Agent-Site': site.brandName,
    },
  }));
}
