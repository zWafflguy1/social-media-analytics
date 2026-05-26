import * as cheerio from 'cheerio';
import type { RawCandidate } from '../index.js';

// EDGAR full-text search for Form D filings. We hit the JSON search endpoint, filter
// candidates by name pattern (investment entity keywords), then fetch each filing's
// primary index page for the body text Claude will extract from.
//
// EDGAR rate limit: 10 req/sec, requires User-Agent. We pace conservatively.

const EDGAR_UA = process.env.SEC_EDGAR_USER_AGENT ?? 'HoldCo Agents enrichment@example.com';

const INVESTOR_NAME_PATTERN = /\b(fund|capital|partners|family\s*office|ventures|investments?|holdings?|growth|equity|mezzanine|opportunities|advisors?)\b/i;

const MAX_FILINGS = 40;             // hard cap per run; EDGAR returns hundreds otherwise

export async function fetchFormDCandidates(): Promise<RawCandidate[]> {
  // Date range: last 14 days
  const today = new Date();
  const since = new Date(today.getTime() - 14 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=&forms=D&dateRange=custom&startdt=${fmt(since)}&enddt=${fmt(today)}`;

  const res = await fetch(searchUrl, { headers: { 'User-Agent': EDGAR_UA, 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`EDGAR search returned ${res.status}`);
  }
  const j = (await res.json()) as EdgarSearch;
  const hits = j.hits?.hits ?? [];

  const out: RawCandidate[] = [];
  let fetched = 0;

  for (const h of hits) {
    if (fetched >= MAX_FILINGS) break;
    const entityName = h._source?.display_names?.[0] ?? '';
    if (!entityName || !INVESTOR_NAME_PATTERN.test(entityName)) continue;

    const accNo = h._id;            // e.g. "0001234567-24-001234:..."
    const cik = h._source?.ciks?.[0];
    if (!accNo || !cik) continue;

    const accPlain = accNo.split(':')[0].replace(/-/g, '');
    const indexUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=D&dateb=&owner=include&count=10`;
    const filingIndexUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accPlain}/`;

    try {
      // Fetch the filing index page to find the primary XML document
      const indexRes = await fetch(filingIndexUrl, { headers: { 'User-Agent': EDGAR_UA } });
      if (!indexRes.ok) continue;
      const indexHtml = await indexRes.text();
      const $ = cheerio.load(indexHtml);

      // Find primary doc (usually the .xml or first .txt)
      let primaryHref: string | undefined;
      $('table a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && /primary_doc\.xml|\.xml$/i.test(href)) {
          primaryHref = href;
          return false;       // break
        }
      });

      let bodyText = '';
      if (primaryHref) {
        const docUrl = primaryHref.startsWith('http') ? primaryHref : `https://www.sec.gov${primaryHref}`;
        const docRes = await fetch(docUrl, { headers: { 'User-Agent': EDGAR_UA } });
        if (docRes.ok) {
          const docText = await docRes.text();
          // Strip XML tags for the LLM — it only needs the entities, amounts, addresses.
          bodyText = docText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000);
        }
      }

      if (!bodyText) bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 6000);

      out.push({
        source: 'sec-form-d',
        source_ref: accNo,
        name: entityName,
        source_url: filingIndexUrl,
        raw_text: bodyText,
        raw_meta: {
          accession: accNo,
          cik,
          form: 'D',
          filed: h._source?.file_date,
          all_listed_names: h._source?.display_names,
          browse_url: indexUrl,
        },
      });
      fetched += 1;
      await sleep(150);          // pace ~6 req/sec, well under SEC limit
    } catch (err) {
      console.warn(`[sec-form-d] ${entityName} filing fetch failed:`, (err as Error).message);
    }
  }

  return out;
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

type EdgarSearch = {
  hits?: {
    hits?: Array<{
      _id: string;
      _source?: {
        display_names?: string[];
        ciks?: string[];
        file_date?: string;
        forms?: string[];
      };
    }>;
  };
};
