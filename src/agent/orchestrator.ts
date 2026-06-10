import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import crypto from "node:crypto";
import { config } from "../config.js";
import { crawlSite } from "../seo/crawler.js";
import { auditPages } from "../seo/audit.js";
import { checkAllRankings } from "../serp/serpMonitor.js";
import { checkAeoVisibility } from "../aeo/aiEngineMonitor.js";
import { getState, update } from "../store/db.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const PlanSchema = z.object({
  summary: z.string().describe("2-4 sentence plain-English status: where the site stands and what this cycle changes."),
  actions: z.array(
    z.object({
      title: z.string(),
      priority: z.number().describe("1 = do first"),
      category: z.enum(["seo", "aeo", "local", "technical", "content"]),
      description: z.string().describe("Specific, actionable instructions for the site owner."),
      autoApplicable: z.boolean().describe("True only if the embed widget can apply it client-side (schema injection, meta description, FAQ block)."),
    }),
  ),
  pageOptimizations: z.array(
    z.object({
      page: z.string().describe("Page path, e.g. '/' or '/services/drain-cleaning'"),
      jsonLd: z.array(z.string()).describe("Complete, valid JSON-LD blocks (serialized JSON strings) to inject: LocalBusiness, Service, FAQPage, etc. Use real business details from the context."),
      title: z.string().nullable().describe("Replacement <title> (≤60 chars, service + market keywords) or null to keep current."),
      metaDescription: z.string().nullable().describe("Replacement meta description (≤160 chars, compelling CTR copy) or null."),
      faq: z.array(z.object({ question: z.string(), answer: z.string() })).describe("FAQ entries matching real prospect questions — these feed both FAQPage schema and AI-engine answers."),
    }),
  ),
  contentBriefs: z.array(
    z.object({
      targetQuery: z.string(),
      intent: z.string(),
      outline: z.array(z.string()),
    }),
  ).describe("New pages/posts to create for queries the site currently loses."),
});

const SYSTEM_PROMPT = `You are an elite local-SEO and AI-engine-optimization (AEO) strategist embedded in an autonomous agent that runs on a recurring schedule.

Your job each cycle: given fresh crawl/audit data, Google rank positions, and AI-assistant citation checks, produce the highest-leverage optimization plan to push this business toward the top of its local market — in both classic search results and AI-engine answers.

Operating principles:
- Be specific. "Improve content" is useless; "Add a 'Water Heater Repair in Austin' section to /services with pricing ranges and a 3-step process" is useful.
- AEO and SEO reinforce each other: AI engines cite pages that answer questions directly, carry valid structured data, name the business + city + service explicitly, and demonstrate first-hand expertise.
- JSON-LD you emit must be complete and valid (LocalBusiness with name/address-locality/url/telephone placeholders only where data is genuinely unknown; Service; FAQPage mirroring the faq entries you provide).
- Respect what already exists: don't recommend re-adding schema a page already has; build on prior actions instead of repeating them.
- Local pack visibility depends heavily on Google Business Profile, reviews, and NAP consistency — surface those as actions even though the widget can't auto-apply them.
- Never recommend manipulative tactics (fake reviews, doorway pages, keyword stuffing, schema that misrepresents the business). They get sites penalized and AI-engines distrust them — the opposite of the goal.`;

export async function runAgentCycle(): Promise<void> {
  console.log("[agent] cycle starting…");

  const [pages, ranks, aeo] = await Promise.all([
    crawlSite(),
    checkAllRankings(),
    checkAeoVisibility(),
  ]);
  const findings = auditPages(pages);
  const prior = getState();

  console.log(
    `[agent] crawled ${pages.length} pages, ${findings.length} findings, ` +
      `${ranks.length} rank checks, ${aeo.length} AEO checks. Planning…`,
  );

  const contextPayload = {
    business: {
      name: config.businessName,
      siteUrl: config.siteUrl,
      services: config.services,
      market: config.market,
    },
    crawledPages: pages.map((p) => ({
      path: p.path,
      status: p.status,
      title: p.title,
      metaDescription: p.metaDescription,
      h1s: p.h1s,
      h2s: p.h2s.slice(0, 10),
      wordCount: p.wordCount,
      existingSchemaTypes: p.jsonLdTypes,
      textSample: p.textSample.slice(0, 600),
    })),
    auditFindings: findings,
    serpRankings: ranks,
    aeoVisibility: aeo,
    recentVitals: prior.vitals.slice(-50),
    previousActions: prior.actions.map((a) => ({
      title: a.title,
      status: a.status,
      category: a.category,
    })),
    previousRankHistory: prior.rankHistory.slice(-100),
  };

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          "Here is this cycle's monitoring data as JSON. Produce the optimization plan.\n\n" +
          JSON.stringify(contextPayload),
      },
    ],
    output_config: { format: zodOutputFormat(PlanSchema) },
  });

  const plan = response.parsed_output;
  if (!plan) {
    console.error("[agent] model output failed schema validation; keeping previous plan.");
    return;
  }

  // Validate every JSON-LD block before it can reach a customer's page.
  for (const po of plan.pageOptimizations) {
    po.jsonLd = po.jsonLd.filter((block) => {
      try {
        JSON.parse(block);
        return true;
      } catch {
        console.warn(`[agent] dropping invalid JSON-LD for ${po.page}`);
        return false;
      }
    });
  }

  const now = new Date().toISOString();
  update((s) => {
    s.lastRunAt = now;
    s.lastRunSummary = plan.summary;
    s.ranks = ranks;
    s.rankHistory.push(...ranks);
    s.aeo = aeo;
    s.aeoHistory.push(...aeo);
    s.auditFindings = findings;
    s.contentBriefs = plan.contentBriefs;
    s.pageOptimizations = plan.pageOptimizations.map((po) => ({
      page: po.page,
      jsonLd: po.jsonLd,
      title: po.title ?? undefined,
      metaDescription: po.metaDescription ?? undefined,
      faq: po.faq,
    }));
    // Carry forward dismissed/applied statuses for actions with the same title.
    const priorByTitle = new Map(s.actions.map((a) => [a.title, a]));
    s.actions = plan.actions
      .sort((a, b) => a.priority - b.priority)
      .map((a) => ({
        id: priorByTitle.get(a.title)?.id ?? crypto.randomUUID(),
        title: a.title,
        priority: a.priority,
        category: a.category,
        description: a.description,
        autoApplicable: a.autoApplicable,
        status: priorByTitle.get(a.title)?.status ?? "pending",
        createdAt: priorByTitle.get(a.title)?.createdAt ?? now,
      }));
  });

  console.log(`[agent] cycle complete: ${plan.summary}`);
}
