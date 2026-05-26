import { startRun } from '../../shared/agent-runner.js';
import { db, now } from '../../shared/db/client.js';
import { ask } from '../../shared/llm/claude.js';
import { sendEmail } from '../../shared/email/resend.js';

const WEEK = 7 * 86_400;

type Metrics = {
  week_of: string;
  deals_scouted: number;
  deals_qualified: number;
  matches_queued: number;
  matches_sent: number;
  matches_responded: number;
  applications_drafted: number;
  applications_submitted: number;
  applications_offered: number;
  funding_committed_cents: number;
  active_pipeline: number;
  open_alerts: number;
  critical_alerts: number;
  agent_cost_cents: number;
  top_deals: Array<{ id: number; title: string; score: number | null; status: string; asking: number | null }>;
  prior_week: { deals_scouted: number; matches_sent: number; applications_drafted: number } | null;
};

export async function generateAndSendWeeklyReport(): Promise<void> {
  const run = startRun('portfolio-cfo');

  try {
    const t = now();
    const monday = mondayOf(new Date(t * 1000));
    const weekStart = Math.floor(monday.getTime() / 1000);
    const prevWeekStart = weekStart - WEEK;

    const m = collectMetrics(weekStart, prevWeekStart);

    const narrative = await composeNarrative(m);
    run.recordUsage('default', narrative.usage);

    const html = renderHtml(m, narrative.text);
    const weekOfIso = monday.toISOString().slice(0, 10);

    // Persist report row
    const upsert = db().prepare(`
      INSERT INTO weekly_reports (week_of, generated_at, html, metrics_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(week_of) DO UPDATE SET
        generated_at = excluded.generated_at,
        html = excluded.html,
        metrics_json = excluded.metrics_json
    `);
    upsert.run(weekOfIso, t, html, JSON.stringify(m));

    // Send email
    const to = process.env.REPORT_TO_EMAIL;
    if (to) {
      const send = await sendEmail({
        to,
        subject: `HoldCo Weekly Report — week of ${weekOfIso}`,
        html,
      });
      const updateSent = db().prepare(`
        UPDATE weekly_reports SET sent_at = ?, send_error = ? WHERE week_of = ?
      `);
      updateSent.run(send.error ? null : t, send.error, weekOfIso);
    }

    run.finish({
      status: 'success',
      summary: `Generated report for week of ${weekOfIso}.`,
      itemsCreated: 1,
    });
  } catch (err) {
    run.finish({ status: 'failed', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay() || 7;             // Sun=0 → 7
  x.setUTCDate(x.getUTCDate() - (day - 1));
  return x;
}

function collectMetrics(weekStart: number, prevWeekStart: number): Metrics {
  const weekEnd = weekStart + WEEK;
  const get = <T>(sql: string, params: unknown[] = []): T => db().prepare(sql).get(...params) as T;
  const all = <T>(sql: string, params: unknown[] = []): T[] => db().prepare(sql).all(...params) as T[];

  const dealsScouted = get<{ c: number }>(`SELECT COUNT(*) AS c FROM deals WHERE scraped_at >= ? AND scraped_at < ?`, [weekStart, weekEnd]).c;
  const dealsQualified = get<{ c: number }>(`SELECT COUNT(*) AS c FROM deals WHERE status = 'qualified' AND scraped_at >= ? AND scraped_at < ?`, [weekStart, weekEnd]).c;
  const matchesQueued = get<{ c: number }>(`SELECT COUNT(*) AS c FROM matches WHERE queued_at >= ? AND queued_at < ?`, [weekStart, weekEnd]).c;
  const matchesSent = get<{ c: number }>(`SELECT COUNT(*) AS c FROM matches WHERE sent_at >= ? AND sent_at < ?`, [weekStart, weekEnd]).c;
  const matchesResponded = get<{ c: number }>(`SELECT COUNT(*) AS c FROM matches WHERE response_at >= ? AND response_at < ?`, [weekStart, weekEnd]).c;
  const appsDrafted = get<{ c: number }>(`SELECT COUNT(*) AS c FROM loan_applications WHERE created_at >= ? AND created_at < ?`, [weekStart, weekEnd]).c;
  const appsSubmitted = get<{ c: number }>(`SELECT COUNT(*) AS c FROM loan_applications WHERE submitted_at >= ? AND submitted_at < ?`, [weekStart, weekEnd]).c;
  const appsOffered = get<{ c: number }>(`SELECT COUNT(*) AS c FROM loan_applications WHERE status = 'offered' AND decision_at >= ? AND decision_at < ?`, [weekStart, weekEnd]).c;
  const fundingCommitted = get<{ s: number | null }>(`SELECT SUM(amount) AS s FROM funding_stack WHERE status IN ('committed','funded') AND created_at >= ? AND created_at < ?`, [weekStart, weekEnd]).s ?? 0;
  const activePipeline = get<{ c: number }>(`SELECT COUNT(*) AS c FROM deals WHERE status IN ('qualified','matching','funding','diligence')`).c;
  const openAlerts = get<{ c: number }>(`SELECT COUNT(*) AS c FROM risk_alerts WHERE resolved_at IS NULL`).c;
  const criticalAlerts = get<{ c: number }>(`SELECT COUNT(*) AS c FROM risk_alerts WHERE resolved_at IS NULL AND severity = 'critical'`).c;
  const agentCost = get<{ s: number | null }>(`SELECT SUM(cost_cents) AS s FROM agent_runs WHERE started_at >= ? AND started_at < ?`, [weekStart, weekEnd]).s ?? 0;

  const topDeals = all<{ id: number; title: string; score: number | null; status: string; asking_price: number | null }>(
    `SELECT id, title, score, status, asking_price FROM deals
     WHERE scraped_at >= ? AND scraped_at < ?
     ORDER BY score DESC NULLS LAST LIMIT 10`,
    [weekStart, weekEnd]
  ).map((d) => ({ id: d.id, title: d.title, score: d.score, status: d.status, asking: d.asking_price }));

  const prior = {
    deals_scouted: get<{ c: number }>(`SELECT COUNT(*) AS c FROM deals WHERE scraped_at >= ? AND scraped_at < ?`, [prevWeekStart, weekStart]).c,
    matches_sent: get<{ c: number }>(`SELECT COUNT(*) AS c FROM matches WHERE sent_at >= ? AND sent_at < ?`, [prevWeekStart, weekStart]).c,
    applications_drafted: get<{ c: number }>(`SELECT COUNT(*) AS c FROM loan_applications WHERE created_at >= ? AND created_at < ?`, [prevWeekStart, weekStart]).c,
  };

  return {
    week_of: new Date(weekStart * 1000).toISOString().slice(0, 10),
    deals_scouted: dealsScouted,
    deals_qualified: dealsQualified,
    matches_queued: matchesQueued,
    matches_sent: matchesSent,
    matches_responded: matchesResponded,
    applications_drafted: appsDrafted,
    applications_submitted: appsSubmitted,
    applications_offered: appsOffered,
    funding_committed_cents: fundingCommitted,
    active_pipeline: activePipeline,
    open_alerts: openAlerts,
    critical_alerts: criticalAlerts,
    agent_cost_cents: agentCost,
    top_deals: topDeals,
    prior_week: prior,
  };
}

async function composeNarrative(m: Metrics): Promise<{ text: string; usage: ReturnType<typeof ask> extends Promise<infer R> ? (R extends { usage: infer U } ? U : never) : never }> {
  const { text, usage } = await ask({
    system: `You write the executive-summary section of a holding company's weekly portfolio
report. Audience: a single principal who needs to make decisions Monday morning. Be terse,
concrete, and prioritized. Open with the single most important thing. Use plain language.
No emoji. No headers — just 2-4 short paragraphs. End with a "What needs your decision this
week:" bullet list (max 4 items).`,
    user: `Metrics for week of ${m.week_of}:\n${JSON.stringify(m, null, 2)}\n\nWrite the narrative.`,
    tier: 'default',
    maxTokens: 800,
  });
  return { text, usage };
}

function renderHtml(m: Metrics, narrative: string): string {
  const delta = (cur: number, prev: number | undefined): string => {
    if (prev == null) return '';
    const d = cur - prev;
    if (d === 0) return ' <span style="color:#888">(flat)</span>';
    return d > 0
      ? ` <span style="color:#1a7f37">▲ ${d}</span>`
      : ` <span style="color:#c93c37">▼ ${Math.abs(d)}</span>`;
  };
  const money = (c: number) => `$${(c / 100).toLocaleString()}`;
  const narrativeHtml = narrative.split(/\n\n+/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');

  const topDealsRows = m.top_deals.map((d) => `
    <tr>
      <td>${d.id}</td>
      <td>${escapeHtml(d.title)}</td>
      <td style="text-align:right">${d.score ?? '—'}</td>
      <td>${escapeHtml(d.status)}</td>
      <td style="text-align:right">${d.asking ? money(d.asking) : '—'}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2328; max-width: 720px; margin: 24px auto; line-height: 1.5; padding: 0 16px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.subtitle { color: #6e7681; margin: 0 0 24px; font-size: 13px; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0 24px; }
.kpi { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 12px; }
.kpi .label { font-size: 11px; color: #6e7681; text-transform: uppercase; letter-spacing: 0.5px; }
.kpi .value { font-size: 22px; font-weight: 600; margin-top: 4px; }
h2 { font-size: 16px; border-bottom: 1px solid #d0d7de; padding-bottom: 4px; margin-top: 28px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eaeef2; }
th { background: #f6f8fa; font-weight: 600; }
.alert-critical { color: #c93c37; font-weight: 600; }
.footer { color: #6e7681; font-size: 11px; margin-top: 32px; padding-top: 12px; border-top: 1px solid #d0d7de; }
</style></head><body>

<h1>HoldCo Weekly Report</h1>
<div class="subtitle">Week of ${m.week_of} · Generated ${new Date().toUTCString()}</div>

<div class="kpis">
  <div class="kpi"><div class="label">Deals scouted</div><div class="value">${m.deals_scouted}${delta(m.deals_scouted, m.prior_week?.deals_scouted)}</div></div>
  <div class="kpi"><div class="label">Qualified (≥70)</div><div class="value">${m.deals_qualified}</div></div>
  <div class="kpi"><div class="label">Active pipeline</div><div class="value">${m.active_pipeline}</div></div>
  <div class="kpi"><div class="label">Outreach sent</div><div class="value">${m.matches_sent}${delta(m.matches_sent, m.prior_week?.matches_sent)}</div></div>
  <div class="kpi"><div class="label">Investor responses</div><div class="value">${m.matches_responded}</div></div>
  <div class="kpi"><div class="label">Loan apps drafted</div><div class="value">${m.applications_drafted}${delta(m.applications_drafted, m.prior_week?.applications_drafted)}</div></div>
  <div class="kpi"><div class="label">Loan apps submitted</div><div class="value">${m.applications_submitted}</div></div>
  <div class="kpi"><div class="label">Offers received</div><div class="value">${m.applications_offered}</div></div>
  <div class="kpi"><div class="label">Open risk alerts</div><div class="value ${m.critical_alerts > 0 ? 'alert-critical' : ''}">${m.open_alerts}${m.critical_alerts > 0 ? ` (${m.critical_alerts} crit)` : ''}</div></div>
</div>

<h2>Summary</h2>
${narrativeHtml}

<h2>Top scouted deals this week</h2>
<table>
<thead><tr><th>#</th><th>Title</th><th style="text-align:right">Score</th><th>Status</th><th style="text-align:right">Asking</th></tr></thead>
<tbody>${topDealsRows || `<tr><td colspan="5" style="text-align:center;color:#6e7681">No new deals this week</td></tr>`}</tbody>
</table>

<div class="footer">
  Agent cost this week: ${money(m.agent_cost_cents)} · Full dashboard at http://localhost:3000
</div>

</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateAndSendWeeklyReport().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
