import { createHmac, timingSafeEqual } from "node:crypto";
import { type EventInput } from "../lib/events/schema";
import { type Actor } from "../lib/events/schema";

/**
 * Ergonomic builder for a normalized event. Fills sensible defaults so a mapper
 * only specifies what it actually has. Returns a plain EventInput the framework
 * validates, redacts, and ingests.
 */
export function event(input: {
  source: string;
  type: string;
  occurredAt: string | number | Date;
  id: string; // source-native id → becomes the dedupe key
  subject?: string;
  body?: string;
  actors?: Actor[];
  metrics?: Record<string, number | string | boolean>;
  links?: Record<string, string>;
  sensitivity?: EventInput["sensitivity"];
  rawRef?: string;
  consent?: EventInput["consent"];
}): EventInput {
  return {
    source: input.source,
    type: input.type,
    occurred_at: new Date(input.occurredAt).toISOString(),
    subject: input.subject,
    body: input.body,
    actors: input.actors ?? [],
    metrics: input.metrics ?? {},
    links: input.links ?? {},
    sensitivity: input.sensitivity ?? "internal",
    raw_ref: input.rawRef,
    dedupe_key: `${input.source}:${input.id}`,
    consent: input.consent,
  };
}

/** Convenience actor constructors. */
export const actor = {
  rep: (name?: string, id?: string): Actor => ({ role: "rep", name, id }),
  customer: (name?: string, id?: string): Actor => ({ role: "customer", name, id }),
  sender: (id?: string, name?: string): Actor => ({ role: "sender", id, name }),
  recipient: (id?: string, name?: string): Actor => ({ role: "recipient", id, name }),
  attendee: (name?: string, id?: string): Actor => ({ role: "attendee", name, id }),
};

/**
 * Verify an HMAC webhook signature in constant time. Works for the common
 * "hex/base64 digest of the raw body with a shared secret" pattern used by
 * Stripe, GitHub, Shopify, etc. Pass the header value and your secret.
 */
export function verifyHmac(opts: {
  body: string;
  signature: string | null;
  secret: string;
  algo?: "sha256" | "sha1";
  encoding?: "hex" | "base64";
  /** Some providers prefix the digest (e.g. "sha256="). Stripped if present. */
  prefix?: string;
}): boolean {
  const { body, signature, secret, algo = "sha256", encoding = "hex", prefix } = opts;
  if (!signature) return false;
  const provided = prefix && signature.startsWith(prefix)
    ? signature.slice(prefix.length)
    : signature;
  const expected = createHmac(algo, secret).update(body, "utf8").digest(encoding);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verify a static shared-secret token in a header. */
export function verifyToken(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
