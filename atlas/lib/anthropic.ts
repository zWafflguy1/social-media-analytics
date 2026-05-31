import Anthropic from "@anthropic-ai/sdk";

// Three tiers, mapped to env so model choice is config, not code.
export const MODELS = {
  heavy: process.env.ATLAS_MODEL_HEAVY || "claude-opus-4-8", // deep analysis, briefs
  fast: process.env.ATLAS_MODEL_FAST || "claude-sonnet-4-6", // summaries, chat, agents
  cheap: process.env.ATLAS_MODEL_CHEAP || "claude-haiku-4-5-20251001", // classification
} as const;

export type ModelTier = keyof typeof MODELS;

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface CompleteOpts {
  tier?: ModelTier;
  system?: string;
  /** When set, the system prompt is cached (cheap reuse of stable context). */
  cacheSystem?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/** Single-turn text completion. */
export async function complete(
  prompt: string,
  opts: CompleteOpts = {}
): Promise<string> {
  const { tier = "fast", system, cacheSystem, maxTokens = 1500, temperature = 0.3 } = opts;

  const systemParam = system
    ? cacheSystem
      ? [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }]
      : system
    : undefined;

  const res = await anthropic().messages.create({
    model: MODELS[tier],
    max_tokens: maxTokens,
    temperature,
    ...(systemParam ? { system: systemParam as any } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Completion that must return JSON. We instruct + extract the first JSON object,
 * tolerating any prose the model wraps around it.
 */
export async function completeJSON<T>(
  prompt: string,
  opts: CompleteOpts = {}
): Promise<T> {
  const text = await complete(prompt, { temperature: 0, ...opts });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON: " + text.slice(0, 200));
  return JSON.parse(match[0]) as T;
}
