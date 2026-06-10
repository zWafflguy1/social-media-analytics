import * as cheerio from "cheerio";
import { config } from "../config.js";

export interface CrawledPage {
  url: string;
  path: string;
  status: number;
  title: string;
  metaDescription: string;
  canonical: string;
  h1s: string[];
  h2s: string[];
  wordCount: number;
  jsonLdTypes: string[];
  imagesMissingAlt: number;
  internalLinks: string[];
  hasViewportMeta: boolean;
  ogTags: Record<string, string>;
  textSample: string;
}

/**
 * Polite same-origin crawler for the *owner's own site* (this agent is
 * installed by the site owner). Breadth-first from the homepage, capped at
 * CRAWL_MAX_PAGES, 1 request at a time with a small delay.
 */
export async function crawlSite(): Promise<CrawledPage[]> {
  const origin = new URL(config.siteUrl).origin;
  const queue: string[] = [config.siteUrl + "/"];
  const seen = new Set<string>(queue);
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < config.crawlMaxPages) {
    const url = queue.shift()!;
    try {
      const page = await fetchPage(url);
      pages.push(page);
      for (const link of page.internalLinks) {
        const normalized = normalize(link, origin);
        if (normalized && !seen.has(normalized)) {
          seen.add(normalized);
          queue.push(normalized);
        }
      }
    } catch (err) {
      pages.push({
        ...emptyPage(url),
        status: 0,
        textSample: `Fetch failed: ${(err as Error).message}`,
      });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return pages;
}

function normalize(href: string, origin: string): string | null {
  try {
    const u = new URL(href, origin);
    if (u.origin !== origin) return null;
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|css|js|ico)$/i.test(u.pathname)) return null;
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<CrawledPage> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ai-seo-ranking-agent/0.1 (site owner audit bot)" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const jsonLdTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"]) jsonLdTypes.push(String(item["@type"]));
      }
    } catch {
      jsonLdTypes.push("(invalid JSON-LD)");
    }
  });

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    ogTags[$(el).attr("property")!] = $(el).attr("content") || "";
  });

  const internalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    internalLinks.push($(el).attr("href")!);
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  return {
    url,
    path: new URL(url).pathname,
    status: res.status,
    title: $("title").first().text().trim(),
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || "",
    canonical: $('link[rel="canonical"]').attr("href") || "",
    h1s: $("h1").map((_, el) => $(el).text().trim()).get(),
    h2s: $("h2").map((_, el) => $(el).text().trim()).get(),
    wordCount: bodyText ? bodyText.split(" ").length : 0,
    jsonLdTypes,
    imagesMissingAlt: $("img:not([alt]), img[alt='']").length,
    internalLinks,
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    ogTags,
    textSample: bodyText.slice(0, 1500),
  };
}

function emptyPage(url: string): CrawledPage {
  return {
    url,
    path: new URL(url).pathname,
    status: 0,
    title: "",
    metaDescription: "",
    canonical: "",
    h1s: [],
    h2s: [],
    wordCount: 0,
    jsonLdTypes: [],
    imagesMissingAlt: 0,
    internalLinks: [],
    hasViewportMeta: false,
    ogTags: {},
    textSample: "",
  };
}
