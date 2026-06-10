import { config, siteDomain } from "../config.js";
import { serpQueries } from "../local/queries.js";
import type { RankSnapshot } from "../store/db.js";

/**
 * Real-time SERP rank tracking via SerpAPI (a licensed SERP data provider).
 * Scraping Google directly violates its ToS and gets IPs blocked quickly,
 * so the provider interface is the supported path; implement `RankProvider`
 * for DataForSEO, Serper.dev, etc. if you prefer another vendor.
 */
export interface RankProvider {
  check(query: string): Promise<RankSnapshot[]>;
}

class SerpApiProvider implements RankProvider {
  async check(query: string): Promise<RankSnapshot[]> {
    const params = new URLSearchParams({
      engine: "google",
      q: query,
      location: config.market,
      num: "30",
      api_key: config.serpApiKey,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      organic_results?: { position: number; link: string }[];
      local_results?: { places?: { title: string; position: number; links?: { website?: string } }[] };
    };
    const now = new Date().toISOString();
    const snapshots: RankSnapshot[] = [];

    const organic = data.organic_results || [];
    const hit = organic.find((r) => domainOf(r.link) === siteDomain);
    snapshots.push({
      query,
      engine: "google",
      position: hit ? hit.position : null,
      topCompetitors: organic
        .slice(0, 5)
        .map((r) => domainOf(r.link))
        .filter((d) => d && d !== siteDomain),
      checkedAt: now,
    });

    const places = data.local_results?.places;
    if (places) {
      const localHit = places.find(
        (p) =>
          (p.links?.website && domainOf(p.links.website) === siteDomain) ||
          p.title.toLowerCase().includes(config.businessName.toLowerCase()),
      );
      snapshots.push({
        query,
        engine: "google_local",
        position: localHit ? localHit.position : null,
        topCompetitors: places.slice(0, 3).map((p) => p.title),
        checkedAt: now,
      });
    }
    return snapshots;
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function checkAllRankings(): Promise<RankSnapshot[]> {
  if (!config.serpApiKey) {
    console.warn("[serp] SERPAPI_KEY not set — skipping SERP rank tracking.");
    return [];
  }
  const provider: RankProvider = new SerpApiProvider();
  const results: RankSnapshot[] = [];
  for (const query of serpQueries()) {
    try {
      results.push(...(await provider.check(query)));
    } catch (err) {
      console.error(`[serp] "${query}" failed:`, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return results;
}
