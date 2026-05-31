# Building a Connector

A connector teaches Atlas how to pull data out of one company tool. The design
goal: **integrating a new source is one file and one import line.** The platform
handles tenancy, routing, signature verification, PII redaction, consent
enforcement, dedupe, ingestion, sync cursors, retries, and audit logging — you
write only the mapping.

## The 3-step recipe

1. **Copy `template.ts`** → `yourtool.ts`, rename `source`/`displayName`.
2. **Implement what your source needs:**
   - Push (webhooks): `verify()` + `map()`
   - Pull (polling): `sync()`
3. **Register it:** add `import "./yourtool";` to `index.ts`.

Done. Your connector is now live at:

```
POST /api/connectors/<source>/webhook   # push
POST /api/connectors/<source>/sync       # pull (cron-triggered)
GET  /api/connectors                      # catalog (your connector appears here)
```

## What you implement

```ts
export const x = defineConnector({
  source: "stripe",
  displayName: "Stripe",
  auth: { kind: "hmac_webhook", fields: [{ key: "signing_secret", secret: true, ... }] },

  verify(ctx)  { /* return true/false — authenticate the webhook */ },
  map(payload) { /* return event({...})[]  — normalize to events */ },
  async sync(ctx) { /* return { events, cursor } — for poll sources */ },
});
```

### The `event()` helper
Builds a normalized event with sane defaults — you only set what you have. The
source-native `id` becomes the dedupe key, so re-delivered webhooks are
idempotent automatically.

```ts
event({
  source: "stripe",
  type: "invoice.paid",      // your taxonomy: noun.verb
  id: inv.id,                // → dedupe key "stripe:<id>"
  occurredAt: inv.created,
  body: `Invoice ${inv.number} paid: $${inv.amount/100}`,
  metrics: { amount_usd: inv.amount / 100 },
  links: { account: inv.customer },
  sensitivity: "internal",   // public | internal | confidential | restricted
});
```

### Verifying webhooks
Use the built-ins — they're constant-time:
```ts
verifyHmac({ body: ctx.raw!.body, signature: ctx.raw!.headers.get("stripe-signature"),
             secret: ctx.secrets.signing_secret, prefix: "v1=" });
verifyToken(ctx.raw!.headers.get("x-token"), ctx.secrets.token);
```

### Recorded media & consent
If you emit recorded calls/meetings, set the `consent` block. Atlas **refuses**
non-consented recordings before storage:
```ts
consent: { recorded: true, consented: call.consentGiven, jurisdiction: "CA" }
```

## Credentials & config

Per-tenant connection settings live in `connector_accounts` (`config` = non-secret,
`secrets` = tokens/keys, treated as opaque and encrypted at rest in production).
At runtime they arrive on `ctx.config` / `ctx.secrets`. The `auth.fields` you
declare tell the integration UI what to collect — no hard-coded credentials.

## Pull connectors & cursors

`sync(ctx)` receives the last `ctx.cursor` and returns the next one; the platform
persists it in `connector_sync_state` so each run resumes exactly where it left
off. Trigger syncs from any scheduler (Vercel Cron, Inngest) by POSTing to the
sync route with the ingest secret.

## In-process vs. out-of-process

Most connectors run in-process (just implement the interface). If a connector
must run as a separate service, use `deliver()` from `base.ts` to POST
normalized events to `/api/events` — same validation, redaction, and consent
gate apply.

## Checklist

- [ ] `source` is unique and URL-safe
- [ ] `map()`/`sync()` return events via the `event()` helper (idempotent ids)
- [ ] `verify()` implemented for any push source
- [ ] `consent` set for recorded media
- [ ] `auth.fields` declared
- [ ] imported in `index.ts`
