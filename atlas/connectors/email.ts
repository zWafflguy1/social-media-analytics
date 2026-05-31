import { type Connector } from "./base";
import { type EventInput } from "../lib/events/schema";

// Example push connector: Gmail/MS365 webhook → universal events. The shape of
// `payload` here is illustrative; map your provider's real fields in mapMessage.
interface RawMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  sentAt: string;
}

export const emailConnector: Connector = {
  source: "gmail",
  handleWebhook(payload: unknown): EventInput[] {
    const messages = (payload as { messages?: RawMessage[] }).messages ?? [];
    return messages.map(mapMessage);
  },
};

function mapMessage(m: RawMessage): EventInput {
  return {
    source: "gmail",
    type: "email.received",
    occurred_at: new Date(m.sentAt).toISOString(),
    subject: m.subject,
    body: m.body,
    actors: [
      { role: "sender", id: m.from },
      ...m.to.map((t) => ({ role: "recipient", id: t })),
    ],
    metrics: {},
    links: { thread: m.threadId },
    sensitivity: "confidential",
    dedupe_key: `gmail:${m.id}`,
  };
}
