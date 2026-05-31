"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";

interface Brief {
  id: string;
  kind: string;
  period: string;
  content: string;
  created_at: string;
}

export default function Overview() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ briefs: Brief[] }>("/api/brief");
      setBriefs(data.briefs);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate(kind: "weekly" | "quarterly") {
    setLoading(true);
    setError(null);
    try {
      await api("/api/brief", { method: "POST", body: JSON.stringify({ kind }) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="mt-1 text-sm text-slate-400">
        Your business&apos;s institutional memory, working for you.
      </p>

      <div className="mt-6 flex gap-3">
        <button className="btn" disabled={loading} onClick={() => generate("weekly")}>
          {loading ? "Generating…" : "Generate weekly brief"}
        </button>
        <button className="btn" disabled={loading} onClick={() => generate("quarterly")}>
          Quarterly review
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 space-y-4">
        {briefs.length === 0 && (
          <div className="card text-sm text-slate-400">
            No briefs yet. Ingest events, run enrichment, then generate a brief.
          </div>
        )}
        {briefs.map((b) => (
          <div key={b.id} className="card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-accent">
                {b.kind} · {b.period}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(b.created_at).toLocaleString()}
              </span>
            </div>
            <div className="prose-atlas">{b.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
