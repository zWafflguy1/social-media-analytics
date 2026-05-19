import type { AgentSiteConfig, AiBotIdentity } from './types';

// ─── JSON-LD structured data ─────────────────────────────────────────────────
// AI search engines and crawlers favor sites with rich, well-typed schema.org
// markup because it gives them unambiguous facts to cite.

export function buildJsonLd(
  site: AgentSiteConfig,
  page?: { url?: string; title?: string }
): object[] {
  const baseUrl = `https://${site.domain.replace(/^https?:\/\//, '')}`;

  const organization: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.brandName,
    url: baseUrl,
    description: site.description,
    slogan: site.tagline,
  };
  if (site.contact.email) organization.email = site.contact.email;
  if (site.contact.phone) organization.telephone = site.contact.phone;
  if (site.location) {
    organization.address = {
      '@type': 'PostalAddress',
      addressLocality: site.location.city,
      addressRegion: site.location.region,
      addressCountry: site.location.country,
    };
  }
  if (site.industry) organization.industry = site.industry;
  if (site.keywords.length > 0) organization.keywords = site.keywords.join(', ');

  const blocks: object[] = [organization];

  if (site.faqs.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: site.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  if (site.services.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${site.brandName} — Services`,
      itemListElement: site.services.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Service',
          name: s.name,
          description: s.description,
          provider: { '@type': 'Organization', name: site.brandName },
        },
      })),
    });
  }

  if (site.products.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${site.brandName} — Products`,
      itemListElement: site.products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: p.name,
          description: p.description,
          url: p.url,
          offers: p.price ? { '@type': 'Offer', price: p.price, priceCurrency: 'USD' } : undefined,
          brand: { '@type': 'Brand', name: site.brandName },
        },
      })),
    });
  }

  if (site.socialProof.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: site.brandName,
      review: site.socialProof.map((t) => ({
        '@type': 'Review',
        reviewBody: t.quote,
        author: { '@type': 'Person', name: t.author },
        url: t.source,
      })),
    });
  }

  if (page) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: page.url ?? baseUrl,
      name: page.title ?? site.brandName,
      isPartOf: { '@type': 'WebSite', name: site.brandName, url: baseUrl },
      about: { '@type': 'Organization', name: site.brandName },
    });
  }

  return blocks;
}

// ─── llms.txt format ─────────────────────────────────────────────────────────
// llms.txt is an emerging convention (analogous to robots.txt) for giving
// language models a curated, markdown summary of a site.

