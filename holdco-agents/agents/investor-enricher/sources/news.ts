import * as cheerio from 'cheerio';
import type { RawCandidate } from '../index.js';

// Google News RSS — no API key required, public feeds. We run several targeted queries
// aimed at uncovering active lower-middle-market capital deployers.

const QUERIES = [
  '"family office" invests OR acquires',
  '"private equity" "lower middle market" closes OR invests',
  '"search fund" acquires OR closes',
  '"independent sponsor" acquires OR partners',
  '"holding company" acquires OR portfolio',
  'mezzanine fund "lower middle market"',
];

const MAX_PER_QUERY = 8;

export async function fetchNewsCandidates(): Promise<RawCandidate[]> {
  const out: RawCandidate[] = [];

  for (const q of QUERIES) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HoldCo/0.1)' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      const items = $('item').toArray().slice(0, MAX_PER_QUERY);
      for (const item of items) {
        const $item = $(item);
        const title = $item.find('title').first().text().trim();
        const link = $item.find('link').first().text().trim();
        const pub = $item.find('pubDate').first().text().trim();
        const description = $item.find('description').first().text().trim();

        // Heuristic: the candidate "name" we're looking for is mentioned in the title.
        // We let Claude extract the precise entity later — here we just pass the headline.
        if (!title || !link) continue;

        out.push({
          source: 'google-news',
          source_ref: link,
          name: title,                  // Claude will refine to the actual entity name
          source_url: link,
          raw_text: `${title}\n\n${stripHtml(description)}`,
          raw_meta: { query: q, published: pub },
        });
      }
    } catch (err) {
      console.warn(`[news] query "${q}" failed:`, (err as Error).message);
    }
  }

  return out;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
