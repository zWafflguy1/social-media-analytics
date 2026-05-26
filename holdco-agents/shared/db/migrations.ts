import type Database from 'better-sqlite3';

function now(): number { return Math.floor(Date.now() / 1000); }

// Lightweight migrations layer. Each migration runs once per DB.
// Always write migrations to be idempotent within themselves — we use
// pragma_table_info checks before ALTER TABLE ADD COLUMN because SQLite has
// no ADD COLUMN IF NOT EXISTS.

type Migration = { version: number; description: string; up: (d: Database.Database) => void };

const MIGRATIONS: Migration[] = [
  {
    version: 2,
    description: 'investor enrichment: status + origin + enrichment metadata',
    up: (d) => {
      const cols = (d.pragma(`table_info(investors)`) as Array<{ name: string }>).map((c) => c.name);
      if (!cols.includes('status')) {
        d.exec(`ALTER TABLE investors ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
      }
      if (!cols.includes('origin')) {
        d.exec(`ALTER TABLE investors ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'`);
      }
      if (!cols.includes('confidence')) {
        d.exec(`ALTER TABLE investors ADD COLUMN confidence INTEGER`);
      }
      d.exec(`CREATE INDEX IF NOT EXISTS idx_investors_status ON investors(status)`);
      d.exec(`CREATE INDEX IF NOT EXISTS idx_investors_origin ON investors(origin)`);

      // Track raw enrichment artifacts so we can audit / re-extract later
      d.exec(`
        CREATE TABLE IF NOT EXISTS investor_enrichment_sources (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          investor_id     INTEGER REFERENCES investors(id) ON DELETE CASCADE,
          source          TEXT NOT NULL,            -- 'sec-form-d' | 'google-news' | 'newsapi'
          source_ref      TEXT NOT NULL,            -- accession number, article URL, etc.
          fetched_at      INTEGER NOT NULL,
          raw_text        TEXT,
          raw_meta        TEXT,                     -- json blob
          UNIQUE(source, source_ref)
        )
      `);
      d.exec(`CREATE INDEX IF NOT EXISTS idx_enrich_investor ON investor_enrichment_sources(investor_id)`);
    },
  },
];

export function runMigrations(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    (d.prepare(`SELECT version FROM schema_migrations`).all() as Array<{ version: number }>).map((r) => r.version)
  );

  // If schema_migrations was just created on a DB that already had v1 tables,
  // backfill the v1 marker so we don't try to re-apply.
  if (applied.size === 0) {
    const tables = (d.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{ name: string }>).map((r) => r.name);
    if (tables.includes('deals')) {
      d.prepare(`INSERT INTO schema_migrations (version, description, applied_at) VALUES (1, 'initial schema', ?)`).run(now());
      applied.add(1);
    }
  }

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    const tx = d.transaction(() => {
      m.up(d);
      d.prepare(`INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)`)
        .run(m.version, m.description, now());
    });
    tx();
    console.log(`[migrations] applied v${m.version} — ${m.description}`);
  }
}
