import * as cheerio from 'cheerio';
import type { RawListing } from '../index.js';

// Empire Flippers publishes a marketplace JSON feed used by their site.
// Filtered to listings >= $1M.
const URL = 'https://empireflippers.com/marketplace/?price_min=1000000&price_max=15000000';

export async function scrapeEmpireFlippers(): Promise<RawListing[]> {
  if (process.env.SKIP_EMPIRE_FLIPPERS === '1') return [];
  try {
    const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const $ = cheerio.load(await res.text());
    const out: RawListing[] = [];

    $('.listing-card, .marketplace-listing, [class*="listing"]').each((_, el) => {
      const $card = $(el);
      const listingId = $card.attr('data-listing-id') ?? $card.find('[class*="number"]').first().text().replace(/\D/g, '');
      if (!listingId) return;

      const title = $card.find('[class*="title"], h3, h2').first().text().trim() ||
                    $card.find('[class*="niche"]').first().text().trim();
      if (!title) return;

      const priceTxt = $card.find('[class*="price"], [class*="listing-price"]').first().text();
      const profitTxt = $card.find('[class*="profit"], [class*="monthly-net-profit"]').first().text();
      const revenueTxt = $card.find('[class*="revenue"]').first().text();
      const monetizationTxt = $card.find('[class*="monetization"]').first().text().trim();
      const nicheTxt = $card.find('[class*="niche"]').first().text().trim();

      const href = $card.find('a').first().attr('href');

      out.push({
        source: 'empire-flippers',
        source_ref: listingId,
        source_url: href ? (href.startsWith('http') ? href : `https://empireflippers.com${href}`) : undefined,
        title,
        industry: nicheTxt || monetizationTxt || undefined,
        asking_price: parseDollar(priceTxt),
        sde: parseMonthly(profitTxt),
        revenue: parseMonthly(revenueTxt),
        raw: { card: $card.text().trim().slice(0, 1500) },
      });
    });

    return out;
  } catch (err) {
    console.warn('[empire-flippers] failed:', (err as Error).message);
    return [];
  }
}

function parseDollar(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/[,$]/g, '').match(/(\d+(?:\.\d+)?)([KMB]?)/i);
  if (!m) return undefined;
  let n = Number(m[1]);
  const suf = m[2].toUpperCase();
  if (suf === 'K') n *= 1_000;
  else if (suf === 'M') n *= 1_000_000;
  return Math.round(n * 100);
}

function parseMonthly(s: string | undefined): number | undefined {
  const n = parseDollar(s);
  return n ? n * 12 : undefined;
}
