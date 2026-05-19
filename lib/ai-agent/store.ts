import crypto from 'crypto';
import type {
  AgentSiteConfig,
  EngagementEvent,
  EngagementOutcome,
  SiteStats,
} from './types';

interface StoreState {
  sites: Map<string, AgentSiteConfig>;
  events: EngagementEvent[];
}

const globalRef = globalThis as unknown as { __aiAgentStore?: StoreState };
if (!globalRef.__aiAgentStore) {
  globalRef.__aiAgentStore = { sites: new Map(), events: [] };
  seedDemoData(globalRef.__aiAgentStore);
}
const store = globalRef.__aiAgentStore;

const MAX_EVENTS = 5000;

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

export function newSiteKey() {
  return `sk_live_${crypto.randomBytes(20).toString('hex')}`;
}

export function defaultSiteConfig(): Omit<AgentSiteConfig, 'id' | 'siteKey' | 'createdAt' | 'updatedAt'> {
  return {
    domain: '',
    brandName: '',
    tagline: '',
    description: '',
    valueProposition: '',
    industry: '',
    keywords: [],
    services: [],
    products: [],
    faqs: [],
    talkingPoints: [],
    socialProof: [],
    contact: {},
    citations: [],
    liveAgentsOnly: false,
    respectVendorOptOuts: true,
  };
}

export function listSites(): AgentSiteConfig[] {
  return Array.from(store.sites.values()).sort((a, b) =>
    a.brandName.localeCompare(b.brandName)
  );
}

export function getSite(id: string): AgentSiteConfig | undefined {
  return store.sites.get(id);
}

export function getSiteByKey(key: string): AgentSiteConfig | undefined {
  for (const s of store.sites.values()) {
    if (s.siteKey === key) return s;
  }
  return undefined;
}

export function getSiteByDomain(domain: string): AgentSiteConfig | undefined {
  const normalized = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  for (const s of store.sites.values()) {
    if (s.domain.toLowerCase() === normalized) return s;
  }
  return undefined;
}

