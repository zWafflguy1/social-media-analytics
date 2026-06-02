import { nanoid } from "nanoid";
import pgvector from "pgvector/pg";
import { query, queryOne, withTx } from "../db";
import { audit } from "../audit";
import { redact } from "../pii";
import { embed } from "../enrich/embed";
import { getPolicy, evaluate, minimize, type RawActivity } from "./policy";
import { type AuthedDevice } from "./devices";

export interface ActivityResult {
  status: "accepted" | "rejected";
  stored: number;
  dropped: number;
  reason?: string;
}

/**
 * Ingest a batch of activity from an authenticated device. Enforces, in order:
 *   1. CONSENT GATE — the employee must be enrolled AND have consented.
 *   2. POLICY — exclusions (apps/categories), active hours, capture scope.
 *   3. MINIMIZATION — content dropped unless policy.capture_content is true.
 *   4. REDACTION — any retained text passes the PII redactor.
 * Activity is stored as normalized events (source=endpoint) and indexed for
 * retrieval; per-activity efficiency metrics are recorded for analytics.
 */
export async function ingestActivity(
  device: AuthedDevice,
  items: RawActivity[]
): Promise<ActivityResult> {
  const { tenantId, employeeId } = device;

  // 1. Consent gate.
  const emp = await queryOne<{ enrolled: boolean; consent_at: string | null; role: string | null }>(
    `SELECT enrolled, consent_at, role FROM employees WHERE id=$1 AND tenant_id=$2`,
    [employeeId, tenantId]
  );
  if (!emp || !emp.enrolled || !emp.consent_at) {
    await audit(tenantId, `device:${device.deviceId}`, "activity.rejected", employeeId, {
      reason: "employee not enrolled/consented",
    });
    return { status: "rejected", stored: 0, dropped: items.length, reason: "no consent on file" };
  }

  const policy = await getPolicy(tenantId);
  let stored = 0;
  let dropped = 0;

  for (const raw of items) {
    // 2. Policy.
    const decision = evaluate(policy, raw);
    if (!decision.keep) {
      dropped++;
      continue;
    }
    // 3. Minimization.
    const a = minimize(policy, raw);

    // Build a compact, human-readable summary (this is what's retrievable).
    const summary = describe(a, emp.role);
    // 4. Redaction on any retained text.
    const body = redact(a.content ? `${summary}\n${a.content}` : summary).text;

    const eventId = `evt_${nanoid(16)}`;
    const vec = await embed(summary);
    await withTx(async (client) => {
      await client.query(
        `INSERT INTO events
           (id, tenant_id, source, type, occurred_at, subject, body, actors,
            metrics, links, sensitivity, status)
         VALUES ($1,$2,'endpoint',$3,$4,$5,$6,$7,$8,$9,'confidential','enriched')`,
        [
          eventId,
          tenantId,
          `activity.${a.action ?? "event"}`,
          a.occurred_at ?? new Date().toISOString(),
          a.task ?? a.app ?? "activity",
          body,
          JSON.stringify([{ id: employeeId, role: "employee" }]),
          JSON.stringify({ duration_s: a.duration_s ?? 0 }),
          JSON.stringify({ employee: employeeId }),
        ]
      );
      await client.query(
        `INSERT INTO enrichments (event_id, tenant_id, summary, topics)
         VALUES ($1,$2,$3,$4)`,
        [eventId, tenantId, summary, [a.category ?? "activity"]]
      );
      await client.query(
        `INSERT INTO embeddings (tenant_id, event_id, kind, content, embedding)
         VALUES ($1,$2,'summary',$3,$4)`,
        [tenantId, eventId, summary, pgvector.toSql(vec)]
      );
      if (a.duration_s) {
        await client.query(
          `INSERT INTO metrics (tenant_id, name, domain, value, unit, captured_at)
           VALUES ($1,$2,'workforce',$3,'minutes',$4)`,
          [tenantId, `time.${a.category ?? "other"}`, a.duration_s / 60, a.occurred_at ?? new Date().toISOString()]
        );
      }
    });
    stored++;
  }

  await audit(tenantId, `device:${device.deviceId}`, "activity.ingested", employeeId, {
    stored,
    dropped,
  });
  return { status: "accepted", stored, dropped };
}

function describe(a: RawActivity, role: string | null): string {
  const parts = [`${role ?? "Employee"} activity`];
  if (a.app) parts.push(`in ${a.app}`);
  if (a.category) parts.push(`(${a.category})`);
  if (a.action) parts.push(`— ${a.action}`);
  if (a.task) parts.push(`on task "${a.task}"`);
  if (a.duration_s) parts.push(`for ${Math.round(a.duration_s / 60)}m`);
  return parts.join(" ");
}
