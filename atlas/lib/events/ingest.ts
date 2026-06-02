import { nanoid } from "nanoid";
import { query, queryOne } from "../db";
import { audit } from "../audit";
import { redact } from "../pii";
import { checkConsent } from "../consent";
import { type EventInput } from "./schema";

export interface IngestResult {
  status: "accepted" | "duplicate" | "rejected";
  eventId?: string;
  reason?: string;
  redactions?: Record<string, number>;
}

/**
 * The single entry point for Layer 1. Enforces the consent gate, redacts PII at
 * the edge, dedupes, and persists a normalized event in `pending` status for
 * the enrichment worker to pick up.
 */
export async function ingestEvent(
  tenantId: string,
  ev: EventInput,
  source: string
): Promise<IngestResult> {
  // 1. Consent gate — refuse non-consented recordings before anything is stored.
  const consent = checkConsent(ev);
  if (!consent.allowed) {
    await audit(tenantId, `connector:${source}`, "event.rejected", undefined, {
      reason: consent.reason,
      type: ev.type,
    });
    return { status: "rejected", reason: consent.reason };
  }

  // 2. Dedupe via connector-supplied idempotency key.
  if (ev.dedupe_key) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM events WHERE tenant_id = $1 AND dedupe_key = $2`,
      [tenantId, ev.dedupe_key]
    );
    if (existing) return { status: "duplicate", eventId: existing.id };
  }

  // 3. Redact PII at the edge — the stored body never contains raw PII.
  const subject = redact(ev.subject);
  const body = redact(ev.body);
  const redactions = mergeCounts(subject.found, body.found);

  const id = `evt_${nanoid(16)}`;
  await query(
    `INSERT INTO events
       (id, tenant_id, source, type, occurred_at, subject, body, actors,
        metrics, links, sensitivity, raw_ref, dedupe_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')`,
    [
      id,
      tenantId,
      source,
      ev.type,
      ev.occurred_at,
      subject.text || null,
      body.text || null,
      JSON.stringify(ev.actors),
      JSON.stringify(ev.metrics),
      JSON.stringify(ev.links),
      ev.sensitivity,
      ev.raw_ref ?? null,
      ev.dedupe_key ?? null,
    ]
  );

  await audit(tenantId, `connector:${source}`, "event.ingested", id, {
    type: ev.type,
    redactions,
  });

  return { status: "accepted", eventId: id, redactions };
}

function mergeCounts(a: Record<string, number>, b: Record<string, number>) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}
