import { db } from '../../../../shared/db/client.js';
import CandidateActions from './actions.js';
import type { Investor } from '../../../../shared/types.js';

export const dynamic = 'force-dynamic';

type CandidateRow = Investor & { source_count: number };

export default function CandidatesPage() {
  const candidates = db().prepare(`
    SELECT i.*, COUNT(s.id) AS source_count
    FROM investors i
    LEFT JOIN investor_enrichment_sources s ON s.investor_id = i.id
    WHERE i.status = 'candidate'
    GROUP BY i.id
    ORDER BY i.confidence DESC NULLS LAST, i.created_at DESC
  `).all() as CandidateRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Investor candidates</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {candidates.length} prospects from SEC Form D filings and news. Review each, promote
            the good ones to your active CRM.
          </p>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-sm text-[var(--muted)] py-12 text-center border border-dashed border-[var(--border)] rounded">
          No candidates yet. Run <code>npm run enrich</code> or trigger investor-enricher from the Agents page.
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <div key={c.id} className="border border-[var(--border)] rounded bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-semibold">{c.name}</div>
                    {c.confidence != null && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                        c.confidence >= 80 ? 'bg-green-100 text-green-700' :
                        c.confidence >= 60 ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{c.confidence}</span>
                    )}
                    <span className="text-[10px] uppercase font-mono text-[var(--muted)] tracking-wider">{c.origin}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {c.type && <span>{c.type}</span>}
                    {c.focus_sectors && <span> · {c.focus_sectors}</span>}
                    {c.geography && <span> · {c.geography}</span>}
                  </div>
                  {c.thesis && <div className="text-sm mt-2">{c.thesis}</div>}
                  {(c.check_size_min || c.check_size_max) && (
                    <div className="text-xs mt-1.5 font-mono">
                      Check size: ${c.check_size_min ? (c.check_size_min/100/1000).toFixed(0) + 'k' : '?'}–${c.check_size_max ? (c.check_size_max/100/1_000_000).toFixed(1) + 'M' : '?'}
                    </div>
                  )}
                  {c.notes && <div className="text-xs text-[var(--muted)] mt-2">{c.notes}</div>}
                  <div className="text-xs mt-2 text-[var(--muted)]">
                    {c.source_count} source{c.source_count === 1 ? '' : 's'} ·{' '}
                    {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer">view source ↗</a>}
                  </div>
                </div>
                <CandidateActions investorId={c.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
