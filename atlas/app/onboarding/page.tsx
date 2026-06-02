"use client";

import { useState } from "react";
import { api } from "@/components/api";

export default function OnboardingPage() {
  const [role, setRole] = useState("");
  const [focus, setFocus] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim()) return;
    setLoading(true);
    setError(null);
    setContent(null);
    try {
      const data = await api<{ content: string }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({ role, focus }),
      });
      setContent(data.content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Onboarding brief</h1>
      <p className="mt-1 text-sm text-slate-400">
        Get a new hire instantly in sync. Atlas builds a role-specific brief from
        the company&apos;s own history — accounts, norms, decisions, first-week plan.
      </p>

      <form onSubmit={generate} className="mt-6 space-y-3">
        <input
          className="input"
          placeholder="Role (e.g. Account Executive, Support Lead)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <input
          className="input"
          placeholder="Focus areas (optional, e.g. enterprise renewals)"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
        />
        <button className="btn" disabled={loading}>
          {loading ? "Building brief…" : "Generate onboarding brief"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {content && (
        <div className="mt-8 card">
          <div className="prose-atlas">{content}</div>
        </div>
      )}
    </div>
  );
}
