import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { ask } from '../../../shared/llm/claude.js';
import type { RawListing } from '../index.js';

// Pulls UNSEEN messages from a dedicated deals inbox, asks Claude to extract structured
// deal data from the body, and marks them \Seen so we don't reprocess.
//
// Setup: forward broker newsletters and deal teasers to deals@yourholdco.com (or whatever
// inbox you create). Use an app password — never the real account password.
export async function ingestBrokerInbox(): Promise<RawListing[]> {
  const host = process.env.BROKER_INBOX_HOST;
  const user = process.env.BROKER_INBOX_USER;
  const pass = process.env.BROKER_INBOX_PASS;
  if (!host || !user || !pass) return [];      // graceful skip if not configured

  const client = new ImapFlow({
    host,
    port: Number(process.env.BROKER_INBOX_PORT ?? 993),
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const out: RawListing[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      if (!uids || uids.length === 0) return [];

      for (const uid of uids.slice(0, 30)) {       // cap per-run to control cost
        const raw = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!raw || !raw.source) continue;
        const parsed = await simpleParser(raw.source as Buffer);
        const subject = parsed.subject ?? '(no subject)';
        const fromAddr = parsed.from?.value?.[0]?.address ?? 'unknown';
        const htmlBody = typeof parsed.html === 'string' ? parsed.html : '';
        const body = (parsed.text ?? htmlBody.replace(/<[^>]+>/g, ' ') ?? '').slice(0, 12_000);

        const listings = await extractListingsFromEmail({
          subject, from: fromAddr, body, messageId: parsed.messageId ?? String(uid),
        });
        out.push(...listings);

        await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.warn('[broker-inbox] failed:', (err as Error).message);
  } finally {
    await client.logout().catch(() => {});
  }

  return out;
}

async function extractListingsFromEmail(args: {
  subject: string; from: string; body: string; messageId: string;
}): Promise<RawListing[]> {
  // Broker emails often contain 1 deal, sometimes a digest of several. Ask Claude to extract.
  const { parsed } = await ask<{ listings: ExtractedListing[] }>({
    system: `You are extracting M&A deal teasers from broker emails. A single email may contain
multiple listings (digest format) or just one. Extract every distinct opportunity. If the email
is not a deal teaser (e.g. just a marketing newsletter with no specific business), return an
empty listings array. Be conservative — don't invent fields. Money in USD whole dollars.`,
    user: `From: ${args.from}\nSubject: ${args.subject}\n\nBody:\n${args.body}`,
    tier: 'fast',
    maxTokens: 1500,
    jsonSchemaHint: `{
  "listings": [
    {
      "title": "<short business descriptor>",
      "industry": "<string|null>",
      "location": "<string|null>",
      "asking_price_usd": <number|null>,
      "sde_usd": <number|null>,
      "ebitda_usd": <number|null>,
      "revenue_usd": <number|null>,
      "employees": <number|null>,
      "established_year": <number|null>,
      "reason_for_sale": "<string|null>",
      "description": "<2-4 sentence summary>"
    }
  ]
}`,
  });

  if (!parsed?.listings) return [];

  return parsed.listings.map((l, i) => ({
    source: 'broker-email',
    source_ref: `${args.messageId}#${i}`,
    title: l.title,
    description: l.description ?? undefined,
    industry: l.industry ?? undefined,
    location: l.location ?? undefined,
    asking_price: l.asking_price_usd ? l.asking_price_usd * 100 : undefined,
    sde: l.sde_usd ? l.sde_usd * 100 : undefined,
    ebitda: l.ebitda_usd ? l.ebitda_usd * 100 : undefined,
    revenue: l.revenue_usd ? l.revenue_usd * 100 : undefined,
    employees: l.employees ?? undefined,
    established_year: l.established_year ?? undefined,
    reason_for_sale: l.reason_for_sale ?? undefined,
    raw: { from: args.from, subject: args.subject },
  }));
}

type ExtractedListing = {
  title: string;
  industry: string | null;
  location: string | null;
  asking_price_usd: number | null;
  sde_usd: number | null;
  ebitda_usd: number | null;
  revenue_usd: number | null;
  employees: number | null;
  established_year: number | null;
  reason_for_sale: string | null;
  description: string | null;
};
