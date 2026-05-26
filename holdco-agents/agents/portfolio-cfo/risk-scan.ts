import { startRun } from '../../shared/agent-runner.js';
import { db, now } from '../../shared/db/client.js';

const DAY = 86_400;

type AlertRow = { deal_id: number | null; severity: 'info' | 'warn' | 'critical'; category: string; message: string };

export async function runRiskScan(): Promise<void> {
  const run = startRun('portfolio-cfo');
  const alerts: AlertRow[] = [];

  try {
    const t = now();

    // 1. Stale outreach: matches queued > 5 days, not approved
    const staleQueued = db().prepare(`
      SELECT m.id, m.deal_id, d.title, m.queued_at, i.name AS investor_name
      FROM matches m
      JOIN deals d ON d.id = m.deal_id
      JOIN investors i ON i.id = m.investor_id
      WHERE m.status = 'queued' AND m.queued_at < ?
    `).all(t - 5 * DAY) as Array<{ deal_id: number; title: string; investor_name: string }>;
    for (const r of staleQueued) {
      alerts.push({
        deal_id: r.deal_id,
        severity: 'warn',
        category: 'stale-outreach',
        message: `Outreach draft to ${r.investor_name} for "${r.title}" has been awaiting approval > 5 days.`,
      });
    }

    // 2. Sent outreach with no response > 14 days
    const noResponse = db().prepare(`
      SELECT m.id, m.deal_id, d.title, m.sent_at, i.name AS investor_name
      FROM matches m
      JOIN deals d ON d.id = m.deal_id
      JOIN investors i ON i.id = m.investor_id
      WHERE m.status = 'sent' AND m.sent_at < ? AND m.response_at IS NULL
    `).all(t - 14 * DAY) as Array<{ deal_id: number; title: string; investor_name: string }>;
    for (const r of noResponse) {
      alerts.push({
        deal_id: r.deal_id,
        severity: 'info',
        category: 'lender-silent',
        message: `${r.investor_name} no response on "${r.title}" after 14d. Consider follow-up.`,
      });
    }

    // 3. Drafted loan applications > 7 days, not submitted
    const staleApps = db().prepare(`
      SELECT la.id, la.deal_id, d.title, la.created_at, l.name AS lender
      FROM loan_applications la
      JOIN deals d ON d.id = la.deal_id
      JOIN lenders l ON l.id = la.lender_id
      WHERE la.status = 'drafted' AND la.created_at < ?
    `).all(t - 7 * DAY) as Array<{ deal_id: number; title: string; lender: string }>;
    for (const r of staleApps) {
      alerts.push({
        deal_id: r.deal_id,
        severity: 'warn',
        category: 'diligence-overdue',
        message: `Loan application to ${r.lender} for "${r.title}" drafted > 7 days, not submitted.`,
      });
    }

    // 4. Funding gap: deals in funding/diligence where committed funding < 100% of asking
    const fundingGaps = db().prepare(`
      SELECT d.id AS deal_id, d.title, d.asking_price, COALESCE(SUM(f.amount), 0) AS committed
      FROM deals d
      LEFT JOIN funding_stack f ON f.deal_id = d.id AND f.status IN ('committed', 'term-sheet', 'funded')
      WHERE d.status IN ('funding', 'diligence') AND d.asking_price IS NOT NULL
      GROUP BY d.id
    `).all() as Array<{ deal_id: number; title: string; asking_price: number; committed: number }>;
    for (const r of fundingGaps) {
      const gap = r.asking_price - r.committed;
      if (gap > r.asking_price * 0.05) {       // > 5% short
        alerts.push({
          deal_id: r.deal_id,
          severity: gap > r.asking_price * 0.25 ? 'critical' : 'warn',
          category: 'funding-gap',
          message: `"${r.title}" funding gap: $${(gap / 100).toLocaleString()} (${Math.round(gap / r.asking_price * 100)}% of asking).`,
        });
      }
    }

    // 5. Pricing drift: deals in diligence > 30 days
    const stuckDiligence = db().prepare(`
      SELECT d.id AS deal_id, d.title, MAX(la.created_at) AS last_activity
      FROM deals d
      LEFT JOIN loan_applications la ON la.deal_id = d.id
      WHERE d.status = 'diligence'
      GROUP BY d.id
      HAVING last_activity < ? OR last_activity IS NULL
    `).all(t - 30 * DAY) as Array<{ deal_id: number; title: string }>;
    for (const r of stuckDiligence) {
      alerts.push({
        deal_id: r.deal_id,
        severity: 'warn',
        category: 'pricing-drift',
        message: `"${r.title}" in diligence > 30 days. Pricing or terms may have drifted.`,
      });
    }

    // De-dupe against existing unresolved alerts (same deal+category+message)
    const existing = db().prepare(`
      SELECT deal_id, category, message FROM risk_alerts WHERE resolved_at IS NULL
    `).all() as Array<{ deal_id: number | null; category: string; message: string }>;
    const existingKeys = new Set(existing.map((e) => `${e.deal_id ?? ''}|${e.category}|${e.message}`));

    const insertStmt = db().prepare(`
      INSERT INTO risk_alerts (deal_id, severity, category, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    let created = 0;
    for (const a of alerts) {
      const k = `${a.deal_id ?? ''}|${a.category}|${a.message}`;
      if (existingKeys.has(k)) continue;
      insertStmt.run(a.deal_id, a.severity, a.category, a.message, t);
      created += 1;
    }

    run.finish({
      status: 'success',
      summary: `Scanned. ${alerts.length} alerts evaluated, ${created} new.`,
      itemsProcessed: alerts.length,
      itemsCreated: created,
    });
  } catch (err) {
    run.finish({ status: 'failed', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
