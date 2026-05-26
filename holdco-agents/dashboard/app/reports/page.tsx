import Link from 'next/link';
import { db } from '../../../shared/db/client.js';

export const dynamic = 'force-dynamic';

type Report = { id: number; week_of: string; generated_at: number; sent_at: number | null; send_error: string | null };

export default function ReportsPage() {
  const reports = db().prepare(`SELECT id, week_of, generated_at, sent_at, send_error FROM weekly_reports ORDER BY week_of DESC LIMIT 26`).all() as Report[];
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Weekly reports</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Sent every Monday at 5 AM (server time) to {process.env.REPORT_TO_EMAIL ?? '—'}.</p>
      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id} className="border border-[var(--border)] rounded bg-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold"><Link href={`/reports/${r.week_of}`}>Week of {r.week_of}</Link></div>
              <div className="text-xs text-[var(--muted)]">
                Generated {new Date(r.generated_at * 1000).toLocaleString()}
                {r.sent_at && ` · Sent ${new Date(r.sent_at * 1000).toLocaleString()}`}
                {r.send_error && <span className="text-red-600"> · Send error: {r.send_error}</span>}
              </div>
            </div>
            <Link href={`/reports/${r.week_of}`} className="text-sm">View →</Link>
          </li>
        ))}
        {reports.length === 0 && <li className="text-sm text-[var(--muted)] py-8 text-center border border-dashed border-[var(--border)] rounded">No reports generated yet. Try <code>npm run report</code>.</li>}
      </ul>
    </div>
  );
}
