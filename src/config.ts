import "dotenv/config";
import crypto from "node:crypto";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return v;
}

export const config = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  siteUrl: required("SITE_URL").replace(/\/+$/, ""),
  businessName: required("BUSINESS_NAME"),
  services: required("SERVICES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  market: required("MARKET"),

  serpApiKey: process.env.SERPAPI_KEY || "",
  port: Number(process.env.PORT || 8787),
  agentIntervalHours: Number(process.env.AGENT_INTERVAL_HOURS || 6),
  crawlMaxPages: Number(process.env.CRAWL_MAX_PAGES || 25),
  dataDir: process.env.DATA_DIR || "./data",
  siteKey: process.env.SITE_KEY || crypto.randomBytes(16).toString("hex"),
};

export const siteDomain = new URL(config.siteUrl).hostname.replace(/^www\./, "");