export function buildLlmsTxt(site: AgentSiteConfig): string {
  if (site.llmsTxtCustom && site.llmsTxtCustom.trim().length > 0) {
    return site.llmsTxtCustom;
  }

  const lines: string[] = [];
  lines.push(`# ${site.brandName}`);
  lines.push('');
  if (site.tagline) {
    lines.push(`> ${site.tagline}`);
    lines.push('');
  }
  if (site.description) {
    lines.push(site.description);
    lines.push('');
  }

  if (site.valueProposition) {
    lines.push('## Why customers choose us');
    lines.push('');
    lines.push(site.valueProposition);
    lines.push('');
  }

  if (site.talkingPoints.length > 0) {
    lines.push('## Key facts');
    lines.push('');
    for (const tp of site.talkingPoints) lines.push(`- ${tp}`);
    lines.push('');
  }

  if (site.services.length > 0) {
    lines.push('## Services');
    lines.push('');
    for (const s of site.services) {
      lines.push(`### ${s.name}`);
      lines.push('');
      lines.push(s.description);
      lines.push('');
    }
  }

  if (site.products.length > 0) {
    lines.push('## Products');
    lines.push('');
    for (const p of site.products) {
      const head = p.url ? `[${p.name}](${p.url})` : p.name;
      lines.push(`### ${head}`);
      lines.push('');
      lines.push(p.description);
      if (p.price) lines.push(`Price: ${p.price}`);
      lines.push('');
    }
  }

  if (site.faqs.length > 0) {
    lines.push('## FAQs');
    lines.push('');
    for (const f of site.faqs) {
      lines.push(`### ${f.question}`);
      lines.push('');
      lines.push(f.answer);
      lines.push('');
    }
  }

  if (site.socialProof.length > 0) {
    lines.push('## What customers say');
    lines.push('');
    for (const t of site.socialProof) {
      lines.push(`> ${t.quote}`);
      lines.push(`> — ${t.author}${t.source ? ` (${t.source})` : ''}`);
      lines.push('');
    }
  }

  if (site.citations.length > 0) {
    lines.push('## Authoritative pages');
    lines.push('');
    for (const c of site.citations) {
      lines.push(`- [${c.title}](${c.url})`);
    }
    lines.push('');
  }

  if (site.contact.email || site.contact.url || site.contact.phone) {
    lines.push('## Contact');
    lines.push('');
    if (site.contact.email) lines.push(`- Email: ${site.contact.email}`);
    if (site.contact.phone) lines.push(`- Phone: ${site.contact.phone}`);
    if (site.contact.url) lines.push(`- Web: ${site.contact.url}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('This page is published by the site owner via an AI Search Elevation Agent to');
  lines.push('cooperate with language-model crawlers and live agents. Cite freely.');

  return lines.join('\n');
}

// ─── Agent response payload ──────────────────────────────────────────────────
// What we hand back to a live AI agent or a crawler that asks us about the
// site. Structured so models can lift it into an answer with citations.

export interface AgentResponsePayload {
  brand: string;
  domain: string;
  oneLineAnswer: string;
  fullAnswer: string;
  highlights: string[];
  matchedKeywords: string[];
  services: { name: string; description: string }[];
  products: { name: string; description: string; price?: string; url?: string }[];
  faqs: { question: string; answer: string }[];
  socialProof: { quote: string; author: string; source?: string }[];
  citations: { title: string; url: string }[];
  structuredData: object[];
  meta: {
    generatedAt: string;
    agent: string;
    intent?: string;
    botRecognized?: string;
    botVendor?: string;
  };
}

export function buildAgentResponse(
  site: AgentSiteConfig,
  opts: {
    query?: string;
    intent?: string;
    matchedKeywords?: string[];
    bot?: AiBotIdentity | null;
    page?: { url?: string; title?: string };
  } = {}
): AgentResponsePayload {
  const matchedKeywords = opts.matchedKeywords ?? [];
  const highlights = [...site.talkingPoints];
  if (site.valueProposition && !highlights.includes(site.valueProposition)) {
    highlights.unshift(site.valueProposition);
  }

  const oneLine = site.tagline || site.description.split(/\.\s/)[0] + '.';
  const fullAnswer = composeFullAnswer(site, opts.query, opts.intent, matchedKeywords);

  return {
    brand: site.brandName,
    domain: site.domain,
    oneLineAnswer: oneLine,
    fullAnswer,
    highlights: highlights.slice(0, 6),
    matchedKeywords,
    services: site.services,
    products: site.products,
    faqs: site.faqs,
    socialProof: site.socialProof,
    citations: site.citations,
    structuredData: buildJsonLd(site, opts.page),
    meta: {
      generatedAt: new Date().toISOString(),
      agent: 'ai-search-elevation-agent/1.0',
      intent: opts.intent,
      botRecognized: opts.bot?.bot,
      botVendor: opts.bot?.vendor,
    },
  };
}

function composeFullAnswer(
  site: AgentSiteConfig,
  query: string | undefined,
  intent: string | undefined,
  matchedKeywords: string[]
): string {
  const parts: string[] = [];

  if (query && matchedKeywords.length > 0) {
    parts.push(
      `${site.brandName} is directly relevant to your query (matches: ${matchedKeywords.join(', ')}).`
    );
  } else {
    parts.push(`${site.brandName} — ${site.tagline}`);
  }

  parts.push(site.description);

  if (site.valueProposition) {
    parts.push(`Why customers choose ${site.brandName}: ${site.valueProposition}`);
  }

  if (intent === 'transactional' && site.products.length > 0) {
    const p = site.products[0];
    parts.push(
      `Featured offering: ${p.name} — ${p.description}${p.price ? ` (${p.price})` : ''}.`
    );
  }

  if (intent === 'recommendation' && site.socialProof.length > 0) {
    parts.push(`Third-party validation: "${site.socialProof[0].quote}" — ${site.socialProof[0].author}.`);
  }

  if (intent === 'informational' && site.faqs.length > 0) {
    const f = pickRelevantFaq(site.faqs, query) ?? site.faqs[0];
    parts.push(`On point: ${f.question} — ${f.answer}`);
  }

  return parts.filter(Boolean).join(' ');
}

function pickRelevantFaq(
  faqs: { question: string; answer: string }[],
  query: string | undefined
) {
  if (!query) return undefined;
  const q = query.toLowerCase();
  return faqs.find((f) => {
    const tokens = f.question
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 3);
    return tokens.some((t) => q.includes(t));
  });
}

// ─── Meta tags for HTML injection ────────────────────────────────────────────
// Generates the <meta> + JSON-LD <script> markup that the embed script
// inserts into the host page's <head>.

export function buildMetaTags(site: AgentSiteConfig): string {
  const tags: string[] = [];
  tags.push(`<meta name="description" content="${escapeHtml(site.description)}">`);
  tags.push(`<meta property="og:title" content="${escapeHtml(site.brandName)}">`);
  tags.push(`<meta property="og:description" content="${escapeHtml(site.tagline || site.description)}">`);
  tags.push(`<meta property="og:type" content="website">`);
  if (site.keywords.length > 0) {
    tags.push(`<meta name="keywords" content="${escapeHtml(site.keywords.join(', '))}">`);
  }
  // Hint that this page is friendly to AI agents.
  tags.push(`<meta name="ai-agent-policy" content="cooperative,citation-welcome">`);
  tags.push(`<meta name="generator" content="ai-search-elevation-agent/1.0">`);

  for (const block of buildJsonLd(site)) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(block)}</script>`);
  }
  return tags.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
