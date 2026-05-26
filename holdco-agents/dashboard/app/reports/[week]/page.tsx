import { db } from '../../../../shared/db/client.js';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ReportDetail({ params }: { params: { week: string } }) {
  const r = db().prepare(`SELECT html, week_of FROM weekly_reports WHERE week_of = ?`).get(params.week) as { html: string; week_of: string } | undefined;
  if (!r) notFound();
  return (
    <div>
      <div className="mb-4 text-sm text-[var(--muted)]">Week of {r.week_of}</div>
      <div className="border border-[var(--border)] rounded bg-white" dangerouslySetInnerHTML={{ __html: r.html }} />
    </div>
  );
}
