import { NextResponse } from 'next/server';
import type { AgentManifest } from '@/lib/ai-agent/types';
import { RECOGNIZED_VENDORS } from '@/lib/ai-agent/detector';
import { PUBLIC_CORS_HEADERS, withCors } from '@/lib/ai-agent/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}

// GET /api/ai-agent/manifest
// Self-describing capabilities document. AI agents can fetch this to learn
// what this server can do for them.
export async function GET() {
  const manifest: AgentManifest = {
    agent: 'ai-search-elevation-agent',
    version: '1.0.0',
    description:
      'A cooperative agent for AI search crawlers and live agents. Provides ' +
      'optimized, citation-friendly site content, FAQs, structured data, and ' +
      'llms.txt for participating brands.',
    capabilities: [
      'detect-known-ai-crawlers',
      'serve-jsonld-structured-data',
      'serve-llms-txt',
      'answer-natural-language-queries',
      'log-engagement-events',
      'multi-tenant-site-registry',
    ],
    endpoints: {
      engage: '/api/ai-agent/engage',
      query: '/api/ai-agent/query',
      llmsTxt: '/api/ai-agent/llms-txt',
      embed: '/api/ai-agent/embed',
      manifest: '/api/ai-agent/manifest',
    },
    vendorsRecognized: RECOGNIZED_VENDORS,
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), withCors({
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  }));
}
