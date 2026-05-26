import { NextResponse } from 'next/server';
import { db, now } from '../../../../../../shared/db/client.js';
import { sendEmail } from '../../../../../../shared/email/resend.js';

export async function POST(_req: Request, { params }: { params: { id: string; action: string } }) {
  const id = Number(params.id);
  const action = params.action;
  if (!id || !['approve', 'reject', 'send'].includes(action)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const m = db().prepare(`
    SELECT m.*, i.contact_email AS investor_email, i.name AS investor_name
    FROM matches m JOIN investors i ON i.id = m.investor_id
    WHERE m.id = ?
  `).get(id) as { investor_email: string | null; draft_subject: string | null; draft_body: string | null; status: string } | undefined;
  if (!m) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const t = now();

  if (action === 'reject') {
    db().prepare(`UPDATE matches SET status = 'rejected', approved_at = ?, approved_by = 'dashboard' WHERE id = ?`).run(t, id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    db().prepare(`UPDATE matches SET status = 'approved', approved_at = ?, approved_by = 'dashboard' WHERE id = ?`).run(t, id);
    return NextResponse.json({ ok: true });
  }

  // action === 'send'
  if (!m.investor_email) return NextResponse.json({ error: 'investor has no email on file' }, { status: 400 });
  if (!m.draft_subject || !m.draft_body) return NextResponse.json({ error: 'draft incomplete' }, { status: 400 });

  const sendResult = await sendEmail({
    to: m.investor_email,
    subject: m.draft_subject,
    html: m.draft_body.replace(/\n/g, '<br>'),
    text: m.draft_body,
  });

  if (sendResult.error) {
    return NextResponse.json({ error: sendResult.error }, { status: 502 });
  }

  db().prepare(`
    UPDATE matches
    SET status = 'sent', approved_at = ?, approved_by = 'dashboard', sent_at = ?
    WHERE id = ?
  `).run(t, t, id);
  db().prepare(`UPDATE investors SET last_contacted_at = ? WHERE id = (SELECT investor_id FROM matches WHERE id = ?)`).run(t, id);

  return NextResponse.json({ ok: true, sent_id: sendResult.id });
}
