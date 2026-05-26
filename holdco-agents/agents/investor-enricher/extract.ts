import { ask, estimateCostCents, type LLMUsage } from '../../shared/llm/claude.js';
import type { RawCandidate } from './index.js';

export type InvestorProfile = {
  is_investor: boolean;                  // true only if this looks like a capital deployer
  confidence: number;                    // 0-100
  type: string | null;                   // family-office | pe | vc | mezz | search-fund | hnw
  focus_sectors: string | null;          // comma-separated
  check_size_min_usd: number | null;
  check_size_max_usd: number | null;
  geography: string | null;
  thesis: string | null;
  contact_name: string | null;
  notes: string | null;
};

const SYSTEM = `You extract investor profiles from public filings and news articles for a
holding-company prospect list. The goal is to identify capital deployers (family offices,
PE firms, search fund sponsors, mezzanine funds, HNW individuals) who could write equity
or junior debt checks for lower-middle-market ($1M-$10M EV) acquisitions.

Rules:
- Set is_investor=false if this is an operating company raising money (their own Reg D
  raise), a public company press release unrelated to investing, or a personal LinkedIn
  post. We only want capital DEPLOYERS, not capital RAISERS.
- For Form D filings, the issuer is the entity selling securities — if the issuer is a
  FUND, then the entity itself is the investor. If the issuer is an operating company,
  is_investor=false.
- Confidence reflects how clear the evidence is. Be ruthless: 90+ only when filing/article
  explicitly identifies them as an investment entity with sector or check-size info.
  60-80 if name strongly suggests (e.g. "X Capital Partners III, L.P.") but details thin.
  <40 means skip — we'll discard.
- Check size: estimate from total offering amount (for funds), AUM mentions, or article
  context. Lower-middle-market funds typically write $1M-$10M equity checks.
- Sectors and thesis: only if the source text mentions them explicitly. Don't fabricate.

Output strict JSON.`;

const SCHEMA = `{
  "is_investor": <boolean>,
  "confidence": <0-100 int>,
  "type": "<family-office|pe|vc|mezz|search-fund|hnw|null>",
  "focus_sectors": "<comma-separated tags or null>",
  "check_size_min_usd": <number or null>,
  "check_size_max_usd": <number or null>,
  "geography": "<string or null>",
  "thesis": "<short string or null>",
  "contact_name": "<string or null>",
  "notes": "<short, what this is and where it came from>"
}`;

export async function extractInvestorProfile(c: RawCandidate): Promise<{
  profile: InvestorProfile | null;
  usage: LLMUsage;
  costCents: number;
}> {
  const { parsed, usage } = await ask<InvestorProfile>({
    system: SYSTEM,
    user: `SOURCE: ${c.source}\nNAME (raw): ${c.name}\nURL: ${c.source_url ?? '—'}\n\nRAW TEXT:\n${c.raw_text.slice(0, 6000)}`,
    tier: 'default',
    maxTokens: 600,
    jsonSchemaHint: SCHEMA,
    cacheSystem: true,
  });

  const costCents = estimateCostCents(usage, 'default');

  if (!parsed || !parsed.is_investor) {
    return { profile: null, usage, costCents };
  }
  return { profile: parsed, usage, costCents };
}
