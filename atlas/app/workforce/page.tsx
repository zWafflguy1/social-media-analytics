"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";

interface Employee {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  team: string | null;
  enrolled: boolean;
  consent_at: string | null;
  device_count: number;
}
interface Policy {
  capture_content: boolean;
  excluded_categories: string[];
  excluded_apps: string[];
  active_hours: string | null;
  retention_days: number;
}
interface SOP {
  id: string;
  title: string;
  role: string | null;
  steps: string[];
  rationale: string | null;
  source: string;
  status: string;
}

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [sops, setSops] = useState<SOP[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");

  async function loadAll() {
    try {
      const [emps, pol, sl] = await Promise.all([
        api<{ employees: Employee[] }>("/api/employees"),
        api<Policy>("/api/monitoring/policy"),
        api<{ sops: SOP[] }>("/api/sops"),
      ]);
      setEmployees(emps.employees);
      setPolicy(pol);
      setSops(sl.sops);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    loadAll();
  }, []);

  async function addEmployee() {
    if (!newName.trim()) return;
    await api("/api/employees", { method: "POST", body: JSON.stringify({ name: newName, role: newRole }) });
    setNewName("");
    setNewRole("");
    await loadAll();
  }
  async function recordConsent(id: string) {
    await api("/api/employees", {
      method: "POST",
      body: JSON.stringify({ id, enrolled: true, consent: true, consent_method: "policy_ack" }),
    });
    await loadAll();
  }
  async function enrollDevice(id: string) {
    try {
      const r = await api<{ deviceId: string; agentKey: string }>("/api/endpoint/enroll", {
        method: "POST",
        body: JSON.stringify({ employeeId: id, label: "Work computer" }),
      });
      alert(
        `Device enrolled.\n\nDevice ID: ${r.deviceId}\nAgent key (shown once — paste into the desktop agent):\n\n${r.agentKey}`
      );
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function toggleContent() {
    if (!policy) return;
    const next = !policy.capture_content;
    if (next && !confirm("Capture screen/keystroke CONTENT? Most jurisdictions require explicit employee notice & consent. Only enable if you have it.")) return;
    await api("/api/monitoring/policy", {
      method: "PUT",
      body: JSON.stringify({ ...policy, capture_content: next }),
    });
    await loadAll();
  }
  async function mineSOPs() {
    try {
      const r = await api<{ proposed: number }>("/api/sops/mine", { method: "POST", body: "{}" });
      alert(`Mined ${r.proposed} proposed SOP(s) from observed work.`);
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function setStatus(id: string, status: string) {
    await api("/api/sops", { method: "POST", body: JSON.stringify({ id, status }) });
    await loadAll();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Workforce</h1>
      <p className="mt-1 text-sm text-slate-400">
        Endpoint activity, efficiency, and the company&apos;s standard operating
        procedures.
      </p>

      {/* Compliance banner — transparency is the default posture. */}
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <strong>Consent-based monitoring.</strong> Activity is captured only for
        employees who are enrolled <em>and</em> have recorded consent. Capture is
        metadata-only by default (no keystrokes/screenshots), with sensitive
        categories excluded. Most jurisdictions legally require notifying
        employees — keep your monitoring policy disclosed.
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* ─── Monitoring policy ─── */}
      {policy && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Monitoring policy</h2>
          <div className="mt-3 card space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Capture content (keystrokes / screen text)</div>
                <div className="text-xs text-slate-400">Off = metadata only (recommended &amp; privacy-protective).</div>
              </div>
              <button className="btn" onClick={toggleContent}>
                {policy.capture_content ? "On — turn off" : "Off — turn on"}
              </button>
            </div>
            <div className="text-xs text-slate-400">
              Excluded categories: {policy.excluded_categories.join(", ") || "none"} · Retention: {policy.retention_days} days
              {policy.active_hours && <> · Active hours: {policy.active_hours}</>}
            </div>
          </div>
        </section>
      )}

      {/* ─── Employees ─── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Employees</h2>
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="input" placeholder="Role" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <button className="btn shrink-0" onClick={addEmployee}>Add</button>
        </div>
        <div className="mt-3 space-y-2">
          {employees.map((e) => (
            <div key={e.id} className="card flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{e.name} {e.role && <span className="text-xs text-slate-400">· {e.role}</span>}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {e.consent_at ? (
                    <span className="text-emerald-300">consented {new Date(e.consent_at).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-amber-300">no consent on file</span>
                  )}
                  {" · "}{e.device_count} device(s)
                </div>
              </div>
              <div className="flex gap-2">
                {!e.consent_at && (
                  <button className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5" onClick={() => recordConsent(e.id)}>
                    Record consent
                  </button>
                )}
                <button
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
                  disabled={!e.consent_at}
                  onClick={() => enrollDevice(e.id)}
                >
                  Enroll device
                </button>
              </div>
            </div>
          ))}
          {employees.length === 0 && <div className="card text-sm text-slate-400">No employees yet.</div>}
        </div>
      </section>

      {/* ─── SOPs ─── */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Standard operating procedures</h2>
          <button className="btn" onClick={mineSOPs}>Mine from work</button>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Tribal knowledge, captured. Mined SOPs arrive as “proposed” — confirm to standardize.
        </p>
        <div className="mt-3 space-y-3">
          {sops.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {s.title} {s.role && <span className="text-xs text-slate-400">· {s.role}</span>}
                </div>
                <span className={`rounded px-2 py-0.5 text-xs ${s.status === "active" ? "bg-emerald-500/20 text-emerald-300" : s.status === "proposed" ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-slate-400"}`}>
                  {s.status}{s.source === "inferred" ? " · AI" : ""}
                </span>
              </div>
              {s.steps?.length > 0 && (
                <ol className="mt-2 list-decimal pl-5 text-sm text-slate-300">
                  {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              )}
              {s.rationale && <p className="mt-2 text-xs text-slate-500">Why: {s.rationale}</p>}
              <div className="mt-3 flex gap-2">
                {s.status === "proposed" && (
                  <button className="btn" onClick={() => setStatus(s.id, "active")}>Confirm</button>
                )}
                {s.status !== "archived" && (
                  <button className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/5" onClick={() => setStatus(s.id, "archived")}>
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
          {sops.length === 0 && <div className="card text-sm text-slate-400">No SOPs yet. Add activity/data, then “Mine from work”.</div>}
        </div>
      </section>
    </div>
  );
}
