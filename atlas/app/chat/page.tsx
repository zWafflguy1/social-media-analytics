"use client";

import { useState } from "react";
import { api } from "@/components/api";

interface Citation {
  ref: number;
  event_id: string;
  source: string;
}

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const data = await api<{ answer: string; citations: Citation[] }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setAnswer(data.answer);
      setCitations(data.citations);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Ask Atlas</h1>
      <p className="mt-1 text-sm text-slate-400">
        Ask anything about the business. Answers are grounded in your own calls,
        emails, and decisions — with citations.
      </p>

      <form onSubmit={submit} className="mt-6 flex gap-3">
        <input
          className="input"
          placeholder="e.g. Why is Acme at risk this quarter?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="btn shrink-0" disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {answer && (
        <div className="mt-8 card">
          <div className="prose-atlas">{answer}</div>
          {citations.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">
              <span className="font-medium text-slate-300">Sources: </span>
              {citations.map((c) => (
                <span key={c.ref} className="mr-3">
                  [{c.ref}] {c.source} ({c.event_id.slice(0, 10)}…)
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
