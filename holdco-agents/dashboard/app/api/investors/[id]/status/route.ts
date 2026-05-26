import { NextResponse } from 'next/server';
import { db } from '../../../../../../shared/db/client.js';

const ALLOWED = new Set(['active', 'candidate', 'archived']);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  let body: { status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.status || !ALLOWED.has(body.status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });

  const res = db().prepare(`UPDATE investors SET status = ? WHERE id = ?`).run(body.status, id);
  if (res.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
