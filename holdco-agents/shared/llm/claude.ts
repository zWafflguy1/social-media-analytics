import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[claude] ANTHROPIC_API_KEY not set — LLM calls will fail.');
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_DEFAULT = 'claude-sonnet-4-6';
const MODEL_HEAVY = 'claude-opus-4-7';
const MODEL_FAST = 'claude-haiku-4-5-20251001';

export type LLMTier = 'fast' | 'default' | 'heavy';

const MODEL_FOR_TIER: Record<LLMTier, string> = {
  fast: MODEL_FAST,
  default: MODEL_DEFAULT,
  heavy: MODEL_HEAVY,
};

export type LLMUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
};

export type LLMResult<T = string> = {
  text: string;
  parsed?: T;
  usage: LLMUsage;
};

/**
 * Single-shot completion with structured JSON parsing.
 * Pass `jsonSchemaHint` to enforce JSON output; we'll extract the first JSON block.
 */
export async function ask<T = unknown>(opts: {
  system: string;
  user: string;
  tier?: LLMTier;
  maxTokens?: number;
  jsonSchemaHint?: string;            // optional schema description to coerce JSON output
  cacheSystem?: boolean;              // cache the system prompt across calls
}): Promise<LLMResult<T>> {
  const tier = opts.tier ?? 'default';
  const model = MODEL_FOR_TIER[tier];

  const userContent = opts.jsonSchemaHint
    ? `${opts.user}\n\nReturn ONLY a JSON object matching this shape (no prose, no markdown fence):\n${opts.jsonSchemaHint}`
    : opts.user;

  const systemBlocks = opts.cacheSystem
    ? [{ type: 'text' as const, text: opts.system, cache_control: { type: 'ephemeral' as const } }]
    : opts.system;

  const resp = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    system: systemBlocks as never,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const usage: LLMUsage = {
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
    cache_read_tokens: (resp.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
    cache_creation_tokens: (resp.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
  };

  let parsed: T | undefined;
  if (opts.jsonSchemaHint) {
    parsed = extractJson<T>(text);
  }

  return { text, parsed, usage };
}

function extractJson<T>(text: string): T | undefined {
  // Try fenced code first, then bare JSON
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const arrStart = candidate.indexOf('[');
  const firstBrace = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart);
  if (firstBrace === -1) return undefined;
  const matchingClose = candidate[firstBrace] === '{' ? '}' : ']';
  const lastClose = candidate.lastIndexOf(matchingClose);
  if (lastClose === -1) return undefined;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastClose + 1)) as T;
  } catch {
    return undefined;
  }
}

/**
 * Estimated cost in cents. Prices are approximate per-million-token rates and may drift;
 * portfolio-cfo uses these for the weekly report cost line item.
 */
export function estimateCostCents(usage: LLMUsage, tier: LLMTier): number {
  // $/MTok input / output
  const RATES: Record<LLMTier, [number, number]> = {
    fast: [0.80, 4.00],
    default: [3.00, 15.00],
    heavy: [15.00, 75.00],
  };
  const [inR, outR] = RATES[tier];
  const billedIn = usage.input_tokens + usage.cache_creation_tokens * 1.25 + usage.cache_read_tokens * 0.1;
  const cents = (billedIn / 1_000_000) * inR * 100 + (usage.output_tokens / 1_000_000) * outR * 100;
  return Math.round(cents);
}