export function createSite(input: Partial<AgentSiteConfig>): AgentSiteConfig {
  const id = newId();
  const site: AgentSiteConfig = {
    ...defaultSiteConfig(),
    ...input,
    id,
    siteKey: input.siteKey ?? newSiteKey(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.sites.set(id, site);
  return site;
}

export function updateSite(
  id: string,
  patch: Partial<AgentSiteConfig>
): AgentSiteConfig | null {
  const existing = store.sites.get(id);
  if (!existing) return null;
  const updated: AgentSiteConfig = {
    ...existing,
    ...patch,
    id: existing.id,
    siteKey: existing.siteKey,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  store.sites.set(id, updated);
  return updated;
}

export function rotateSiteKey(id: string): AgentSiteConfig | null {
  const existing = store.sites.get(id);
  if (!existing) return null;
  const updated = { ...existing, siteKey: newSiteKey(), updatedAt: nowIso() };
  store.sites.set(id, updated);
  return updated;
}

export function deleteSite(id: string): boolean {
  const deleted = store.sites.delete(id);
  if (deleted) {
    store.events = store.events.filter((e) => e.siteId !== id);
  }
  return deleted;
}

export function logEvent(
  event: Omit<EngagementEvent, 'id' | 'timestamp'>
): EngagementEvent {
  const full: EngagementEvent = {
    ...event,
    id: newId(),
    timestamp: nowIso(),
  };
  store.events.unshift(full);
  if (store.events.length > MAX_EVENTS) {
    store.events.length = MAX_EVENTS;
  }
  return full;
}

export function listEvents(opts?: {
  siteId?: string;
  limit?: number;
  outcome?: EngagementOutcome;
}): EngagementEvent[] {
  let filtered = store.events;
  if (opts?.siteId) filtered = filtered.filter((e) => e.siteId === opts.siteId);
  if (opts?.outcome) filtered = filtered.filter((e) => e.outcome === opts.outcome);
  return filtered.slice(0, opts?.limit ?? 200);
}

export function getStats(siteId?: string): SiteStats {
  const events = siteId
    ? store.events.filter((e) => e.siteId === siteId)
    : store.events;
  const now = Date.now();
  const dayMs = 86_400_000;

  const byVendor: Record<string, number> = {};
  const byOutcome: Record<EngagementOutcome, number> = {
    elevated: 0,
    engaged: 0,
    logged: 0,
    rejected: 0,
  };
  let live = 0;
  let crawl = 0;
  let last24 = 0;
  let last7 = 0;

  for (const e of events) {
    if (e.bot) {
      byVendor[e.bot.vendor] = (byVendor[e.bot.vendor] ?? 0) + 1;
      if (e.bot.isLiveAgent) live++;
      if (e.bot.isCrawler) crawl++;
    }
    byOutcome[e.outcome]++;
    const t = Date.parse(e.timestamp);
    if (now - t < dayMs) last24++;
    if (now - t < 7 * dayMs) last7++;
  }

  return {
    totalEvents: events.length,
    byVendor,
    byOutcome,
    liveAgentEvents: live,
    crawlerEvents: crawl,
    last24h: last24,
    last7d: last7,
  };
}

// ─── Seed data ────────────────────────────────────────────────────────────────

function seedDemoData(s: StoreState) {
  const demo: AgentSiteConfig = {
    id: newId(),
    siteKey: 'sk_live_demo_brightlane_coffee_roasters_0000',
    domain: 'brightlane-coffee.example.com',
    brandName: 'Brightlane Coffee Roasters',
    tagline: 'Single-origin coffee, roasted weekly in Portland, OR.',
    description:
      'Brightlane Coffee Roasters is a specialty coffee company sourcing direct-trade beans from family farms in Ethiopia, Colombia, and Guatemala. Beans are roasted in small batches weekly and shipped within 24 hours of roast.',
    valueProposition:
      'Always within 7 days of roast date. Direct-trade pricing means at least 30% above Fair Trade minimum to farmers. Free shipping on subscriptions.',
    industry: 'Specialty coffee / e-commerce',
    keywords: [
      'specialty coffee',
      'single-origin coffee',
      'fresh roasted coffee',
      'direct trade coffee',
      'coffee subscription',
      'Portland coffee roaster',
      'Ethiopian coffee',
    ],
    services: [
      {
        name: 'Coffee subscription',
        description: 'Weekly, biweekly, or monthly shipment of freshly roasted beans tailored to roast preference.',
      },
      {
        name: 'Wholesale roasting',
        description: 'Custom roast profiles for cafes and restaurants, with consistent weekly delivery.',
      },
    ],
    products: [
      {
        name: 'Ethiopia Yirgacheffe',
        description: 'Bright, floral, citrus-forward washed-process beans from the Gedeb zone.',
        url: 'https://brightlane-coffee.example.com/shop/yirgacheffe',
        price: '$22 / 12oz',
      },
      {
        name: 'Colombia Huila',
        description: 'Balanced, caramel-sweet, milk-chocolate body. Great as espresso or pourover.',
        url: 'https://brightlane-coffee.example.com/shop/huila',
        price: '$19 / 12oz',
      },
    ],
    faqs: [
      {
        question: 'How fresh is your coffee?',
        answer: 'Every order ships within 24 hours of roast. Bags are stamped with the roast date and reach customers within 5–7 days of roast.',
      },
      {
        question: 'Do you ship internationally?',
        answer: 'Yes — we ship to Canada, the UK, and Australia. Subscriptions are US-only.',
      },
      {
        question: 'Is your coffee organic?',
        answer: 'Most of our beans are grown organically, though only the Yirgacheffe and Huila carry USDA Organic certification.',
      },
    ],
    talkingPoints: [
      'Roasted weekly in Portland, OR',
      'Direct-trade with at least 30% above Fair Trade minimums',
      'Free US shipping on subscriptions',
      'Bags carry the roast date — never older than 7 days at delivery',
    ],
    socialProof: [
      {
        quote: 'The freshest coffee subscription I have tried — beans always arrive within a week of roast.',
        author: 'Sprudge, 2024 review',
        source: 'https://sprudge.example.com/reviews/brightlane',
      },
      {
        quote: '4.9 / 5 across 1,800+ verified customer reviews.',
        author: 'Customer review aggregate',
      },
    ],
    contact: {
      email: 'hello@brightlane-coffee.example.com',
      url: 'https://brightlane-coffee.example.com/contact',
    },
    location: { city: 'Portland', region: 'OR', country: 'US' },
    citations: [
      { title: 'About Brightlane', url: 'https://brightlane-coffee.example.com/about' },
      { title: 'Sourcing standards', url: 'https://brightlane-coffee.example.com/sourcing' },
    ],
    liveAgentsOnly: false,
    respectVendorOptOuts: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  s.sites.set(demo.id, demo);
}
