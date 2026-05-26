'use client';
import { useState } from 'react';

export default function AgentRunButton({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/agents/${name}/run`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'failed');
      setMsg('Started — refresh in ~30s to see results.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-[var(--border)] rounded p-3 bg-white">
      <div className="font-mono text-xs mb-2">{name}</div>
      <button
        onClick={run}
        disabled={busy}
        className="w-full px-2 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Run now'}
      </button>
      {msg && <div className="mt-2 text-[10px] text-[var(--muted)]">{msg}</div>}
    </div>
  );
}
