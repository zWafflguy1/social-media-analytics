"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";

interface Action {
  id: string;
  tool: string;
  tier: number;
  args: Record<string, unknown>;
  rationale: string | null;
  evidence: string[];
  created_at: string;
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ pending: Action[] }>("/api/approvals");
      setPending(data.pending);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(actionId: string, decision: "approve" | "reject") {
    setBusy(actionId);
    try {
      await api("/api/approvals", {
        method: "POST",
        body: JSON.stringify({ actionId, decision }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Approval inbox</h1>
      <p className="mt-1 text-sm text-slate-400">
        Actions the agent wants to take that exceed its current autonomy ceiling.
        Approve, edit, or reject — rejections train future behavior.
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-4">
        {pending.length === 0 && (
          <div className="card text-sm text-slate-400">Nothing awaiting approval. 🎉</div>
        )}
        {pending.map((a) => (
          <div key={a.id} className="card">
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.tool}</span>
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs">Tier {a.tier}</span>
            </div>
            {a.rationale && <p className="mt-2 text-sm text-slate-300">{a.rationale}</p>}
            <pre className="mt-2 overflow-x-auto rounded bg-ink p-3 text-xs text-slate-400">
              {JSON.stringify(a.args, null, 2)}
            </pre>
            {a.evidence?.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Evidence: {a.evidence.join(", ")}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                className="btn"
                disabled={busy === a.id}
                onClick={() => decide(a.id, "approve")}
              >
                Approve & run
              </button>
              <button
                className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
                disabled={busy === a.id}
                onClick={() => decide(a.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
