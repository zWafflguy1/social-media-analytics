import { db } from '../../../shared/db/client.js';
import type { Lender, LoanApplication } from '../../../shared/types.js';

export const dynamic = 'force-dynamic';

type LoanRow = LoanApplication & { lender_name: string; deal_title: string };

export default function LendersPage() {
  const lenders = db().prepare(`SELECT * FROM lenders ORDER BY sba_preferred DESC, name`).all() as Lender[];
  const apps = db().prepare(`
    SELECT la.*, l.name AS lender_name, d.title AS deal_title
    FROM loan_applications la
    JOIN lenders l ON l.id = la.lender_id
    JOIN deals d ON d.id = la.deal_id
    ORDER BY la.created_at DESC LIMIT 50
  `).all() as LoanRow[];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Active loan applications</h1>
        <p className="text-sm text-[var(--muted)] mb-4">Drafts and live applications across all lenders.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--muted)] border-b border-[var(--border)]">
              <th className="py-2 pr-4">Deal</th>
              <th className="py-2 pr-4">Lender</th>
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4 text-right">Requested</th>
              <th className="py-2 pr-4 text-right">Fit</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-b border-[var(--border)]/40">
                <td className="py-2 pr-4">{a.deal_title}</td>
                <td className="py-2 pr-4">{a.lender_name}</td>
                <td className="py-2 pr-4 text-xs font-mono">{a.product}</td>
                <td className="py-2 pr-4 text-xs">{a.status}</td>
                <td className="py-2 pr-4 text-right font-mono text-xs">{a.requested_amount ? `$${(a.requested_amount/100).toLocaleString()}` : '—'}</td>
                <td className="py-2 pr-4 text-right font-mono text-xs">{a.fit_score ?? '—'}</td>
                <td className="py-2 pr-4 text-xs text-[var(--muted)]">{new Date(a.created_at * 1000).toLocaleDateString()}</td>
              </tr>
            ))}
            {apps.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">No applications yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Lender library ({lenders.length})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--muted)] border-b border-[var(--border)]">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Products</th>
              <th className="py-2 pr-4">Range</th>
              <th className="py-2 pr-4">Geo</th>
              <th className="py-2 pr-4">Rate</th>
            </tr>
          </thead>
          <tbody>
            {lenders.map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)]/40">
                <td className="py-2 pr-4 font-semibold">
                  {l.name}{l.sba_preferred ? <span className="ml-1.5 text-[10px] px-1 bg-blue-100 text-blue-700 rounded">SBA-PLP</span> : null}
                </td>
                <td className="py-2 pr-4 text-xs">{l.type}</td>
                <td className="py-2 pr-4 text-xs font-mono">{l.products}</td>
                <td className="py-2 pr-4 text-xs font-mono">
                  {l.min_loan ? `$${(l.min_loan/100/1000).toFixed(0)}k` : '?'}–{l.max_loan ? `$${(l.max_loan/100/1_000_000).toFixed(1)}M` : '?'}
                </td>
                <td className="py-2 pr-4 text-xs">{l.geography}</td>
                <td className="py-2 pr-4 text-xs">{l.typical_rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
