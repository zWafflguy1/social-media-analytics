import Anthropic from "@anthropic-ai/sdk";
import { config, siteDomain } from "../config.js";
import { aeoQueries } from "../local/queries.js";
import type { AeoSnapshot } from "../store/db.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * AEO (AI Engine Optimization) visibility check.
 *
 * Runs each prospect-style question through a web-search-grounded model —
 * the same retrieve-then-answer pattern ChatGPT/Perplexity/Claude use — and
 * records whether the business gets cited or mentioned in the answer. That
 * cited/mentioned rate is the AEO score the agent optimizes upward.
 */
export async function checkAeoVisibility(): Promise<AeoSnapshot[]> {
  const snapshots: AeoSnapshot[] = [];
  for (const query of aeoQueries()) {
    try {
      snapshots.push(await checkQuery(query));
    } catch (err) {
      console.error(`[aeo] "${query}" failed:`, (err as Error).message);
    }
  }
  return snapshots;
}

async function checkQuery(query: string): Promise<AeoSnapshot> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    system:
      "You are a consumer-facing AI assistant. Answer the user's question the way an AI search engine would: search the web, then recommend specific local businesses with reasons. Be concise.",
    messages: [{ role: "user", content: query }],
  });

  const citedDomains = new Set<string>();
  let answerText = "";
  for (const block of response.content) {
    if (block.type === "text") {
      answerText += block.text;
      for (const citation of block.citations ?? []) {
        if ("url" in citation && citation.url) {
          try {
            citedDomains.add(new URL(citation.url).hostname.replace(/^www\./, ""));
          } catch {
            /* ignore malformed citation URLs */
          }
        }
      }
    }
  }

  const cited = citedDomains.has(siteDomain);
  const mentioned =
    cited || answerText.toLowerCase().includes(config.businessName.toLowerCase());

  return {
    query,
    cited,
    mentioned,
    citedDomains: [...citedDomains].slice(0, 10),
    answerExcerpt: answerText.slice(0, 600),
    checkedAt: new Date().toISOString(),
  };
}
