import { db } from '../../../shared/db/client.js';
import OutreachActions from './actions.js';

export const dynamic = 'force-dynamic';

type Row = {
  id: number;
  deal_id: number;
  investor_id: number;
  match_score: number;
  match_reasoning: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  status: string;
  queued_at: number;
  approved_at: number | null;
  sent_at: number | null;
  deal_title: string;
  deal_score: number | null;
  investor_name: string;
  investor_email: string | null;
};

export default function OutreachPage() {
  const queued = db().prepare(`
    SELECT m.*, d.title AS deal_title, d.score AS deal_score, i.name AS investor_name, i.contact_email AS investor_email
    FROM matches m
    JOIN deals d ON d.id = m.deal_id
    JOIN investors i ON i.id = m.investor_id
    WHERE m.status = 'queued'
    ORDER BY m.match_score DESC, m.queued_at ASC
    LIMIT 100
  `).all() as Row[];

  const recent = db().prepare(`
    SELECT m.*, d.title AS deal_title, d.score AS deal_score, i.name AS investor_name, i.contact_email AS investor_email
    FROM matches m
    JOIN deals d ON d.id = m.deal_id
    JOIN investors i ON i.id = m.investor_id
    WHERE m.status IN ('approved','sent','responded','rejected')
    ORDER BY COALESCE(m.sent_at, m.approved_at, m.queued_at) DESC
    LIMIT 25
  `).all() as Row[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Outreach queue</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{queued.length} drafts awaiting your approval. Review the body before sending — agents draft, you ship.</p>
      </div>

      {queued.length === 0 ? (
        <div className="text-sm text-[var(--muted)] py-12 text-center border border-dashed border-[var(--border)] rounded">
          No drafts in queue.
        </div>
      ) : (
        <div className="space-y-4">
          {queued.map((m) => (
            <div key={m.id} className="border border-[var(--border)] rounded bg-white">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--muted)]">to {m.investor_name}{m.investor_email ? ` <${m.investor_email}>` : ''}</div>
                  <div className="font-semibold mt-0.5">{m.draft_subject || '(no subject)'}</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-[var(--muted)]">Deal #{m.deal_id} · {m.deal_title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">{m.match_score}</span>
                </div>
              </div>
              {m.match_reasoning && (
                <div className="px-4 py-2 text-xs text-[var(--muted)] bg-[#f6f8fa] border-b border-[var(--border)]">
                  <strong>Match rationale:</strong> {m.match_reasoning}
                </div>
              )}
              <div className="px-4 py-3">
                <pre className="text-sm whitespace-pre-wrap font-sans">{m.draft_body}</pre>
              </div>
              <OutreachActions matchId={m.id} hasEmail={!!m.investor_email} />
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">Recently actioned</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Deal</th>
              <th className="py-2 pr-4">Investor</th>
              <th className="py-2 pr-4">When</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)]/40">
                <td className="py-2 pr-4 text-xs">{r.status}</td>
                <td className="py-2 pr-4">{r.deal_title}</td>
                <td className="py-2 pr-4">{r.investor_name}</td>
                <td className="py-2 pr-4 text-xs text-[var(--muted)]">{new Date(((r.sent_at ?? r.approved_at ?? r.queued_at) * 1000)).toLocaleString()}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-[var(--muted)] text-sm">No actioned outreach yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
