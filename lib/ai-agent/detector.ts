import type { AiBotIdentity, AiBotVendor } from './types';

// Known AI crawlers and live agents — ordered most-specific-first.
// References: each vendor publishes their own UA strings in their bot docs.
const KNOWN_AI_BOTS: Array<{
  pattern: RegExp;
  bot: string;
  vendor: AiBotVendor;
  isCrawler: boolean;
  isLiveAgent: boolean;
}> = [
  // OpenAI
  { pattern: /OAI-SearchBot/i, bot: 'OAI-SearchBot', vendor: 'openai', isCrawler: true, isLiveAgent: false },
  { pattern: /ChatGPT-User/i, bot: 'ChatGPT-User', vendor: 'openai', isCrawler: false, isLiveAgent: true },
  { pattern: /GPTBot/i, bot: 'GPTBot', vendor: 'openai', isCrawler: true, isLiveAgent: false },

  // Anthropic
  { pattern: /Claude-SearchBot/i, bot: 'Claude-SearchBot', vendor: 'anthropic', isCrawler: true, isLiveAgent: false },
  { pattern: /ClaudeBot/i, bot: 'ClaudeBot', vendor: 'anthropic', isCrawler: true, isLiveAgent: false },
  { pattern: /Claude-Web/i, bot: 'Claude-Web', vendor: 'anthropic', isCrawler: false, isLiveAgent: true },
  { pattern: /Claude-User/i, bot: 'Claude-User', vendor: 'anthropic', isCrawler: false, isLiveAgent: true },
  { pattern: /anthropic-ai/i, bot: 'anthropic-ai', vendor: 'anthropic', isCrawler: true, isLiveAgent: false },

  // Perplexity
  { pattern: /Perplexity-User/i, bot: 'Perplexity-User', vendor: 'perplexity', isCrawler: false, isLiveAgent: true },
  { pattern: /PerplexityBot/i, bot: 'PerplexityBot', vendor: 'perplexity', isCrawler: true, isLiveAgent: false },

  // Google
  { pattern: /Google-Extended/i, bot: 'Google-Extended', vendor: 'google', isCrawler: true, isLiveAgent: false },
  { pattern: /Google-CloudVertexBot/i, bot: 'Google-CloudVertexBot', vendor: 'google', isCrawler: true, isLiveAgent: false },
  { pattern: /Googlebot/i, bot: 'Googlebot', vendor: 'google', isCrawler: true, isLiveAgent: false },

  // Microsoft / Bing
  { pattern: /Bingbot/i, bot: 'Bingbot', vendor: 'microsoft', isCrawler: true, isLiveAgent: false },
  { pattern: /BingPreview/i, bot: 'BingPreview', vendor: 'microsoft', isCrawler: false, isLiveAgent: true },

  // Apple
  { pattern: /Applebot-Extended/i, bot: 'Applebot-Extended', vendor: 'apple', isCrawler: true, isLiveAgent: false },
  { pattern: /Applebot/i, bot: 'Applebot', vendor: 'apple', isCrawler: true, isLiveAgent: false },

  // Misc indexers
  { pattern: /CCBot/i, bot: 'CCBot', vendor: 'commoncrawl', isCrawler: true, isLiveAgent: false },
  { pattern: /YouBot/i, bot: 'YouBot', vendor: 'you', isCrawler: true, isLiveAgent: false },
  { pattern: /Meta-ExternalAgent/i, bot: 'Meta-ExternalAgent', vendor: 'meta', isCrawler: false, isLiveAgent: true },
  { pattern: /Meta-ExternalFetcher/i, bot: 'Meta-ExternalFetcher', vendor: 'meta', isCrawler: false, isLiveAgent: true },
  { pattern: /FacebookBot/i, bot: 'FacebookBot', vendor: 'meta', isCrawler: true, isLiveAgent: false },
  { pattern: /Bytespider/i, bot: 'Bytespider', vendor: 'bytedance', isCrawler: true, isLiveAgent: false },
  { pattern: /cohere-ai/i, bot: 'cohere-ai', vendor: 'cohere', isCrawler: true, isLiveAgent: false },
  { pattern: /MistralAI-User/i, bot: 'MistralAI-User', vendor: 'mistral', isCrawler: false, isLiveAgent: true },
  { pattern: /Diffbot/i, bot: 'Diffbot', vendor: 'unknown', isCrawler: true, isLiveAgent: false },
  { pattern: /DuckAssistBot/i, bot: 'DuckAssistBot', vendor: 'unknown', isCrawler: true, isLiveAgent: false },
];

export function detectAiBot(userAgent: string | null | undefined): AiBotIdentity | null {
  if (!userAgent) return null;
  for (const entry of KNOWN_AI_BOTS) {
    if (entry.pattern.test(userAgent)) {
      return {
        bot: entry.bot,
        vendor: entry.vendor,
        userAgent,
        isCrawler: entry.isCrawler,
        isLiveAgent: entry.isLiveAgent,
        confidence: 0.98,
      };
    }
  }
  // Heuristic: looks bot-like but not in the known list.
  const looksLikeBot = /(bot|crawl|spider|scraper|fetch|llm|ai-agent|search)/i.test(userAgent);
  const looksLikeBrowser = /(Mozilla\/.* (Chrome|Safari|Firefox|Edg)\/)/i.test(userAgent);
  if (looksLikeBot && !looksLikeBrowser) {
    return {
      bot: 'unknown-ai-agent',
      vendor: 'unknown',
      userAgent,
      isCrawler: true,
      isLiveAgent: false,
      confidence: 0.45,
    };
  }
  return null;
}

export function inferIntent(
  query: string | undefined,
  keywords: string[]
): { intent: string; matchedKeywords: string[] } | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase();
  const matched = keywords.filter((k) => q.includes(k.toLowerCase()));
  if (matched.length > 0) return { intent: 'brand-or-service-match', matchedKeywords: matched };
  if (/\b(best|top|leading|recommend|review)\b/.test(q)) return { intent: 'recommendation', matchedKeywords: [] };
  if (/\b(price|cost|cheap|affordable|buy|order|purchase)\b/.test(q)) return { intent: 'transactional', matchedKeywords: [] };
  if (/\b(how|what|why|when|where|guide|tutorial|explain)\b/.test(q)) return { intent: 'informational', matchedKeywords: [] };
  if (/\b(near me|local|in [a-z]+)\b/.test(q)) return { intent: 'local-search', matchedKeywords: [] };
  return { intent: 'general', matchedKeywords: [] };
}

export const RECOGNIZED_VENDORS: AiBotVendor[] = Array.from(
  new Set(KNOWN_AI_BOTS.map((b) => b.vendor))
);
