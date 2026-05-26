import { chromium, type Browser } from 'playwright';
import * as cheerio from 'cheerio';
import type { RawListing } from '../index.js';

const SEARCH_URL = 'https://www.bizquest.com/businesses-for-sale/?priceLow=1000000&priceHigh=15000000';
const MAX_PAGES = 2;

// BizQuest has a similar layout pattern to BizBuySell (same parent company family).
// We extract from the search results card itself when possible to minimize detail fetches.
export async function scrapeBizQuest(): Promise<RawListing[]> {
  if (process.env.SKIP_BIZQUEST === '1') return [];
  let browser: Browser | null = null;
  const out: RawListing[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();

    for (let p = 1; p <= MAX_PAGES; p++) {
      const url = p === 1 ? SEARCH_URL : `${SEARCH_URL}&page=${p}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(1500);

      const html = await page.content();
      const $ = cheerio.load(html);

      $('.listingCard, [class*="listing-card"], article[class*="listing"]').each((_, el) => {
        const $card = $(el);
        const link = $card.find('a[href*="/business-for-sale/"]').first().attr('href');
        if (!link) return;
        const ref = link.match(/-(\d+)\/?$/)?.[1] ?? link;
        const title = $card.find('h2, h3, [class*="title"]').first().text().trim();
        const location = $card.find('[class*="location"]').first().text().trim() || undefined;

        const priceTxt = $card.find('[class*="price"]').first().text().trim();
        const asking = priceTxt ? toCents(priceTxt) : undefined;

        const cashFlowTxt = $card.find('[class*="cashFlow"], [class*="cash-flow"]').first().text().trim();
        const cf = cashFlowTxt ? toCents(cashFlowTxt) : undefined;

        const description = $card.find('[class*="description"], p').first().text().trim() || undefined;

        if (!title) return;
        out.push({
          source: 'bizquest',
          source_ref: ref,
          source_url: link.startsWith('http') ? link : `https://www.bizquest.com${link}`,
          title,
          description,
          location,
          asking_price: asking,
          cash_flow: cf,
          raw: { card: $card.text().trim().slice(0, 2000) },
        });
      });
    }
  } finally {
    if (browser) await browser.close();
  }

  return out;
}

function toCents(s: string): number | undefined {
  const m = s.replace(/[,$]/g, '').match(/(\d+(?:\.\d+)?)([KMB]?)/i);
  if (!m) return undefined;
  let n = Number(m[1]);
  const suf = m[2].toUpperCase();
  if (suf === 'K') n *= 1_000;
  else if (suf === 'M') n *= 1_000_000;
  else if (suf === 'B') n *= 1_000_000_000;
  return Math.round(n * 100);
}
