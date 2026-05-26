'use client';
import { useState } from 'react';

export default function CandidateActions({ investorId }: { investorId: number }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function call(status: 'active' | 'archived') {
    setBusy(status);
    try {
      const r = await fetch(`/api/investors/${investorId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'failed');
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      <button
        onClick={() => call('active')}
        disabled={busy !== null}
        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {busy === 'active' ? '…' : 'Promote to active'}
      </button>
      <button
        onClick={() => call('archived')}
        disabled={busy !== null}
        className="px-3 py-1.5 text-xs bg-white border border-[var(--border)] rounded text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy === 'archived' ? '…' : 'Archive'}
      </button>
    </div>
  );
}
