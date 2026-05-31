/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONNECTOR TEMPLATE — copy this file, rename it, fill in the TODOs, then add
 * one line to connectors/index.ts. That's a full integration.
 *
 * You implement at most three functions:
 *   • map()    — turn a webhook payload into events            (push sources)
 *   • sync()   — pull new data since a cursor                  (poll sources)
 *   • verify() — authenticate inbound webhooks                 (push sources)
 *
 * The framework handles tenancy, routing, signature plumbing, PII redaction,
 * consent enforcement, dedupe, ingestion, cursors, retries, and audit logging.
 * You never touch the database.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { defineConnector, event, actor, verifyHmac } from "./base";

// 1. Describe the shape of the data you receive (helps you, not required).
interface MyPayload {
  id: string;
  happenedAt: string;
  text: string;
}

export const myConnector = defineConnector<MyPayload>({
  // 2. A stable id. Routes become /api/connectors/<source>/webhook and /sync.
  source: "my_source",
  displayName: "My Source",

  // 3. Declare what's needed to connect — the integration UI renders from this.
  auth: {
    kind: "hmac_webhook", // "oauth2" | "api_key" | "hmac_webhook" | "none"
    docsUrl: "https://example.com/docs",
    fields: [{ key: "signing_secret", label: "Signing secret", secret: true, required: true }],
  },

  // 4. PUSH sources: authenticate the webhook (omit for pull-only).
  verify(ctx) {
    return verifyHmac({
      body: ctx.raw?.body ?? "",
      signature: ctx.raw?.headers.get("x-signature") ?? null,
      secret: ctx.secrets.signing_secret ?? "",
    });
  },

  // 5. PUSH sources: map the raw payload to one or more normalized events.
  map(payload) {
    return [
      event({
        source: "my_source",
        type: "thing.happened", // your taxonomy: noun.verb
        id: payload.id, // source-native id → dedupe key (idempotent)
        occurredAt: payload.happenedAt,
        body: payload.text,
        actors: [actor.customer("Someone")],
        // sensitivity defaults to "internal"; set "confidential" for calls/emails.
      }),
    ];
  },

  // 6. PULL sources: fetch since ctx.cursor, return events + the next cursor.
  //    Delete this if your source pushes webhooks instead.
  async sync(ctx) {
    const since = ctx.cursor ?? "0";
    // const res = await fetch(`${ctx.config.base_url}/events?since=${since}`,
    //   { headers: { authorization: `Bearer ${ctx.secrets.api_key}` } });
    // const rows = await res.json();
    const rows: MyPayload[] = []; // TODO: fetch real data
    const events = rows.map((r) =>
      event({ source: "my_source", type: "thing.happened", id: r.id, occurredAt: r.happenedAt, body: r.text })
    );
    return { events, cursor: rows.at(-1)?.id ?? since };
  },
});
