import { z } from "zod";

// The universal event — every source normalizes to this shape before storage.
export const ActorSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  role: z.string(), // rep | customer | sender | recipient | attendee | ...
});

export const EventInputSchema = z.object({
  source: z.string().min(1), // gmail | dialpad | hubspot | stripe | meta | linkedin
  type: z.string().min(1), // call.completed | email.received | deal.updated
  occurred_at: z.string().datetime(),
  subject: z.string().optional(),
  body: z.string().optional(),
  actors: z.array(ActorSchema).default([]),
  metrics: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
  links: z.record(z.string()).default({}),
  sensitivity: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  raw_ref: z.string().optional(),
  dedupe_key: z.string().optional(),
  // Consent attestation supplied by the connector for recorded media.
  consent: z
    .object({
      recorded: z.boolean().default(false),
      consented: z.boolean().default(false),
      jurisdiction: z.string().optional(),
    })
    .optional(),
});

export type EventInput = z.infer<typeof EventInputSchema>;
export type Actor = z.infer<typeof ActorSchema>;
