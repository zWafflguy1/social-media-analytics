import { startRun } from '../../shared/agent-runner.js';
import { db, now } from '../../shared/db/client.js';
import { fetchFormDCandidates } from './sources/sec-form-d.js';
import { fetchNewsCandidates } from './sources/news.js';
import { extractInvestorProfile } from './extract.js';
import { normalizeName } from './dedup.js';

// Candidates from raw enrichment sources. The agent's job:
// 1. Fetch from each source
// 2. Run Claude over each candidate to produce a structured profile
// 3. Dedup against the existing CRM (by normalized name)
// 4. Insert new prospects as status='candidate' for human review on the dashboard

export type RawCandidate = {
  source: 'sec-form-d' | 'google-news' | 'newsapi';
  source_ref: string;
  name: string;
  source_url?: string;
  raw_text: string;
  raw_meta?: Record<string, unknown>;
};

const MAX_PER_RUN = 40;        // hard cap on Claude calls per run

export async function runInvestorEnricher(): Promise<void> {
  const run = startRun('investor-enricher');
  let processed = 0, created = 0;

  try {
    const candidates: RawCandidate[] = [];

    try {
      candidates.push(...await fetchFormDCandidates());
    } catch (err) {
      console.warn('[investor-enricher/sec]', (err as Error).message);
    }

    try {
      candidates.push(...await fetchNewsCandidates());
    } catch (err) {
      console.warn('[investor-enricher/news]', (err as Error).message);
    }

    // Dedup by normalized name across this batch + existing investors
    const existing = db().prepare(`SELECT id, name FROM investors`).all() as Array<{ id: number; name: string }>;
    const existingByNorm = new Map(existing.map((i) => [normalizeName(i.name), i] as const));
    const seenInBatch = new Set<string>();

    const insertInvestor = db().prepare(`
      INSERT INTO investors
        (name, type, focus_sectors, check_size_min, check_size_max, geography, thesis,
         contact_name, contact_email, contact_url, source_url, enrichment, created_at,
         status, origin, confidence, notes)
      VALUES
        (@name, @type, @focus_sectors, @check_size_min, @check_size_max, @geography, @thesis,
         @contact_name, @contact_email, @contact_url, @source_url, @enrichment, @created_at,
         'candidate', @origin, @confidence, @notes)
    `);
    const insertSource = db().prepare(`
      INSERT INTO investor_enrichment_sources
        (investor_id, source, source_ref, fetched_at, raw_text, raw_meta)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, source_ref) DO NOTHING
    `);

    const limited = candidates.slice(0, MAX_PER_RUN);
    for (const c of limited) {
      processed += 1;
      const norm = normalizeName(c.name);

      // Already in CRM — just attach the source for audit, don't re-extract.
      const dup = existingByNorm.get(norm);
      if (dup) {
        insertSource.run(dup.id, c.source, c.source_ref, now(), c.raw_text, JSON.stringify(c.raw_meta ?? {}));
        continue;
      }
      if (seenInBatch.has(norm)) continue;
      seenInBatch.add(norm);

      const extracted = await extractInvestorProfile(c);
      run.recordUsage('default', extracted.usage);

      if (!extracted.profile || extracted.profile.confidence < 40) continue;     // too noisy

      const p = extracted.profile;
      const result = insertInvestor.run({
        name: c.name,
        type: p.type ?? null,
        focus_sectors: p.focus_sectors ?? null,
        check_size_min: p.check_size_min_usd ? p.check_size_min_usd * 100 : null,
        check_size_max: p.check_size_max_usd ? p.check_size_max_usd * 100 : null,
        geography: p.geography ?? null,
        thesis: p.thesis ?? null,
        contact_name: p.contact_name ?? null,
        contact_email: null,
        contact_url: c.source_url ?? null,
        source_url: c.source_url ?? null,
        enrichment: JSON.stringify({ extraction: p, raw_meta: c.raw_meta }),
        created_at: now(),
        origin: c.source,
        confidence: p.confidence,
        notes: p.notes ?? null,
      });
      const newId = Number(result.lastInsertRowid);
      insertSource.run(newId, c.source, c.source_ref, now(), c.raw_text, JSON.stringify(c.raw_meta ?? {}));
      created += 1;
    }

    run.finish({
      status: 'success',
      summary: `Fetched ${candidates.length} raw candidates, processed ${processed}, added ${created} new investor candidates for review.`,
      itemsProcessed: processed,
      itemsCreated: created,
    });
  } catch (err) {
    run.finish({
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      itemsProcessed: processed,
      itemsCreated: created,
    });
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runInvestorEnricher().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
