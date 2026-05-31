import { defineConnector, event, actor, verifyToken } from "./base";

// Example PUSH connector: Gmail / MS365 webhook → universal events.
// Integrating a real provider = adjust this one map() to its payload shape.
interface RawMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  sentAt: string;
}

export const emailConnector = defineConnector<{ messages?: RawMessage[] }>({
  source: "gmail",
  displayName: "Gmail / Google Workspace",
  auth: {
    kind: "oauth2",
    docsUrl: "https://developers.google.com/gmail/api",
    fields: [
      { key: "webhook_token", label: "Webhook verification token", secret: true, required: true },
    ],
  },

  // Simple shared-token verification (swap for Google Pub/Sub JWT in production).
  verify(ctx) {
    return verifyToken(
      ctx.raw?.headers.get("x-atlas-webhook-token") ?? null,
      ctx.secrets.webhook_token ?? ""
    );
  },

  map(payload) {
    return (payload.messages ?? []).map((m) =>
      event({
        source: "gmail",
        type: "email.received",
        id: m.id,
        occurredAt: m.sentAt,
        subject: m.subject,
        body: m.body,
        actors: [actor.sender(m.from), ...m.to.map((t) => actor.recipient(t))],
        links: { thread: m.threadId },
        sensitivity: "confidential",
      })
    );
  },
});
