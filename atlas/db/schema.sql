-- ════════════════════════════════════════════════════════════════════════════
-- Atlas — AI Knowledge Layer — database schema
-- Postgres + pgvector. Multi-tenant from row zero: every table that holds
-- customer data carries tenant_id, and the application sets it on every query.
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Tenancy ──────────────────────────────────────────────────────────────────
-- One row per customer that buys Atlas. Their entire knowledge layer is isolated
-- by tenant_id; nothing crosses the boundary.
CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- per-tenant autonomy ceiling (0..3); overrides nothing above the global cap
  max_autonomy_tier SMALLINT NOT NULL DEFAULT 1,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- ─── Layer 1: Events (the universal record of "everything that happens") ───────
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,           -- gmail | dialpad | hubspot | stripe | ...
  type         TEXT NOT NULL,           -- call.completed | email.received | ...
  occurred_at  TIMESTAMPTZ NOT NULL,
  subject      TEXT,
  body         TEXT,                    -- redacted text (never raw PII)
  actors       JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics      JSONB NOT NULL DEFAULT '{}'::jsonb,
  links        JSONB NOT NULL DEFAULT '{}'::jsonb,
  sensitivity  TEXT NOT NULL DEFAULT 'internal', -- public|internal|confidential|restricted
  raw_ref      TEXT,                    -- pointer to immutable raw copy (object storage)
  -- enrichment status: pending -> enriched (or failed)
  status       TEXT NOT NULL DEFAULT 'pending',
  dedupe_key   TEXT,                    -- connector-provided idempotency key
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS events_tenant_time ON events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_tenant_status ON events (tenant_id, status);
CREATE INDEX IF NOT EXISTS events_tenant_source ON events (tenant_id, source);

-- ─── Layer 2: Knowledge — enrichment output (summaries + signals) ──────────────
CREATE TABLE IF NOT EXISTS enrichments (
  event_id     TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  summary      TEXT NOT NULL,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sentiment    REAL,                    -- -1..1
  urgency      REAL,                    -- 0..1
  topics       TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semantic memory. Each chunk (event body / summary) becomes one embedded row.
-- 1536 dims matches common providers and the local fallback embedder.
CREATE TABLE IF NOT EXISTS embeddings (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    TEXT REFERENCES events(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- summary | body | decision
  content     TEXT NOT NULL,
  embedding   vector(1536) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS embeddings_tenant ON embeddings (tenant_id);
-- Cosine ANN index; rebuild lists as the corpus grows.
CREATE INDEX IF NOT EXISTS embeddings_vec ON embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Knowledge graph — entities and the edges between them. Modeled in Postgres
-- (per the plan) so we run on one datastore until relationships justify Neo4j.
CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,           -- person | account | deal | campaign | quarter | decision
  name        TEXT NOT NULL,
  attrs       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, name)
);
CREATE INDEX IF NOT EXISTS entities_tenant_kind ON entities (tenant_id, kind);

CREATE TABLE IF NOT EXISTS relations (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  src_id      TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  predicate   TEXT NOT NULL,           -- works_on | owns | mentioned_in | decided
  dst_id      TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
  weight      REAL NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relations_tenant_src ON relations (tenant_id, src_id);
CREATE INDEX IF NOT EXISTS relations_tenant_dst ON relations (tenant_id, dst_id);

-- Decision log — "every business decision made", structured.
CREATE TABLE IF NOT EXISTS decisions (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  rationale    TEXT,
  alternatives TEXT,
  decided_by   TEXT,
  decided_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_event TEXT REFERENCES events(id) ON DELETE SET NULL,
  confidence   REAL NOT NULL DEFAULT 1,  -- 1 if human-logged, <1 if AI-inferred
  status       TEXT NOT NULL DEFAULT 'confirmed', -- proposed | confirmed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decisions_tenant_time ON decisions (tenant_id, decided_at DESC);

-- Time-series metrics — hard numbers powering efficiency tracking & charts.
CREATE TABLE IF NOT EXISTS metrics (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- mrr | cycle_time_days | response_latency_h | ctr
  domain      TEXT NOT NULL,           -- sales | finance | support | marketing | meetings
  value       DOUBLE PRECISION NOT NULL,
  unit        TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS metrics_tenant_name_time ON metrics (tenant_id, name, captured_at DESC);

-- ─── Layer 3: Agency — actions, approvals, audit ──────────────────────────────
-- Every proposed or executed action by the AI. Tier drives whether a human must
-- approve before it runs.
CREATE TABLE IF NOT EXISTS actions (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool         TEXT NOT NULL,           -- draft_reply | update_crm | flag_risk | ...
  tier         SMALLINT NOT NULL,       -- 0..3
  args         JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale    TEXT,                    -- why the agent proposed this
  evidence     JSONB NOT NULL DEFAULT '[]'::jsonb, -- event ids cited
  status       TEXT NOT NULL DEFAULT 'proposed', -- proposed|approved|rejected|executed|failed
  result       JSONB,
  proposed_by  TEXT NOT NULL DEFAULT 'agent',
  reviewed_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS actions_tenant_status ON actions (tenant_id, status);

-- Append-only audit log. Every consequential thing Atlas does lands here.
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  actor       TEXT NOT NULL,           -- agent | user:<id> | system | connector:<name>
  action      TEXT NOT NULL,           -- event.ingested | action.executed | chat.answered | ...
  target      TEXT,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_tenant_time ON audit_log (tenant_id, created_at DESC);

-- Generated briefs (weekly / quarterly) kept for history & comparison.
CREATE TABLE IF NOT EXISTS briefs (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,           -- weekly | quarterly | onboarding
  period      TEXT,                    -- e.g. 2026-W22 or 2026-Q2 or role name
  content     TEXT NOT NULL,           -- markdown
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS briefs_tenant_kind_time ON briefs (tenant_id, kind, created_at DESC);
