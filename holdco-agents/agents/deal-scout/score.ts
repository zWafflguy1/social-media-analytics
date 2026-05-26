import { ask, type LLMUsage } from '../../shared/llm/claude.js';
import type { RawListing } from './index.js';

const SYSTEM = `You are a senior M&A analyst at a holding company that acquires lower-middle-market ($1M-$10M EV) absentee-run or low-touch businesses. You score deals on five dimensions:

1. ABSENTEE FIT (0-25): Does this run without an owner-operator? Look for: established management team, "absentee," "semi-absentee," "owner works <X hrs/wk," outsourced operations, recurring revenue.
2. CASH FLOW QUALITY (0-25): SDE/EBITDA margin, revenue stability, customer concentration, recurring vs project revenue.
3. VALUATION (0-20): Is asking price reasonable on SDE/EBITDA multiple? Sub-3x SDE excellent, 3-4x good, 4-5x fair, >5x poor unless growth.
4. FINANCEABILITY (0-15): SBA-7a eligible? Real assets? Reasonable debt service coverage at quoted price?
5. MOAT / RISK (0-15): Tenure, contracts, customer base, switching costs, key-person dependency.

Penalize heavily:
- Restaurants, hospitality, retail with high failure rates (unless multi-unit franchise)
- Owner-operator dependent (founder is the business)
- High customer concentration (>30% one client)
- Asking price > 5x SDE without growth justification
- Anything outside $1M-$10M EV band

Reward heavily:
- "Absentee" / "semi-absentee" / "owner works 5 hrs/wk"
- Real recurring revenue (subscriptions, contracts, route businesses)
- Multi-location, established mgmt
- Industries: B2B services, route distribution, specialty trades with mgmt, equipment rental, niche manufacturing, residential services with crews.

Output strict JSON. Be terse in reasoning (under 80 words).`;

const SCHEMA_HINT = `{
  "score": <integer 0-100>,
  "absentee_signal": <boolean>,
  "reasoning": "<under 80 words; cite specific signals>",
  "red_flags": ["<short bullet>", ...],
  "questions_to_diligence": ["<short bullet>", ...]
}`;

export type ScoreResult = {
  score: number;
  absenteeSignal: boolean;
  reasoning: string;
  usage: LLMUsage;
};

export async function scoreDeal(listing: RawListing): Promise<ScoreResult> {
  const facts = [
    listing.title && `Title: ${listing.title}`,
    listing.industry && `Industry: ${listing.industry}`,
    listing.location && `Location: ${listing.location}`,
    listing.asking_price && `Asking: $${(listing.asking_price / 100).toLocaleString()}`,
    listing.sde && `SDE: $${(listing.sde / 100).toLocaleString()}`,
    listing.ebitda && `EBITDA: $${(listing.ebitda / 100).toLocaleString()}`,
    listing.revenue && `Revenue: $${(listing.revenue / 100).toLocaleString()}`,
    listing.cash_flow && `Cash flow: $${(listing.cash_flow / 100).toLocaleString()}`,
    listing.employees != null && `Employees: ${listing.employees}`,
    listing.established_year && `Established: ${listing.established_year}`,
    listing.reason_for_sale && `Reason for sale: ${listing.reason_for_sale}`,
  ].filter(Boolean).join('\n');

  const description = listing.description ? `\n\nDescription:\n${listing.description.slice(0, 4000)}` : '';

  const { parsed, text, usage } = await ask<{ score: number; absentee_signal: boolean; reasoning: string }>({
    system: SYSTEM,
    user: `Score this deal:\n\n${facts}${description}`,
    tier: 'default',
    maxTokens: 600,
    jsonSchemaHint: SCHEMA_HINT,
    cacheSystem: true,
  });

  if (!parsed || typeof parsed.score !== 'number') {
    return {
      score: 0,
      absenteeSignal: false,
      reasoning: `LLM returned unparseable response: ${text.slice(0, 200)}`,
      usage,
    };
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    absenteeSignal: Boolean(parsed.absentee_signal),
    reasoning: parsed.reasoning ?? '',
    usage,
  };
}
