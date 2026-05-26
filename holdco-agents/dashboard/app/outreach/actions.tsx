'use client';
import { useState } from 'react';

export default function OutreachActions({ matchId, hasEmail }: { matchId: number; hasEmail: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(action: 'approve' | 'reject' | 'send') {
    setBusy(action);
    setMsg(null);
    try {
      const r = await fetch(`/api/outreach/${matchId}/${action}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Unknown error');
      setMsg(j.ok ? `Done — ${action}` : 'Failed');
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[#f6f8fa] flex items-center gap-2">
      <button
        onClick={() => call('approve')}
        disabled={busy !== null}
        className="px-3 py-1.5 text-sm bg-white border border-[var(--border)] rounded hover:bg-slate-50 disabled:opacity-50"
      >
        {busy === 'approve' ? '…' : 'Approve'}
      </button>
      <button
        onClick={() => call('send')}
        disabled={busy !== null || !hasEmail}
        title={hasEmail ? 'Send via Resend' : 'No investor email on file'}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {busy === 'send' ? '…' : 'Approve & Send'}
      </button>
      <button
        onClick={() => call('reject')}
        disabled={busy !== null}
        className="px-3 py-1.5 text-sm bg-white border border-[var(--border)] rounded hover:bg-red-50 text-red-700 disabled:opacity-50"
      >
        {busy === 'reject' ? '…' : 'Reject'}
      </button>
      {msg && <span className="text-xs text-[var(--muted)] ml-2">{msg}</span>}
    </div>
  );
}
