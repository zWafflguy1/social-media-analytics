import { ask, type LLMUsage } from '../../shared/llm/claude.js';
import type { Deal, Lender } from '../../shared/types.js';

const SYSTEM = `You are a debt advisor for lower-middle-market acquisitions ($1M-$10M EV).
Given a deal and a list of available lenders, recommend the BEST debt structure and rank
the lenders most likely to fund.

Knowledge to apply:
- SBA 7(a): up to $5M, 10yr term for goodwill/business acquisition, 25% equity injection
  typically (10% buyer + 15% from seller note on standby), industry restrictions (no passive
  RE, no speculative businesses), most flexible for absentee buyers via management agreement.
- SBA 504: real estate / equipment only, 50/40/10 stack, lower rates but useless for goodwill.
- Conventional commercial: senior term debt, usually 5-7yr amort, requires stronger DSCR
  (>1.25x) and personal guarantees; works above SBA $5M cap.
- Mezzanine: subordinated debt 10-14% with warrants/PIK, fills equity gap; only worth it
  for deals with strong cash flow and growth.
- Seller financing: often 10-30% of price, standby OK for SBA 7(a), market terms 5-7yr / 6-8%.

Constraints to honor:
- Lenders may avoid specific industries (lender.industries_avoid).
- Lenders have min/max loan sizes.
- SBA-preferred lenders should be favored for SBA-eligible deals under $5M.

Output strict JSON ranking the 3-5 best lender×product combinations.`;

const SCHEMA = `{
  "ranked": [
    {
      "lender_id": <number>,
      "product": "<7a|504|conv-term|line-of-credit|mezz|seller-finance>",
      "fit_score": <0-100 int>,
      "fit_reasoning": "<under 60 words>",
      "requested_amount_usd": <number>,
      "term_months": <number>
    }
  ]
}`;

export type RankedLender = {
  lender_id: number;
  product: string;
  fit_score: number;
  fit_reasoning: string;
  requested_amount_usd: number;
  term_months: number;
};

export async function rankLenders(
  deal: Deal,
  lenders: Lender[]
): Promise<{ ranked: RankedLender[]; usage: LLMUsage }> {
  const dealCard = [
    `Title: ${deal.title}`,
    deal.industry && `Industry: ${deal.industry}`,
    deal.location && `Location: ${deal.location}`,
    deal.asking_price && `Asking price: $${(deal.asking_price / 100).toLocaleString()}`,
    deal.sde && `SDE: $${(deal.sde / 100).toLocaleString()}`,
    deal.ebitda && `EBITDA: $${(deal.ebitda / 100).toLocaleString()}`,
    deal.revenue && `Revenue: $${(deal.revenue / 100).toLocaleString()}`,
    deal.established_year && `Established: ${deal.established_year}`,
    deal.employees && `Employees: ${deal.employees}`,
  ].filter(Boolean).join('\n');

  const lenderList = lenders.map((l) => {
    return `[${l.id}] ${l.name} (${l.type}${l.sba_preferred ? ', SBA-preferred' : ''})
   products: ${l.products ?? 'unspecified'}
   range: ${l.min_loan ? `$${(l.min_loan / 100).toLocaleString()}` : '?'} - ${l.max_loan ? `$${(l.max_loan / 100).toLocaleString()}` : '?'}
   focus: ${l.industries_focus ?? 'general'}
   avoid: ${l.industries_avoid ?? 'none specified'}
   geo: ${l.geography ?? 'national'}
   rate: ${l.typical_rate ?? '?'}`;
  }).join('\n\n');

  const { parsed, usage } = await ask<{ ranked: RankedLender[] }>({
    system: SYSTEM,
    user: `DEAL:\n${dealCard}\n\nLENDERS AVAILABLE:\n${lenderList}\n\nRank the best 3-5 fits.`,
    tier: 'default',
    maxTokens: 1500,
    jsonSchemaHint: SCHEMA,
    cacheSystem: true,
  });

  if (!parsed?.ranked) return { ranked: [], usage };

  // Normalize amounts to cents
  return {
    ranked: parsed.ranked.map((r) => ({
      ...r,
      requested_amount_usd: Math.round(Number(r.requested_amount_usd) * 100),
      fit_score: Math.max(0, Math.min(100, Math.round(r.fit_score))),
    })),
    usage,
  };
}
