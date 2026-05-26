import * as cheerio from 'cheerio';
import type { RawListing } from '../index.js';

// Flippa has a JSON API used by their own site (public, no auth required for browse).
// We hit it directly — much more stable than HTML scraping.
const API = 'https://flippa.com/v3/listings?filter[property_type]=business&filter[price][min]=1000000&filter[price][max]=15000000&page[size]=50';

export async function scrapeFlippa(): Promise<RawListing[]> {
  if (process.env.SKIP_FLIPPA === '1') return [];
  try {
    const res = await fetch(API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HoldCoBot/0.1; +https://yourholdco.com)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`[flippa] API returned ${res.status}, falling back to HTML scrape`);
      return await fallbackHtml();
    }
    const json = (await res.json()) as { data?: FlippaListing[] };
    return (json.data ?? []).map(mapListing).filter((l): l is RawListing => l !== null);
  } catch (err) {
    console.warn('[flippa] API failed:', (err as Error).message);
    return [];
  }
}

type FlippaListing = {
  id: number | string;
  title?: string;
  summary?: string;
  url?: string;
  price?: number;
  multiple?: number;
  monetization?: string;
  age_in_years?: number;
  profit_average?: number;
  revenue_average?: number;
  property_type?: string;
  industry?: string;
  type?: string;
  established_at?: string;
};

function mapListing(l: FlippaListing): RawListing | null {
  if (!l.title) return null;
  const url = l.url ? (l.url.startsWith('http') ? l.url : `https://flippa.com${l.url}`) : undefined;
  return {
    source: 'flippa',
    source_ref: String(l.id),
    source_url: url,
    title: l.title,
    description: l.summary,
    industry: l.industry ?? l.type ?? l.monetization,
    asking_price: l.price ? Math.round(l.price * 100) : undefined,
    sde: l.profit_average ? Math.round(l.profit_average * 12 * 100) : undefined,
    revenue: l.revenue_average ? Math.round(l.revenue_average * 12 * 100) : undefined,
    established_year: l.age_in_years ? new Date().getFullYear() - Math.round(l.age_in_years) : undefined,
    raw: l as unknown as Record<string, unknown>,
  };
}

async function fallbackHtml(): Promise<RawListing[]> {
  const res = await fetch('https://flippa.com/buy/established-businesses?asking_price[min]=1000000&asking_price[max]=15000000', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) return [];
  const $ = cheerio.load(await res.text());
  const out: RawListing[] = [];
  $('[data-listing-id], .listing-card').each((_, el) => {
    const id = $(el).attr('data-listing-id') ?? $(el).find('a').first().attr('href')?.split('/').pop();
    const title = $(el).find('h3, .title').first().text().trim();
    const href = $(el).find('a').first().attr('href');
    if (id && title) {
      out.push({
        source: 'flippa',
        source_ref: id,
        source_url: href ? (href.startsWith('http') ? href : `https://flippa.com${href}`) : undefined,
        title,
      });
    }
  });
  return out;
}
