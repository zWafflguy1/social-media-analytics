# HoldCo Agents

Autonomous AI agent system for sourcing, capitalizing, and managing a holding-company
portfolio of lower-middle-market ($1M–$10M EV) absentee-run or low-touch businesses.

## What it does

Four agents run on a schedule and share a SQLite database. A Next.js dashboard sits on top
for human-in-the-loop approval and monitoring.

| Agent | Cadence | Responsibility |
|-------|---------|----------------|
| **deal-scout** | every 6 hrs | Pulls listings from BizBuySell, BizQuest, Flippa, Empire Flippers, your broker email inbox, and Reddit/X exit-intent signals. Filters to $1M–$10M EV. Scores each deal 0–100 with reasoning. |
| **capital-matcher** | every 6 hrs (15min after scout) | For each deal scoring ≥ 70, ranks investors in your CRM by sector / check size / geo / thesis fit. Drafts a tailored outreach email per top match. **Drafts go to the outreach queue — you approve before sending.** |
| **debt-architect** | every 6 hrs (30min after scout) | For each qualified deal, ranks lenders, picks the best 3, and writes a full loan application package (executive summary, business overview, financials, sources & uses, DSCR analysis, risk factors). |
| **portfolio-cfo** | daily 7 AM + Monday 5 AM | Daily risk scan: stale outreach, funding gaps, drifting diligence. Monday 5 AM: composes and emails the weekly report to `REPORT_TO_EMAIL`. |
| **investor-enricher** | weekly (Sat 3 AM) | Builds the investor CRM from public sources: scans recent SEC Form D filings for investment entities (funds, family-office vehicles), Google News for active deal-makers. Extracts profile data with Claude. New prospects land as candidates for your review — never auto-active. |

Everything is observable on the dashboard at `http://localhost:3000`.

## Setup

### 1. Install

```bash
cd holdco-agents
npm install
npx playwright install chromium     # for marketplace scrapers
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in:
- `ANTHROPIC_API_KEY` — required. Get from https://console.anthropic.com.
- `RESEND_API_KEY` — required to send the weekly report, outreach emails, and magic-link sign-in.
- `REPORT_FROM_EMAIL` — must be a verified Resend sender (a domain you own).
- `REPORT_TO_EMAIL` — defaults to `zjones@gowaffl.com`.
- `DASHBOARD_SECRET` — generate with `openssl rand -hex 32`. Signs session cookies.
- `DASHBOARD_ALLOWED_EMAILS` — comma-separated allowlist of emails that can sign in.

Optional but recommended:
- `BROKER_INBOX_*` — set up a dedicated inbox (e.g. `deals@yourholdco.com`), use a Gmail
  app password. Forward broker newsletters and deal teasers to it.
- `REDDIT_*` and `X_BEARER_TOKEN` — for social-signal scraping. Without these the agent
  silently skips those sources.

### 3. Initialize DB + seed

```bash
npm run db:init      # creates ./data/holdco.db
npm run db:seed      # seeds 10 lenders + placeholder investors
```

### 4. Add your real investors

Drop a CSV at `data/investors.csv`:

```csv
name,type,focus_sectors,check_size_min,check_size_max,geography,thesis,contact_name,contact_email,contact_url,notes
Acme Family Office,family-office,"b2b-services,distribution",500000,3000000,"US-SE,US-TX","Cash-flowing absentee businesses, 5-7yr hold","Jane Smith",jane@acmefo.com,https://acmefo.com,"Met at SMB summit 2024"
```

Then re-run `npm run db:seed`.

> **Important:** without real investors in the CRM, the capital-matcher will only see the
> placeholder records and won't produce useful matches. This is your highest-leverage
> data input.

### 5. Run it

In one terminal:
```bash
npm run start        # runs scheduler + dashboard concurrently
```

Or separately during development:
```bash
npm run dashboard    # http://localhost:3000
npm run scheduler    # background agents
```

To trigger an agent manually:
```bash
npm run scout
npm run match
npm run debt
npm run cfo            # risk scan
npm run report         # generate + send weekly report immediately
```

Or click "Run now" on the **Agents** page in the dashboard.

## The dashboard

Behind magic-link auth. First visit redirects to `/login`; enter an email on the allowlist
and you'll receive a sign-in link valid for 15 minutes. Session lasts 30 days.

- **/** — KPIs, open risk alerts, recent agent runs.
- **/deals** — Kanban pipeline (sourced → scored → qualified → matching → funding → diligence → won).
- **/outreach** — **Critical screen.** All AI-drafted investor outreach awaiting your approval. Click *Approve & Send* to fire it via Resend.
- **/investors** — Active CRM table.
- **/investors/candidates** — Enrichment output awaiting your review. Promote good ones, archive the rest.
- **/lenders** — Active loan applications + lender library.
- **/reports** — Weekly report archive. Each is the same HTML that's emailed.
- **/agents** — Manual triggers + run history with token usage and cost.

### Putting the dashboard on a public host

Auth is real (HMAC-signed session cookies + magic-link tokens, allowlist gating), but the
threat model is "one operator, one domain." Before exposing it publicly:

1. Set `DASHBOARD_SECRET` to a fresh 32-byte hex string.
2. Restrict `DASHBOARD_ALLOWED_EMAILS` to only the addresses that should access.
3. Terminate TLS at your reverse proxy (the cookie is marked `Secure` in production).
4. Consider IP-restricting at the load balancer if it's truly single-user.

## Architecture notes

```
┌────────────┐  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐
│ deal-scout │→ │ capital-matcher│  │ debt-architect  │  │ portfolio-cfo│
└──────┬─────┘  └────────┬───────┘  └────────┬────────┘  └──────┬───────┘
       │                 │                   │                  │
       │                 ▼                   ▼                  ▼
       │           ┌──────────────────────────────────────────────┐
       └──────────▶│            SQLite (./data/holdco.db)         │
                   └──────────────────────────────────────────────┘
                                       ▲
                                       │
                        ┌──────────────┴───────────────┐
                        │  Next.js dashboard (App Rtr) │
                        └──────────────────────────────┘
