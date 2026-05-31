# Atlas — Agentic AI Knowledge Layer

Atlas is the connective **memory + action layer** for a business. It ingests
everything that happens across the company's tools (calls, emails, finance,
support, decisions, social), turns it into durable, queryable institutional
knowledge, reasons over it to assess efficiency and tendencies, and — within a
governed permission system — acts.

This repo is the working foundation: the full architecture from the proposal,
end-to-end and runnable, with the core vertical slice implemented and
integrations stubbed at clearly marked seams.

> **Built to be extracted.** This is a self-contained app in its own folder so it
> can be lifted into a dedicated repository wholesale.

## The three product pillars

1. **Expedite onboarding** — `/onboarding` generates a role-specific brief from
   the company's own history so a new hire is productive on day one.
2. **Ongoing efficiency** — continuous metric tracking + the weekly/quarterly
   **brief** turn activity into ranked, evidence-backed recommendations; action
   agents do the repetitive work.
3. **Maximal use of all data** — every interaction is captured (universal event
   schema), stored durably (raw + enriched), and compiled into reference points
   (vector index + knowledge graph) that compound daily.

## Architecture (three layers)

```
Layer 1  Ingestion      connectors → consent gate → PII redaction → events
Layer 2  Knowledge      summarize → extract → embed → graph + vector store
Layer 3  Agency         analyst (chat) · recommender (briefs) · tools w/ tiers
```

| Concern | Where |
|---|---|
| Universal event + ingest | `lib/events/`, `app/api/events` |
| Consent gate / PII redaction | `lib/consent.ts`, `lib/pii.ts` |
| Enrichment pipeline | `lib/enrich/`, `app/api/enrich` |
| Vector retrieval (RAG) | `lib/knowledge/retrieve.ts` |
| Knowledge graph | `lib/knowledge/graph.ts` |
| Ask-anything chat | `lib/agents/analyst.ts`, `app/chat` |
| Weekly / quarterly briefs | `lib/agents/recommender.ts` |
| Onboarding briefs | `lib/agents/onboarding.ts`, `app/onboarding` |
| Permission tiers + actions | `lib/agents/tools.ts` |
| Approval inbox | `app/api/approvals`, `app/approvals` |
| Audit log | `lib/audit.ts` |
| Multi-tenancy + autonomy ceiling | `lib/tenancy.ts` |
| Connectors | `connectors/` |

## Permission tiers (the leash)

```
0 READ ONLY        query, summarize, analyze        always allowed
1 DRAFT / PROPOSE  write a draft, suggest           allowed, nothing sent
2 ACT W/ APPROVAL  send, update CRM, schedule       queued to approval inbox
3 AUTONOMOUS       act without a human              only after explicit opt-in
```

The effective ceiling is `min(global cap, tenant cap)`, and a global
`ATLAS_ACTIONS_FROZEN` kill switch caps everything at drafts. Actions above the
ceiling land in the approval inbox; everything consequential is in the audit log.

## Quickstart

```bash
# 1. Postgres with pgvector
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=atlas --name atlas-pg \
  pgvector/pgvector:pg16

# 2. Configure
cp .env.example .env.local      # set DATABASE_URL + ANTHROPIC_API_KEY
npm install

# 3. Schema + demo data (seeds a tenant, ingests + enriches sample events)
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev                     # http://localhost:3000
```

Then: **Ask Atlas** ("Why is Acme at risk?"), generate a **weekly brief** on the
Overview page, or build an **onboarding brief** for a role.

Embeddings default to a dependency-free local embedder so everything runs out of
the box; set `ATLAS_EMBEDDING_PROVIDER=voyage` for production-grade semantics.

## Ingesting events

```bash
curl -X POST http://localhost:3000/api/events \
  -H 'content-type: application/json' \
  -H 'x-atlas-tenant: tnt_demo' \
  -H 'x-atlas-ingest-secret: <ATLAS_INGEST_SECRET>' \
  -d '{"source":"gmail","type":"email.received",
       "occurred_at":"2026-05-30T15:00:00Z",
       "subject":"Re: pricing","body":"Customer asked about annual discount."}'
```

Recorded calls must include a `consent` block or they're rejected (`lib/consent.ts`).

## Scheduling (production)

- Enrichment: trigger `POST /api/enrich` from a cron (Vercel Cron / Inngest), or
  run the `npm run enrich:worker` loop.
- Briefs: schedule `POST /api/brief {kind:"weekly"}` Monday mornings.

## What's real vs. stubbed

- **Real & runnable:** event schema, consent/PII gate, ingestion, enrichment
  (summarize→extract→embed→graph), vector retrieval, chat, briefs, onboarding,
  permission tiers, approval inbox, audit log, multi-tenancy.
- **Stubbed at marked seams:** outbound tool side-effects in `lib/agents/tools.ts`
  (send_email, update_crm, schedule_meeting) log intent; wire real provider APIs
  there. Connectors in `connectors/` show the mapping pattern for two sources.

See `../docs` / the proposal for the full phased roadmap and risk analysis.
