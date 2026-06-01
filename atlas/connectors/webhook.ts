import { defineConnector, event, verifyToken } from "./base";

// Generic webhook connector — lets ANY tool feed the brain without a bespoke
// connector. The sender posts JSON (a single object or an array) to
// /api/connectors/webhook/webhook with the x-atlas-webhook-token header.
//
// It maps flexibly: it understands a normalized shape out of the box, and the
// connection's `config` can remap field names for arbitrary payloads, e.g.
//   config = { type: "thing.happened", body_field: "message", id_field: "uuid" }
interface AnyPayload {
  [k: string]: unknown;
}

function pick(obj: AnyPayload, key?: string): string | undefined {
  if (!key) return undefined;
  const v = obj[key];
  return v == null ? undefined : String(v);
}

export const webhookConnector = defineConnector<AnyPayload | AnyPayload[]>({
  source: "webhook",
  displayName: "Generic Webhook",
  auth: {
    kind: "api_key",
    fields: [{ key: "webhook_token", label: "Webhook verification token", secret: true, required: true }],
  },

  verify(ctx) {
    return verifyToken(
      ctx.raw?.headers.get("x-atlas-webhook-token") ?? null,
      ctx.secrets.webhook_token ?? ""
    );
  },

  map(payload, ctx) {
    const cfg = ctx.config;
    const items = Array.isArray(payload) ? payload : [payload];
    return items.map((item, i) => {
      const idField = cfg.id_field ?? "id";
      const id = pick(item, idField) ?? `${Date.now()}-${i}`;
      const occurred =
        pick(item, cfg.time_field ?? "occurred_at") ??
        pick(item, "timestamp") ??
        new Date().toISOString();
      return event({
        source: "webhook",
        type: pick(item, cfg.type_field ?? "type") ?? cfg.type ?? "webhook.received",
        id,
        occurredAt: occurred,
        subject: pick(item, cfg.subject_field ?? "subject"),
        body: pick(item, cfg.body_field ?? "body") ?? JSON.stringify(item).slice(0, 8000),
        sensitivity: (cfg.sensitivity as any) || "internal",
      });
    });
  },
});
