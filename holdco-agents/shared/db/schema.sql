-- HoldCo Agents — SQLite schema
-- All money fields stored in cents (integer) to avoid float drift.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- DEALS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL,            -- bizbuysell | bizquest | flippa | empire-flippers | broker-email | reddit | x | linkedin
  source_url      TEXT,
  source_ref      TEXT,                     -- listing id or message-id
  title           TEXT NOT NULL,
  description     TEXT,
  industry        TEXT,
  location        TEXT,
  asking_price    INTEGER,                  -- cents
  sde             INTEGER,                  -- cents, annual
  ebitda          INTEGER,                  -- cents, annual
  revenue         INTEGER,                  -- cents, annual
  cash_flow       INTEGER,                  -- cents, annual
  employees       INTEGER,
  established_year INTEGER,
  reason_for_sale TEXT,
  absentee_signal INTEGER DEFAULT 0,        -- 0/1 derived flag
  posted_at       INTEGER,                  -- unix seconds
  scraped_at      INTEGER NOT NULL,
  raw             TEXT,                     -- json blob of source-specific fields
  score           INTEGER,                  -- 0-100 from deal-scout/score.ts
  score_reasoning TEXT,
  status          TEXT NOT NULL DEFAULT 'sourced',
                  -- sourced | scored | qualified | matching | funding | diligence | won | lost | dead
  notes           TEXT,
  UNIQUE(source, source_ref)
);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_score ON deals(score DESC);
CREATE INDEX IF NOT EXISTS idx_deals_scraped_at ON deals(scraped_at DESC);

-- ----------------------------------------------------------------------------
-- INVESTORS (family offices, PE, HNW individuals)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  type            TEXT,                     -- family-office | pe | hnw | search-fund | mezz
  focus_sectors   TEXT,                     -- comma-separated tags
  check_size_min  INTEGER,                  -- cents
  check_size_max  INTEGER,                  -- cents
  geography       TEXT,                     -- comma-separated regions or 'US'
  thesis          TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_url     TEXT,
  source_url      TEXT,                     -- where we found them
  enrichment      TEXT,                     -- json blob from public-source enrichment
  last_contacted_at INTEGER,
  created_at      INTEGER NOT NULL,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_investors_type ON investors(type);

-- ----------------------------------------------------------------------------
-- LENDERS (SBA preferred, conventional banks, online lenders)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lenders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL,            -- sba-preferred | conventional | online | mezzanine | seller-finance
  products        TEXT,                     -- comma-separated: 7a | 504 | conv-term | line-of-credit | mezz
  sba_preferred   INTEGER DEFAULT 0,        -- 0/1
  min_loan        INTEGER,                  -- cents
  max_loan        INTEGER,                  -- cents
  industries_focus TEXT,                    -- comma-separated; empty means general
  industries_avoid TEXT,                    -- comma-separated
  geography       TEXT,                     -- e.g. 'national' or 'TX,OK,LA'
  typical_rate    TEXT,                     -- e.g. 'prime+2.75'
  contact_url     TEXT,
  notes           TEXT,
  created_at      INTEGER NOT NULL
);

-- ----------------------------------------------------------------------------
-- DEAL → INVESTOR MATCHES (with queued outreach drafts, human-in-the-loop)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id         INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  investor_id     INTEGER NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  match_score     INTEGER NOT NULL,         -- 0-100
  match_reasoning TEXT,
  draft_subject   TEXT,
  draft_body      TEXT,
  status          TEXT NOT NULL DEFAULT 'queued',
                  -- queued | approved | rejected | sent | responded | passed
  queued_at       INTEGER NOT NULL,
  approved_by     TEXT,
  approved_at     INTEGER,
  sent_at         INTEGER,
  response_at     INTEGER,
  response_note   TEXT,
  UNIQUE(deal_id, investor_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_deal ON matches(deal_id);

-- ----------------------------------------------------------------------------
-- LOAN APPLICATIONS (per deal, per lender, with full application package)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id         INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  lender_id       INTEGER NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  product         TEXT NOT NULL,            -- 7a | 504 | conv-term | etc
  requested_amount INTEGER,                 -- cents
  term_months     INTEGER,
  fit_score       INTEGER,                  -- 0-100, from debt-architect
  fit_reasoning   TEXT,
  package_md      TEXT,                     -- full application package, markdown
  package_pdf     TEXT,                     -- relative path under data/applications/
  status          TEXT NOT NULL DEFAULT 'drafted',
                  -- drafted | approved | submitted | underwriting | offered | accepted | declined | withdrawn
  created_at      INTEGER NOT NULL,
  submitted_at    INTEGER,
  decision_at     INTEGER,
  decision_note   TEXT,
  UNIQUE(deal_id, lender_id, product)
);
CREATE INDEX IF NOT EXISTS idx_loan_apps_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_apps_deal ON loan_applications(deal_id);

-- ----------------------------------------------------------------------------
-- FUNDING STACK (committed capital per deal, by source)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funding_stack (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id         INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL,            -- equity | senior-debt | mezz | seller-finance | sba | conventional
  lender_id       INTEGER REFERENCES lenders(id),
  investor_id     INTEGER REFERENCES investors(id),
  amount          INTEGER NOT NULL,         -- cents
  terms           TEXT,
  status          TEXT NOT NULL DEFAULT 'verbal',
                  -- verbal | LOI | term-sheet | committed | funded
  created_at      INTEGER NOT NULL,
  closed_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_funding_deal ON funding_stack(deal_id);

-- ----------------------------------------------------------------------------
-- AGENT RUNS (every agent invocation logged for observability)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name      TEXT NOT NULL,            -- deal-scout | capital-matcher | debt-architect | portfolio-cfo
  started_at      INTEGER NOT NULL,
  finished_at     INTEGER,
  status          TEXT NOT NULL,            -- running | success | failed
  items_processed INTEGER DEFAULT 0,
  items_created   INTEGER DEFAULT 0,
  summary         TEXT,
  error           TEXT,
  tokens_in       INTEGER DEFAULT 0,
  tokens_out      INTEGER DEFAULT 0,
  cost_cents      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_runs_agent_started ON agent_runs(agent_name, started_at DESC);

-- ----------------------------------------------------------------------------
-- RISK ALERTS (raised by portfolio-cfo daily scan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id         INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  severity        TEXT NOT NULL,            -- info | warn | critical
  category        TEXT NOT NULL,            -- stale-outreach | funding-gap | lender-silent | diligence-overdue | pricing-drift
  message         TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  resolved_at     INTEGER,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON risk_alerts(resolved_at) WHERE resolved_at IS NULL;

-- ----------------------------------------------------------------------------
-- WEEKLY REPORTS (archive of Monday 5AM rollups)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_reports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  week_of         TEXT NOT NULL UNIQUE,     -- ISO date of Monday
  generated_at    INTEGER NOT NULL,
  html            TEXT NOT NULL,
  pdf_path        TEXT,
  metrics_json    TEXT NOT NULL,            -- structured KPIs for dashboard
  sent_at         INTEGER,
  send_error      TEXT
);
