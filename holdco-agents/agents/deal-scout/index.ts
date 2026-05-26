import { startRun } from '../../shared/agent-runner.js';
import { db, now } from '../../shared/db/client.js';
import { scoreDeal } from './score.js';
import { scrapeBizBuySell } from './sources/bizbuysell.js';
import { scrapeBizQuest } from './sources/bizquest.js';
import { scrapeFlippa } from './sources/flippa.js';
import { scrapeEmpireFlippers } from './sources/empire-flippers.js';
import { ingestBrokerInbox } from './sources/broker-inbox.js';
import { scanSocialSignals } from './sources/social-signals.js';

export type RawListing = {
  source: string;
  source_ref: string;
  source_url?: string;
  title: string;
  description?: string;
  industry?: string;
  location?: string;
  asking_price?: number;     // cents
  sde?: number;
  ebitda?: number;
  revenue?: number;
  cash_flow?: number;
  employees?: number;
  established_year?: number;
  reason_for_sale?: string;
  posted_at?: number;
  raw?: Record<string, unknown>;
};

const EV_MIN = Number(process.env.TARGET_EV_MIN ?? 1_000_000) * 100;
const EV_MAX = Number(process.env.TARGET_EV_MAX ?? 10_000_000) * 100;

export async function runDealScout(): Promise<void> {
  const run = startRun('deal-scout');
  let processed = 0;
  let created = 0;
  let scoringErrors = 0;

  try {
    const sources: Array<() => Promise<RawListing[]>> = [
      scrapeBizBuySell,
      scrapeBizQuest,
      scrapeFlippa,
      scrapeEmpireFlippers,
      ingestBrokerInbox,
      scanSocialSignals,
    ];

    const allListings: RawListing[] = [];
    for (const fn of sources) {
      try {
        const listings = await fn();
        allListings.push(...listings);
      } catch (err) {
        console.error(`[deal-scout] source ${fn.name} failed:`, err);
      }
    }

    const insertStmt = db().prepare(`
      INSERT INTO deals (
        source, source_ref, source_url, title, description, industry, location,
        asking_price, sde, ebitda, revenue, cash_flow, employees, established_year,
        reason_for_sale, posted_at, scraped_at, raw, status
      ) VALUES (
        @source, @source_ref, @source_url, @title, @description, @industry, @location,
        @asking_price, @sde, @ebitda, @revenue, @cash_flow, @employees, @established_year,
        @reason_for_sale, @posted_at, @scraped_at, @raw, 'sourced'
      )
      ON CONFLICT(source, source_ref) DO NOTHING
    `);

    const updateScoreStmt = db().prepare(`
      UPDATE deals SET score = ?, score_reasoning = ?, absentee_signal = ?, status = ?
      WHERE id = ?
    `);

    for (const listing of allListings) {
      processed += 1;

      // Pre-filter on price band to save LLM tokens
      if (listing.asking_price && (listing.asking_price < EV_MIN || listing.asking_price > EV_MAX * 1.5)) {
        continue;
      }

      const result = insertStmt.run({
        source: listing.source,
        source_ref: listing.source_ref,
        source_url: listing.source_url ?? null,
        title: listing.title,
        description: listing.description ?? null,
        industry: listing.industry ?? null,
        location: listing.location ?? null,
        asking_price: listing.asking_price ?? null,
        sde: listing.sde ?? null,
        ebitda: listing.ebitda ?? null,
        revenue: listing.revenue ?? null,
        cash_flow: listing.cash_flow ?? null,
        employees: listing.employees ?? null,
        established_year: listing.established_year ?? null,
        reason_for_sale: listing.reason_for_sale ?? null,
        posted_at: listing.posted_at ?? null,
        scraped_at: now(),
        raw: listing.raw ? JSON.stringify(listing.raw) : null,
      });

      if (result.changes === 0) continue;            // duplicate, skip
      created += 1;
      const dealId = Number(result.lastInsertRowid);

      try {
        const { score, reasoning, absenteeSignal, usage } = await scoreDeal(listing);
        run.recordUsage('default', usage);
        const newStatus = score >= 70 ? 'qualified' : 'scored';
        updateScoreStmt.run(score, reasoning, absenteeSignal ? 1 : 0, newStatus, dealId);
      } catch (err) {
        scoringErrors += 1;
        console.error(`[deal-scout] scoring failed for deal ${dealId}:`, err);
      }
    }

    run.finish({
      status: 'success',
      summary: `Processed ${processed} listings, created ${created} new deals, ${scoringErrors} scoring errors.`,
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

// Allow `npm run scout` to invoke directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runDealScout().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
