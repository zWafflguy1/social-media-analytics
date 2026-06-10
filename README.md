# AI SEO/AEO Ranking Agent

An embeddable AI agent that continuously works to maximize a website's visibility in its local market — in **both** classic search results (SEO) and AI-engine answers from ChatGPT/Perplexity/Claude-style assistants (AEO).

It runs a closed loop on a schedule:

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. MONITOR (real time)                                             │
│    • Google organic + local-pack positions for every               │
│      service × market query (via SerpAPI)                          │
│    • AI-engine visibility: asks prospect-style questions through a │
│      web-search-grounded model and checks whether the business     │
│      gets cited/mentioned in the answer                            │
│    • Real-user Core Web Vitals beaconed from the embed widget      │
│                                                                    │
│ 2. AUDIT                                                           │
│    • Crawls the site (titles, metas, H1s, schema, thin content,    │
│      local relevance signals, duplicate titles, alt text, …)       │
│                                                                    │
│ 3. PLAN (Claude Opus 4.8)                                          │
│    • Turns all of the above into a prioritized action plan,        │
│      JSON-LD schema, rewritten titles/metas, FAQ content, and      │
│      content briefs for queries the site currently loses           │
│                                                                    │
│ 4. APPLY                                                           │
│    • The drop-in embed.js widget auto-applies the safe subset on   │
│      the live site: JSON-LD injection, meta/title updates, FAQ     │
│      blocks. Everything else surfaces in the dashboard.            │
└────────────────────────────────────────────────────────────────────┘
```

## Honest framing

No tool — this one included — can *guarantee* a #1 ranking; Google and AI engines don't sell that control to anyone, and vendors who promise it are lying. What this agent does is relentlessly close the gap: it measures exactly where you stand for every query that matters in your market, finds the highest-leverage fixes, applies what it safely can, and re-measures. It also refuses to recommend manipulative tactics (fake reviews, doorway pages, deceptive schema) because those get sites penalized — the opposite of the goal.

## Quick start

```bash
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY, SITE_URL, BUSINESS_NAME, SERVICES, MARKET
npm run dev
```

On boot the server prints your dashboard URL and the embed tag. Add the tag to the website you're optimizing (before `</body>` or in `<head>` with `defer`):

```html
<script src="https://YOUR-AGENT-HOST/embed.js" data-key="YOUR_SITE_KEY" defer></script>
```

Optionally drop an FAQ container anywhere you want agent-generated FAQs rendered (these mirror the injected FAQPage schema, so the visible content matches the structured data — required by Google's guidelines):

```html
<div data-seo-agent="faq"></div>
```

### Environment variables

See `.env.example`. Required: `ANTHROPIC_API_KEY`, `SITE_URL`, `BUSINESS_NAME`, `SERVICES`, `MARKET`. Recommended: `SERPAPI_KEY` for real-time Google rank/local-pack tracking (the agent uses a licensed SERP provider rather than scraping Google directly, which violates Google's ToS and gets blocked).

## What the widget auto-applies vs. what it can't

| Auto-applied client-side | Surfaced as actions in the dashboard |
|---|---|
| JSON-LD: LocalBusiness, Service, FAQPage | Content rewrites and new pages (briefs provided) |
| `<title>` and meta description rewrites | Google Business Profile / reviews / NAP consistency |
| FAQ blocks (visible content + schema) | Backlinks, citations, directory listings |
| | Server-side performance fixes (driven by vitals data) |

Note: client-side JS injection of schema and metas is indexed by Google (it renders JS) but is weaker than server-side HTML. For maximum effect, periodically copy the agent's generated schema/metas into your site's source — the dashboard shows exactly what to paste. The widget is the zero-integration path; server-side is the endgame.

## API

All endpoints require `?key=SITE_KEY`.

| Endpoint | Purpose |
|---|---|
| `GET /embed/v1/optimizations?page=/` | What the widget applies on a page |
| `POST /embed/v1/vitals` | Web-vitals beacon from real visitors |
| `GET /api/v1/state` | Full agent state (ranks, AEO, findings, actions, briefs) |
| `POST /api/v1/run` | Trigger an optimization cycle immediately |
| `POST /api/v1/actions/:id/status` | Mark an action applied/dismissed |

## Architecture

```
src/
  index.ts               Express server + scheduler
  config.ts              Env config
  agent/orchestrator.ts  The brain: gathers signals, calls Claude with a
                         strict Zod-validated output schema, persists the plan
  seo/crawler.ts         Polite same-origin crawler (your own site)
  seo/audit.ts           Deterministic on-page audit rules
  serp/serpMonitor.ts    Rank tracking via SerpAPI (pluggable RankProvider)
  aeo/aiEngineMonitor.ts AI-engine citation/mention checks via web search
  local/queries.ts       Generates the service × market query set
  api/routes.ts          Embed + dashboard endpoints
  store/db.ts            JSON-file datastore (swap for a real DB at scale)
public/
  embed.js               The drop-in widget
  dashboard.html         Live dashboard
```

## Scaling notes

- **Multi-tenant**: the datastore and config are single-site by design for clarity. To serve many customer sites, key state by site and move config (`SITE_URL`, services, market) into per-site records.
- **Datastore**: the JSON-file store is fine for one site; swap `src/store/db.ts` for Postgres/SQLite behind the same interface for production.
- **SERP provider**: implement the `RankProvider` interface in `serpMonitor.ts` for DataForSEO, Serper.dev, etc.
- **Costs**: each cycle makes ~1 planning call plus one web-search call per AEO query. Tune `AGENT_INTERVAL_HOURS` and the query set in `local/queries.ts` to control spend.