```

- **Storage:** SQLite via `better-sqlite3`. Single file, WAL mode, fine for v1.
  Migrate to Postgres when you have multiple agents writing concurrently from different hosts.
- **LLM tiers:** `fast` = Claude Haiku 4.5 (filtering, signal classification). `default` =
  Claude Sonnet 4.6 (scoring, matching, drafts). `heavy` = Claude Opus 4.7 (loan application
  packages, weekly narrative). Cost is tracked per run in `agent_runs.cost_cents`.
- **Human-in-the-loop:** **All outbound email is queued, never auto-sent.** You approve from
  the dashboard. Loan applications are likewise drafted but not submitted.
- **Idempotency:** Every external source has a `(source, source_ref)` unique key.
  Re-running an agent never duplicates deals.

## What's NOT in this v1

- **Investor enrichment from public sources** (Crunchbase, SEC Form D scraping). The
  matcher works against whatever investors you put in the CRM. Building a public-source
  enrichment pipeline that respects TOS is its own project — recommended for v2.
- **LinkedIn signal scraping.** TOS-restricted. If you have a Sales Navigator + scraper
  API contract, add it as a new source in `agents/deal-scout/sources/`.
- **Submitting loan applications.** The agent drafts them; you submit. Lenders rarely
  accept fully automated submissions for SBA 7(a) anyway.
- **Auto-sending outreach.** Intentional — see "Autonomy" note below.

## Autonomy posture

By design, **agents draft; you decide**. Specifically:
- Deal scoring → automatic.
- Investor matching → automatic.
- Outreach drafts → automatic.
- **Outreach sending → requires your click.**
- Loan package generation → automatic.
- **Loan submission → manual.**
- Funding stack changes → manual.

To loosen this in the future, add an `auto_send` flag per investor in the CRM. Until then,
the queue is the safety rail. One hallucinated deal memo sent to a real family office
burns a relationship for years.

## Cost expectations

At default cadence and ~10–30 new deals/day across all sources, expect ~$30–$80/month
in Claude API spend. Higher if you have hundreds of broker emails forwarded or pull
larger marketplace pages. Watch the **Agents** page for actuals.

## Operational checklist

- [ ] `.env` filled in
- [ ] Domain verified in Resend (`REPORT_FROM_EMAIL`)
- [ ] Investors CSV imported
- [ ] Broker inbox set up and forwarding rules configured
- [ ] First successful manual run of each agent
- [ ] Scheduler running on a host that's awake 24/7 (laptop, VPS, your existing server)
- [ ] First Monday report received

## Extracting to its own repo

This subdirectory is self-contained. To split it off with full git history:

```bash
# From the parent repo:
git subtree split --prefix=holdco-agents -b holdco-extract
# Create empty repo at github.com/<you>/holdco-agents, then:
cd /tmp && git clone <main-repo> holdco-agents && cd holdco-agents
git checkout holdco-extract
git remote set-url origin git@github.com:<you>/holdco-agents.git
git push -u origin holdco-extract:main
```
