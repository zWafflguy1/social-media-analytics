import { db } from '../../../shared/db/client.js';
import AgentRunButton from './run-button.js';

export const dynamic = 'force-dynamic';

type Run = { id: number; agent_name: string; started_at: number; finished_at: number | null; status: string; summary: string | null; error: string | null; items_processed: number; items_created: number; cost_cents: number };

const AGENTS = ['deal-scout', 'capital-matcher', 'debt-architect', 'risk-scan', 'weekly-report'];

export default function AgentsPage() {
  const runs = db().prepare(`SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 50`).all() as Run[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Agents</h1>
        <p className="text-sm text-[var(--muted)]">Trigger agents manually or review their run history. The scheduler runs them automatically per the cron config in <code>.env</code>.</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {AGENTS.map((a) => <AgentRunButton key={a} name={a} />)}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Run history</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--muted)] border-b border-[var(--border)]">
              <th className="py-2 pr-4">Agent</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Started</th>
              <th className="py-2 pr-4">Duration</th>
              <th className="py-2 pr-4 text-right">Proc / Created</th>
              <th className="py-2 pr-4 text-right">Cost</th>
              <th className="py-2 pr-4">Summary</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const dur = r.finished_at ? `${r.finished_at - r.started_at}s` : '…';
              return (
                <tr key={r.id} className="border-b border-[var(--border)]/40 align-top">
                  <td className="py-2 pr-4 font-mono text-xs">{r.agent_name}</td>
                  <td className={`py-2 pr-4 text-xs ${r.status === 'failed' ? 'text-red-600' : r.status === 'success' ? 'text-green-700' : 'text-amber-600'}`}>{r.status}</td>
                  <td className="py-2 pr-4 text-xs text-[var(--muted)]">{new Date(r.started_at * 1000).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-xs font-mono">{dur}</td>
                  <td className="py-2 pr-4 text-xs text-right font-mono">{r.items_processed} / {r.items_created}</td>
                  <td className="py-2 pr-4 text-xs text-right font-mono">${(r.cost_cents / 100).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-xs">{r.error ? <span className="text-red-600">{r.error}</span> : r.summary}</td>
                </tr>
              );
            })}
            {runs.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[var(--muted)]">No runs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
