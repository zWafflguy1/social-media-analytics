import Link from 'next/link';
import { db } from '../../../shared/db/client.js';
import type { Investor } from '../../../shared/types.js';

export const dynamic = 'force-dynamic';

export default function InvestorsPage() {
  const list = db().prepare(`SELECT * FROM investors WHERE status = 'active' ORDER BY created_at DESC`).all() as Investor[];
  const candidateCount = (db().prepare(`SELECT COUNT(*) AS c FROM investors WHERE status = 'candidate'`).get() as { c: number }).c;
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Investors CRM</h1>
        <Link href="/investors/candidates" className="text-sm">
          {candidateCount} candidate{candidateCount === 1 ? '' : 's'} awaiting review →
        </Link>
      </div>
      <p className="text-sm text-[var(--muted)] mb-6">
        {list.length} active investors. Drop a CSV at <code>data/investors.csv</code> and run <code>npm run db:seed</code> to import.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-[var(--muted)] border-b border-[var(--border)]">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Sectors</th>
            <th className="py-2 pr-4">Check</th>
            <th className="py-2 pr-4">Geo</th>
            <th className="py-2 pr-4">Contact</th>
            <th className="py-2 pr-4">Last touched</th>
          </tr>
        </thead>
        <tbody>
          {list.map((i) => (
            <tr key={i.id} className="border-b border-[var(--border)]/40">
              <td className="py-2 pr-4 font-semibold">{i.name}</td>
              <td className="py-2 pr-4 text-xs">{i.type}</td>
              <td className="py-2 pr-4 text-xs">{i.focus_sectors}</td>
              <td className="py-2 pr-4 text-xs font-mono">
                {i.check_size_min && i.check_size_max
                  ? `$${(i.check_size_min/100/1000).toFixed(0)}k–$${(i.check_size_max/100/1000).toFixed(0)}k`
                  : '—'}
              </td>
              <td className="py-2 pr-4 text-xs">{i.geography}</td>
              <td className="py-2 pr-4 text-xs">{i.contact_email ?? <span className="text-[var(--muted)]">no email</span>}</td>
              <td className="py-2 pr-4 text-xs text-[var(--muted)]">
                {i.last_contacted_at ? new Date(i.last_contacted_at * 1000).toLocaleDateString() : 'never'}
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">No investors yet. See README for CSV format.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
