"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/api";

interface CatalogTool {
  source: string;
  name: string;
  category: string;
  description: string;
  authKind: string;
  provides: string[];
  ready: boolean;
  fields: { key: string; label: string; secret?: boolean; required?: boolean; help?: string }[];
}
interface Connection {
  source: string;
  display_name: string;
  enabled: boolean;
  config: Record<string, string>;
  secret_keys: string[];
  last_synced_at: string | null;
  last_status: string | null;
  event_count: number;
  event_types: string[];
  last_event_at: string | null;
}
interface Stats {
  totals: { total: number; enriched: number; pending: number; last_event_at: string | null };
  by_source: { source: string; count: number }[];
  by_sensitivity: { sensitivity: string; count: number }[];
  by_type: { type: string; count: number }[];
}

export default function DataInputsPage() {
  const [tools, setTools] = useState<CatalogTool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [configuring, setConfiguring] = useState<CatalogTool | null>(null);

  async function loadAll() {
    try {
      const [cat, conns, st] = await Promise.all([
        api<{ categories: string[]; tools: CatalogTool[] }>("/api/catalog"),
        api<{ connections: Connection[] }>("/api/connectors/accounts"),
        api<Stats>("/api/inputs/stats"),
      ]);
      setTools(cat.tools);
      setCategories(cat.categories);
      setConnections(conns.connections);
      setStats(st);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    loadAll();
  }, []);

  const connectedSources = useMemo(
    () => new Set(connections.map((c) => c.source)),
    [connections]
  );

  async function toggle(source: string, enabled: boolean) {
    setBusy(source);
    try {
      await api(`/api/connectors/accounts/${source}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function disconnect(source: string) {
    if (!confirm(`Disconnect ${source}? Ingested data is kept; the connection is removed.`)) return;
    setBusy(source);
    try {
      await api(`/api/connectors/accounts/${source}`, { method: "DELETE" });
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function syncNow(source: string) {
    setBusy(source);
    try {
      const r = await api<{ accepted?: number }>(`/api/connectors/accounts/${source}`, { method: "POST" });
      await loadAll();
      alert(r.accepted != null ? `Synced — ${r.accepted} new events.` : "Sync triggered.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const filtered = tools.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Data Inputs</h1>
      <p className="mt-1 text-sm text-slate-400">
        Manage what the company brain ingests — connect tools, see what each is
        providing, and pause or remove any source.
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* ─── Capture summary ─── */}
      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total events" value={stats.totals.total} />
          <Stat label="Enriched" value={stats.totals.enriched} />
          <Stat label="Pending" value={stats.totals.pending} />
          <Stat label="Connected sources" value={connections.length} />
        </div>
      )}
      {stats && stats.by_sensitivity.length > 0 && (
        <div className="mt-3 card">
          <div className="text-xs uppercase tracking-wide text-slate-400">Data by sensitivity</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {stats.by_sensitivity.map((s) => (
              <span key={s.sensitivity} className="rounded bg-white/10 px-2 py-1 text-xs">
                {s.sensitivity}: <span className="font-medium">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Connected sources ─── */}
      <h2 className="mt-10 text-lg font-semibold">Connected sources</h2>
      <div className="mt-3 space-y-3">
        {connections.length === 0 && (
          <div className="card text-sm text-slate-400">
            No sources connected yet. Add one from the catalog below.
          </div>
        )}
        {connections.map((c) => (
          <div key={c.source} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {c.display_name}{" "}
                  <span className={`ml-2 rounded px-2 py-0.5 text-xs ${c.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-400"}`}>
                    {c.enabled ? "active" : "paused"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {c.event_count} events
                  {c.event_types?.length > 0 && <> · {c.event_types.slice(0, 4).join(", ")}</>}
                  {c.last_synced_at && <> · last sync {new Date(c.last_synced_at).toLocaleString()} ({c.last_status})</>}
                  {c.secret_keys?.length > 0 && <> · 🔑 {c.secret_keys.length} secret(s) set</>}
                </div>
              </div>
              <div className="flex gap-2">
                <SmallBtn disabled={busy === c.source} onClick={() => syncNow(c.source)}>Sync now</SmallBtn>
                <SmallBtn disabled={busy === c.source} onClick={() => toggle(c.source, !c.enabled)}>
                  {c.enabled ? "Pause" : "Resume"}
                </SmallBtn>
                <SmallBtn disabled={busy === c.source} onClick={() => disconnect(c.source)} danger>
                  Disconnect
                </SmallBtn>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Catalog: connect a new source ─── */}
      <h2 className="mt-10 text-lg font-semibold">Connect a tool</h2>
      <p className="mt-1 text-sm text-slate-400">
        {tools.length} integrations. Anything not listed can connect via the
        Generic Webhook or Custom API under “Custom”.
      </p>
      <input
        className="input mt-3"
        placeholder="Search tools or categories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-4 space-y-6">
        {categories.map((cat) => {
          const inCat = filtered.filter((t) => t.category === cat);
          if (inCat.length === 0) return null;
          return (
            <div key={cat}>
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">{cat}</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {inCat.map((t) => (
                  <button
                    key={t.source}
                    onClick={() => setConfiguring(t)}
                    className="card text-left hover:border-accent"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.name}</span>
                      {connectedSources.has(t.source) ? (
                        <span className="text-xs text-emerald-300">connected</span>
                      ) : t.ready ? (
                        <span className="text-xs text-slate-500">ready</span>
                      ) : (
                        <span className="text-xs text-slate-600">via webhook</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {configuring && (
        <ConfigModal
          tool={configuring}
          existing={connections.find((c) => c.source === configuring.source)}
          onClose={() => setConfiguring(null)}
          onSaved={async () => {
            setConfiguring(null);
            await loadAll();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function SmallBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50 ${
        danger ? "border-red-500/40 text-red-300 hover:bg-red-500/10" : "border-white/20 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function ConfigModal({
  tool,
  existing,
  onClose,
  onSaved,
}: {
  tool: CatalogTool;
  existing?: Connection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const secrets: Record<string, string> = {};
      const config: Record<string, string> = {};
      for (const f of tool.fields) {
        const v = values[f.key];
        if (v == null || v === "") continue;
        if (f.secret) secrets[f.key] = v;
        else config[f.key] = v;
      }
      await api("/api/connectors/accounts", {
        method: "POST",
        body: JSON.stringify({ source: tool.source, display_name: tool.name, config, secrets }),
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/connectors/${tool.source}/webhook` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{existing ? "Reconfigure" : "Connect"} {tool.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <p className="mt-1 text-sm text-slate-400">{tool.description}</p>
        <div className="mt-2 text-xs text-slate-500">
          Auth: {tool.authKind} · Provides: {tool.provides.join(", ")}
        </div>

        {(tool.authKind === "hmac_webhook" || tool.authKind === "token") && (
          <div className="mt-3 rounded-lg bg-ink p-3 text-xs text-slate-400">
            <div className="font-medium text-slate-300">Webhook URL</div>
            <code className="break-all">{webhookUrl}</code>
            <div className="mt-1">Point {tool.name} here and include your token/secret as configured below.</div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {tool.fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-slate-300">
                {f.label} {f.required && <span className="text-red-400">*</span>}
                {existing?.secret_keys?.includes(f.key) && f.secret && (
                  <span className="ml-2 text-emerald-300">(already set — leave blank to keep)</span>
                )}
              </label>
              <input
                className="input mt-1"
                type={f.secret ? "password" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.help ?? ""}
              />
              {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
            </div>
          ))}
          {tool.fields.length === 0 && (
            <p className="text-sm text-slate-400">No credentials needed.</p>
          )}
        </div>

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <SmallBtn onClick={onClose}>Cancel</SmallBtn>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : existing ? "Update connection" : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
