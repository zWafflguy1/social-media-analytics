import { chromium, type Browser } from 'playwright';
import * as cheerio from 'cheerio';
import type { RawListing } from '../index.js';

const SEARCH_URL = 'https://www.bizbuysell.com/businesses-for-sale/?priceMin=1000000&priceMax=15000000';
const MAX_PAGES = 3;             // ~30 listings/page

// BizBuySell scraper — paginated search page → detail pages.
// Robust to layout drift via dual selectors and JSON-LD extraction fallback.
export async function scrapeBizBuySell(): Promise<RawListing[]> {
  if (process.env.SKIP_BIZBUYSELL === '1') return [];
  let browser: Browser | null = null;
  const out: RawListing[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();

    for (let p = 1; p <= MAX_PAGES; p++) {
      const url = p === 1 ? SEARCH_URL : `${SEARCH_URL}&page=${p}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(1500);

      const html = await page.content();
      const $ = cheerio.load(html);

      const links: { ref: string; href: string }[] = [];
      $('a[href*="/Business-Opportunity/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const m = href.match(/\/Business-Opportunity\/[^/]+\/(\d+)/);
        if (m) links.push({ ref: m[1], href: href.startsWith('http') ? href : `https://www.bizbuysell.com${href}` });
      });

      const seen = new Set<string>();
      for (const link of links) {
        if (seen.has(link.ref)) continue;
        seen.add(link.ref);
        try {
          const listing = await scrapeListingDetail(page, link.href, link.ref);
          if (listing) out.push(listing);
          await page.waitForTimeout(800);                  // gentle pacing
        } catch (err) {
          console.warn(`[bizbuysell] detail ${link.ref} failed:`, (err as Error).message);
        }
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  return out;
}

async function scrapeListingDetail(page: import('playwright').Page, url: string, ref: string): Promise<RawListing | null> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(800);
  const html = await page.content();
  const $ = cheerio.load(html);

  // JSON-LD often has structured Product/Offer data
  type JsonLd = Record<string, unknown>;
  let jsonld: JsonLd | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed: unknown = JSON.parse($(el).contents().text());
      const candidates: JsonLd[] = Array.isArray(parsed)
        ? (parsed as JsonLd[]).filter((p) => p && typeof p === 'object' && '@type' in p)
        : (parsed && typeof parsed === 'object' && '@type' in parsed ? [parsed as JsonLd] : []);
      if (!jsonld && candidates.length > 0) jsonld = candidates[0];
    } catch { /* ignore */ }
  });

  const title = ($('h1').first().text() || (jsonld?.['name'] as string | undefined) || '').trim();
  if (!title) return null;

  const description = $('#ctl00_ctl00_Content_ContentPlaceHolder1_BusinessDescription, .businessDescription, [class*="description"]').first().text().trim()
    || ((jsonld?.['description'] as string | undefined) ?? '').trim();

  const fields: Record<string, string> = {};
  $('dl').each((_, el) => {
    const $dl = $(el);
    $dl.find('dt').each((i, dt) => {
      const k = $(dt).text().replace(/:/g, '').trim().toLowerCase();
      const v = $(dt).next('dd').text().trim();
      if (k && v) fields[k] = v;
    });
  });
  $('[class*="financial"] li, .financials li, .financial-item').each((_, el) => {
    const txt = $(el).text();
    const m = txt.match(/([A-Za-z ()/]+):\s*\$?([\d,]+)/);
    if (m) fields[m[1].trim().toLowerCase()] = m[2];
  });

  const num = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const m = s.replace(/,/g, '').match(/\d+(\.\d+)?/);
    return m ? Math.round(Number(m[0]) * 100) : undefined;
  };

  const asking = num(fields['asking price']) ?? num(fields['price']);
  const sde = num(fields['cash flow']) ?? num(fields['seller\'s discretionary earnings']) ?? num(fields['sde']);
  const ebitda = num(fields['ebitda']);
  const revenue = num(fields['gross revenue']) ?? num(fields['revenue']) ?? num(fields['gross income']);
  const employees = fields['employees'] ? Number(fields['employees'].replace(/\D/g, '')) || undefined : undefined;
  const established = fields['established'] ? (Number(fields['established'].match(/\d{4}/)?.[0] ?? '') || undefined) : undefined;
  const location = fields['location'] ?? ($('[class*="location"]').first().text().trim() || undefined);
  const industry = fields['industry'] ?? fields['category'] ?? undefined;
  const reasonForSale = fields['reason for selling'] ?? fields['reason for sale'] ?? undefined;

  return {
    source: 'bizbuysell',
    source_ref: ref,
    source_url: url,
    title,
    description: description || undefined,
    industry,
    location,
    asking_price: asking,
    sde,
    ebitda,
    revenue,
    employees,
    established_year: established,
    reason_for_sale: reasonForSale,
    raw: { fields, jsonld },
  };
}
