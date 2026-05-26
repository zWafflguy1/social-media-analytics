import { ask } from '../../../shared/llm/claude.js';
import type { RawListing } from '../index.js';

// Scan public social posts for founders signaling exit intent.
// Each platform yields a "signal" rather than a structured deal — the LLM extracts what
// it can. These will mostly score lower than marketplace deals but can surface off-market.

export async function scanSocialSignals(): Promise<RawListing[]> {
  const out: RawListing[] = [];

  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    try { out.push(...await scanReddit()); }
    catch (e) { console.warn('[social/reddit]', (e as Error).message); }
  }

  if (process.env.X_BEARER_TOKEN) {
    try { out.push(...await scanX()); }
    catch (e) { console.warn('[social/x]', (e as Error).message); }
  }

  // LinkedIn intentionally omitted — scraping LinkedIn violates TOS and risks account bans.
  // If you have a Sales Navigator seat with a scraper API contract, add it here.

  return out;
}

async function getRedditToken(): Promise<string> {
  const id = process.env.REDDIT_CLIENT_ID!;
  const secret = process.env.REDDIT_CLIENT_SECRET!;
  const ua = process.env.REDDIT_USER_AGENT ?? 'holdco-agents/0.1';
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'User-Agent': ua,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const j = (await r.json()) as { access_token: string };
  return j.access_token;
}

async function scanReddit(): Promise<RawListing[]> {
  const token = await getRedditToken();
  const ua = process.env.REDDIT_USER_AGENT ?? 'holdco-agents/0.1';
  const subs = ['Entrepreneur', 'smallbusiness', 'EtsySellers', 'sweatystartup', 'roofing', 'lawncare', 'Plumbing'];
  const queries = ['"thinking about selling"', '"want to sell my business"', '"considering an exit"', '"looking to retire"'];
  const out: RawListing[] = [];

  for (const sub of subs) {
    for (const q of queries) {
      const url = `https://oauth.reddit.com/r/${sub}/search?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&limit=10&t=month`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': ua } });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: { children?: { data: RedditPost }[] } };
      const posts = j.data?.children ?? [];
      for (const p of posts) {
        const post = p.data;
        const extracted = await extractSignal({
          source: 'reddit',
          platform_id: post.id,
          url: `https://reddit.com${post.permalink}`,
          author: post.author,
          text: `${post.title}\n\n${post.selftext ?? ''}`,
          posted_at: post.created_utc,
        });
        if (extracted) out.push(extracted);
      }
    }
  }
  return out;
}

type RedditPost = { id: string; permalink: string; author: string; title: string; selftext?: string; created_utc: number };

async function scanX(): Promise<RawListing[]> {
  const token = process.env.X_BEARER_TOKEN!;
  const query = encodeURIComponent(
    '("thinking about selling my business" OR "considering an exit" OR "ready to sell my company") -is:retweet lang:en'
  );
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&tweet.fields=created_at,author_id`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return [];
  const j = (await r.json()) as { data?: Tweet[] };
  const out: RawListing[] = [];
  for (const t of j.data ?? []) {
    const ex = await extractSignal({
      source: 'x',
      platform_id: t.id,
      url: `https://x.com/i/web/status/${t.id}`,
      author: t.author_id,
      text: t.text,
      posted_at: t.created_at ? Math.floor(new Date(t.created_at).getTime() / 1000) : undefined,
    });
    if (ex) out.push(ex);
  }
  return out;
}

type Tweet = { id: string; author_id: string; text: string; created_at?: string };

async function extractSignal(s: {
  source: 'reddit' | 'x'; platform_id: string; url: string; author: string; text: string; posted_at?: number;
}): Promise<RawListing | null> {
  const { parsed } = await ask<{ is_real_signal: boolean; title?: string; industry?: string; location?: string; estimated_revenue_usd?: number; notes?: string }>({
    system: `You assess whether a public social post is a credible signal of a real business
owner contemplating selling. Reject jokes, idle musings, hypothetical posts, and posts that are
clearly about something other than selling an actual operating business. Reject if the business
is clearly under $500K revenue. Be skeptical.`,
    user: `Source: ${s.source}\nAuthor: ${s.author}\nURL: ${s.url}\n\nPost:\n${s.text.slice(0, 4000)}`,
    tier: 'fast',
    maxTokens: 400,
    jsonSchemaHint: `{
  "is_real_signal": <boolean>,
  "title": "<descriptor of the business, or null>",
  "industry": "<string or null>",
  "location": "<string or null>",
  "estimated_revenue_usd": <number or null>,
  "notes": "<short, why this is or isn't a credible signal>"
}`,
  });

  if (!parsed?.is_real_signal) return null;

  return {
    source: s.source,
    source_ref: s.platform_id,
    source_url: s.url,
    title: parsed.title ?? `${s.source} signal from ${s.author}`,
    description: s.text.slice(0, 2000),
    industry: parsed.industry ?? undefined,
    location: parsed.location ?? undefined,
    revenue: parsed.estimated_revenue_usd ? parsed.estimated_revenue_usd * 100 : undefined,
    posted_at: s.posted_at,
    raw: { author: s.author, notes: parsed.notes },
  };
}
