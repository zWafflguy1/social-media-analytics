import { startRun } from '../../shared/agent-runner.js';
import { db, now } from '../../shared/db/client.js';
import type { Deal, Investor } from '../../shared/types.js';
import { scoreMatch } from './match.js';
import { draftOutreach } from './draft.js';

const MIN_DEAL_SCORE = Number(process.env.MIN_DEAL_SCORE_FOR_MATCH ?? 70);
const MAX_MATCHES_PER_DEAL = 5;

export async function runCapitalMatcher(): Promise<void> {
  const run = startRun('capital-matcher');
  let processed = 0, created = 0;

  try {
    // Find qualified deals that haven't been fully matched yet.
    const deals = db().prepare(`
      SELECT * FROM deals
      WHERE status IN ('qualified', 'matching')
        AND score >= ?
        AND id NOT IN (
          SELECT deal_id FROM matches GROUP BY deal_id HAVING COUNT(*) >= ?
        )
      ORDER BY score DESC
      LIMIT 25
    `).all(MIN_DEAL_SCORE, MAX_MATCHES_PER_DEAL) as Deal[];

    if (deals.length === 0) {
      run.finish({ status: 'success', summary: 'No qualified deals awaiting matching.' });
      return;
    }

    const investors = db().prepare(`SELECT * FROM investors WHERE status = 'active'`).all() as Investor[];
    if (investors.length === 0) {
      run.finish({
        status: 'success',
        summary: 'No investors in CRM yet. Run npm run db:seed or add via dashboard.',
      });
      return;
    }

    const insertMatch = db().prepare(`
      INSERT INTO matches (deal_id, investor_id, match_score, match_reasoning,
                           draft_subject, draft_body, status, queued_at)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
      ON CONFLICT(deal_id, investor_id) DO NOTHING
    `);
    const setDealStatus = db().prepare(`UPDATE deals SET status = ? WHERE id = ?`);

    for (const deal of deals) {
      processed += 1;

      // Existing matches for this deal
      const existing = db().prepare(`SELECT investor_id FROM matches WHERE deal_id = ?`)
        .all(deal.id) as { investor_id: number }[];
      const excluded = new Set(existing.map((r) => r.investor_id));
      const candidates = investors.filter((i) => !excluded.has(i.id));

      // Score each candidate
      const scored: Array<{ investor: Investor; score: number; reasoning: string }> = [];
      for (const inv of candidates) {
        const { score, reasoning, usage } = await scoreMatch(deal, inv);
        run.recordUsage('default', usage);
        if (score >= 50) scored.push({ investor: inv, score, reasoning });
      }
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, MAX_MATCHES_PER_DEAL - existing.length);

      for (const { investor, score, reasoning } of top) {
        const { subject, body, usage } = await draftOutreach(deal, investor, reasoning);
        run.recordUsage('default', usage);
        const res = insertMatch.run(deal.id, investor.id, score, reasoning, subject, body, now());
        if (res.changes > 0) created += 1;
      }

      setDealStatus.run('matching', deal.id);
    }

    run.finish({
      status: 'success',
      summary: `Reviewed ${processed} deals, queued ${created} new outreach drafts.`,
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
  runCapitalMatcher().then(() => process.exit(0)).catch((e) => {
    console.error(e); process.exit(1);
  });
}
