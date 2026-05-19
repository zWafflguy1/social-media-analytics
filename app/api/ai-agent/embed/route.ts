import { NextRequest, NextResponse } from 'next/server';
import { getSiteByKey } from '@/lib/ai-agent/store';
import { buildMetaTags } from '@/lib/ai-agent/optimizer';
import { PUBLIC_CORS_HEADERS } from '@/lib/ai-agent/cors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/ai-agent/embed?siteKey=...
// Returns a JS snippet the client site loads via <script src="...">.
// The snippet injects JSON-LD + meta tags, then pings /engage on page view.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const siteKey = url.searchParams.get('siteKey') ?? '';
  const site = siteKey ? getSiteByKey(siteKey) : undefined;

  if (!site) {
    const errorJs = `// AI Search Elevation Agent — unknown siteKey (${JSON.stringify(siteKey)})\nconsole.warn("[ai-agent] unknown siteKey:", ${JSON.stringify(siteKey)});`;
    return new NextResponse(errorJs, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        ...PUBLIC_CORS_HEADERS,
      },
    });
  }

  // Pre-render the meta tags + JSON-LD as a string so the injection is one
  // synchronous DOM operation rather than a chatty round-trip.
  const headHtml = buildMetaTags(site);

  // Self-detect whether the visiting UA is an AI bot client-side so we can
  // also fire a richer engage call when it is.
  const origin = `${url.protocol}//${url.host}`;
  const js = `/* AI Search Elevation Agent embed — site: ${site.brandName} */
(function () {
  if (window.__aiAgentEmbedded__) return;
  window.__aiAgentEmbedded__ = true;
  var SITE_KEY = ${JSON.stringify(site.siteKey)};
  var BASE = ${JSON.stringify(origin)};
  var AI_PATTERN = /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|Applebot-Extended|CCBot|YouBot|Meta-ExternalAgent|Bytespider|cohere-ai|MistralAI-User|DuckAssistBot/i;
  var ua = navigator.userAgent || "";
  var looksAi = AI_PATTERN.test(ua);

  // 1. Inject JSON-LD + AI-friendly meta tags into the host page.
  try {
    var container = document.createElement("div");
    container.innerHTML = ${JSON.stringify(headHtml)};
    var nodes = Array.prototype.slice.call(container.childNodes);
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 1) document.head.appendChild(nodes[i]);
    }
  } catch (e) {
    console.warn("[ai-agent] inject failed:", e);
  }

  // 2. Notify the agent backend so we log the engagement and (for known AI
  //    user-agents) get a richer payload back that the page could surface.
  try {
    var endpoint = BASE + "/api/ai-agent/engage?siteKey=" + encodeURIComponent(SITE_KEY) +
      "&path=" + encodeURIComponent(location.pathname + location.search);
    fetch(endpoint, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { "Accept": "application/json" },
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        // Expose payload so callers can build a custom on-page "AI summary".
        window.__aiAgent = data;
        document.dispatchEvent(new CustomEvent("ai-agent:ready", { detail: data }));
        if (looksAi) {
          document.dispatchEvent(new CustomEvent("ai-agent:bot-detected", { detail: { ua: ua, data: data } }));
        }
      })
      .catch(function () { /* network failures are non-fatal */ });
  } catch (e) {
    console.warn("[ai-agent] engage call failed:", e);
  }
})();`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      ...PUBLIC_CORS_HEADERS,
    },
  });
}
