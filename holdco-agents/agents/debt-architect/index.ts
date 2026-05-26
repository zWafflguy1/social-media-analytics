import { startRun } from '../../shared/agent-runner.js';
import { db, now } from '../../shared/db/client.js';
import type { Deal, Lender } from '../../shared/types.js';
import { rankLenders } from './research.js';
import { buildApplicationPackage } from './application-pack.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_LENDERS_PER_DEAL = 3;
const APPLICATIONS_DIR = resolve('./data/applications');

export async function runDebtArchitect(): Promise<void> {
  const run = startRun('debt-architect');
  let processed = 0, created = 0;

  try {
    // Operate on deals that are qualified or matching but lack drafted loan apps.
    const deals = db().prepare(`
      SELECT d.* FROM deals d
      WHERE d.status IN ('qualified', 'matching', 'funding')
        AND d.score >= 70
        AND NOT EXISTS (SELECT 1 FROM loan_applications la WHERE la.deal_id = d.id)
      ORDER BY d.score DESC
      LIMIT 15
    `).all() as Deal[];

    if (deals.length === 0) {
      run.finish({ status: 'success', summary: 'No deals awaiting loan packaging.' });
      return;
    }

    const lenders = db().prepare(`SELECT * FROM lenders`).all() as Lender[];
    if (lenders.length === 0) {
      run.finish({
        status: 'success',
        summary: 'No lenders seeded. Run npm run db:seed.',
      });
      return;
    }

    mkdirSync(APPLICATIONS_DIR, { recursive: true });

    const insertApp = db().prepare(`
      INSERT INTO loan_applications
        (deal_id, lender_id, product, requested_amount, term_months, fit_score, fit_reasoning,
         package_md, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'drafted', ?)
      ON CONFLICT(deal_id, lender_id, product) DO NOTHING
    `);

    for (const deal of deals) {
      processed += 1;

      const ranked = await rankLenders(deal, lenders);
      run.recordUsage('default', ranked.usage);
      const top = ranked.ranked.slice(0, MAX_LENDERS_PER_DEAL);

      for (const r of top) {
        const lender = lenders.find((l) => l.id === r.lender_id);
        if (!lender) continue;

        const { md, requestedAmount, termMonths, usage } = await buildApplicationPackage(deal, lender, r.product);
        run.recordUsage('heavy', usage);

        const fileName = `deal-${deal.id}-lender-${lender.id}-${r.product}.md`.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const filePath = resolve(APPLICATIONS_DIR, fileName);
        writeFileSync(filePath, md, 'utf8');

        const res = insertApp.run(
          deal.id, lender.id, r.product,
          requestedAmount, termMonths,
          r.fit_score, r.fit_reasoning,
          md, now()
        );
        if (res.changes > 0) created += 1;
      }
    }

    run.finish({
      status: 'success',
      summary: `Reviewed ${processed} deals, drafted ${created} loan application packages.`,
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
  runDebtArchitect().then(() => process.exit(0)).catch((e) => {
    console.error(e); process.exit(1);
  });
}
