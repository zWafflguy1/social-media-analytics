import { queryOne } from "../db";

export interface MonitoringPolicy {
  capture_content: boolean;
  captured_categories: string[];
  excluded_apps: string[];
  excluded_categories: string[];
  active_hours: string | null;
  retention_days: number;
}

const DEFAULT_POLICY: MonitoringPolicy = {
  capture_content: false, // metadata only by default — no keystrokes/screenshots
  captured_categories: [],
  excluded_apps: [],
  excluded_categories: ["personal", "banking", "health", "personal_messaging"],
  active_hours: null,
  retention_days: 90,
};

export async function getPolicy(tenantId: string): Promise<MonitoringPolicy> {
  const row = await queryOne<MonitoringPolicy>(
    `SELECT capture_content, captured_categories, excluded_apps,
            excluded_categories, active_hours, retention_days
       FROM monitoring_policies WHERE tenant_id=$1`,
    [tenantId]
  );
  return row ?? DEFAULT_POLICY;
}

export interface RawActivity {
  occurred_at?: string;
  category?: string; // e.g. crm, email, docs, dev, design, personal, banking
  app?: string;
  title?: string;
  action?: string; // focus | edit | task_complete | ...
  task?: string;
  duration_s?: number;
  content?: string; // only stored if policy.capture_content
}

export interface PolicyDecision {
  keep: boolean;
  reason?: string;
}

/** Apply the policy to one activity record: exclusions, active hours, scope. */
export function evaluate(policy: MonitoringPolicy, a: RawActivity): PolicyDecision {
  const cat = (a.category ?? "").toLowerCase();
  const app = (a.app ?? "").toLowerCase();

  if (cat && policy.excluded_categories.map((c) => c.toLowerCase()).includes(cat)) {
    return { keep: false, reason: `excluded category: ${cat}` };
  }
  if (app && policy.excluded_apps.map((x) => x.toLowerCase()).includes(app)) {
    return { keep: false, reason: `excluded app: ${app}` };
  }
  if (
    policy.captured_categories.length > 0 &&
    cat &&
    !policy.captured_categories.map((c) => c.toLowerCase()).includes(cat)
  ) {
    return { keep: false, reason: `category not in capture scope: ${cat}` };
  }
  if (policy.active_hours && !withinHours(policy.active_hours, a.occurred_at)) {
    return { keep: false, reason: "outside active hours" };
  }
  return { keep: true };
}

function withinHours(range: string, iso?: string): boolean {
  const m = range.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return true;
  const d = iso ? new Date(iso) : new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return mins >= start && mins <= end;
}

/** Strip content unless the policy explicitly allows it. */
export function minimize(policy: MonitoringPolicy, a: RawActivity): RawActivity {
  if (policy.capture_content) return a;
  const { content, ...rest } = a;
  return rest;
}
