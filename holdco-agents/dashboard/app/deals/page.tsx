import { db } from '../../../shared/db/client.js';
import type { Deal } from '../../../shared/types.js';

export const dynamic = 'force-dynamic';

const COLUMNS: Array<{ status: Deal['status']; label: string }> = [
  { status: 'sourced',   label: 'Sourced' },
  { status: 'scored',    label: 'Scored' },
  { status: 'qualified', label: 'Qualified' },
  { status: 'matching',  label: 'Matching' },
  { status: 'funding',   label: 'Funding' },
  { status: 'diligence', label: 'Diligence' },
  { status: 'won',       label: 'Won' },
];

export default function DealsPage() {
  const deals = db().prepare(`SELECT * FROM deals WHERE status != 'dead' AND status != 'lost' ORDER BY score DESC NULLS LAST, scraped_at DESC LIMIT 500`).all() as Deal[];
  const byStatus = new Map<string, Deal[]>();
  for (const d of deals) {
    const arr = byStatus.get(d.status) ?? [];
    arr.push(d);
    byStatus.set(d.status, arr);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Deal pipeline</h1>
      <p className="text-sm text-[var(--muted)] mb-6">{deals.length} active deals. Sorted by score within each stage.</p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const items = byStatus.get(col.status) ?? [];
          return (
            <div key={col.status} className="min-w-[280px] w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{col.label}</div>
                <div className="text-xs text-[var(--muted)]">{items.length}</div>
              </div>
              <div className="space-y-2">
                {items.slice(0, 25).map((d) => (
                  <div key={d.id} className="border border-[var(--border)] bg-white rounded p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="font-semibold flex-1 leading-tight">{d.title}</div>
                      {d.score != null && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${
                          d.score >= 85 ? 'bg-green-100 text-green-700' :
                          d.score >= 70 ? 'bg-blue-100 text-blue-700' :
                          d.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>{d.score}</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      {d.industry && <span>{d.industry} · </span>}
                      {d.location}
                    </div>
                    {d.asking_price && (
                      <div className="text-xs mt-1">
                        <span className="text-[var(--muted)]">Asking:</span> ${(d.asking_price / 100).toLocaleString()}
                        {d.sde && <span className="text-[var(--muted)]"> · SDE ${(d.sde / 100).toLocaleString()}</span>}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2 text-xs">
                      <span className="text-[var(--muted)] font-mono">{d.source}</span>
                      {d.source_url && <a href={d.source_url} target="_blank" rel="noreferrer">source ↗</a>}
                    </div>
                    {d.score_reasoning && (
                      <details className="mt-2 text-xs text-[var(--muted)]">
                        <summary className="cursor-pointer">scoring</summary>
                        <p className="mt-1">{d.score_reasoning}</p>
                      </details>
                    )}
                  </div>
                ))}
                {items.length === 0 && <div className="text-xs text-[var(--muted)] italic">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
