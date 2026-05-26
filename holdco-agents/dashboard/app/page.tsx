import { db } from '../../shared/db/client.js';

export const dynamic = 'force-dynamic';

type Counts = { c: number };
type Run = { id: number; agent_name: string; started_at: number; status: string; summary: string | null; cost_cents: number };
type Alert = { id: number; severity: string; message: string; created_at: number };

export default function Overview() {
  const d = db();
  const total = (d.prepare(`SELECT COUNT(*) AS c FROM deals`).get() as Counts).c;
  const qualified = (d.prepare(`SELECT COUNT(*) AS c FROM deals WHERE status IN ('qualified','matching','funding','diligence')`).get() as Counts).c;
  const queuedOutreach = (d.prepare(`SELECT COUNT(*) AS c FROM matches WHERE status = 'queued'`).get() as Counts).c;
  const draftedApps = (d.prepare(`SELECT COUNT(*) AS c FROM loan_applications WHERE status = 'drafted'`).get() as Counts).c;
  const openAlerts = (d.prepare(`SELECT COUNT(*) AS c FROM risk_alerts WHERE resolved_at IS NULL`).get() as Counts).c;
  const recentRuns = d.prepare(`SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 8`).all() as Run[];
  const criticalAlerts = d.prepare(`SELECT * FROM risk_alerts WHERE resolved_at IS NULL ORDER BY severity DESC, created_at DESC LIMIT 5`).all() as Alert[];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid grid-cols-5 gap-3">
        <Kpi label="Total deals" value={total} />
        <Kpi label="Active pipeline" value={qualified} />
        <Kpi label="Outreach awaiting approval" value={queuedOutreach} highlight={queuedOutreach > 0} />
        <Kpi label="Loan apps drafted" value={draftedApps} />
        <Kpi label="Open risk alerts" value={openAlerts} highlight={openAlerts > 0} warn />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Open risk alerts</h2>
        {criticalAlerts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None — all clear.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {criticalAlerts.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  a.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  a.severity === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                }`}>{a.severity}</span>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Recent agent runs</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
              <th className="py-2 pr-4">Agent</th>
              <th className="py-2 pr-4">Started</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Summary</th>
              <th className="py-2 pr-4 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {recentRuns.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)]/40">
                <td className="py-2 pr-4 font-mono text-xs">{r.agent_name}</td>
                <td className="py-2 pr-4 text-[var(--muted)] text-xs">{new Date(r.started_at * 1000).toLocaleString()}</td>
                <td className={`py-2 pr-4 text-xs ${r.status === 'failed' ? 'text-red-600' : r.status === 'success' ? 'text-green-700' : ''}`}>{r.status}</td>
                <td className="py-2 pr-4">{r.summary ?? '—'}</td>
                <td className="py-2 pr-4 text-right font-mono text-xs">${(r.cost_cents / 100).toFixed(2)}</td>
              </tr>
            ))}
            {recentRuns.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-[var(--muted)]">No agent runs yet. Try <code>npm run scout</code>.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value, highlight, warn }: { label: string; value: number; highlight?: boolean; warn?: boolean }) {
  return (
    <div className={`p-3 rounded border ${highlight && warn ? 'border-red-300 bg-red-50' : highlight ? 'border-blue-300 bg-blue-50' : 'border-[var(--border)] bg-[#f6f8fa]'}`}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
