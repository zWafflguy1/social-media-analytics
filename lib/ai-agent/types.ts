// AI Search Elevation Agent — shared types

export type AiBotVendor =
  | 'openai'
  | 'anthropic'
  | 'perplexity'
  | 'google'
  | 'microsoft'
  | 'apple'
  | 'commoncrawl'
  | 'you'
  | 'meta'
  | 'bytedance'
  | 'cohere'
  | 'mistral'
  | 'unknown';

export interface AiBotIdentity {
  bot: string;
  vendor: AiBotVendor;
  userAgent: string;
  // A crawler runs periodic indexing passes (no live user behind it).
  isCrawler: boolean;
  // A live agent is hitting the URL on behalf of a real query from a user right now.
  isLiveAgent: boolean;
  confidence: number;
}

export type EngagementOutcome =
  | 'elevated'    // bot served full enriched response
  | 'engaged'     // bot received Q&A or natural-language answer
  | 'logged'      // detected but not enriched (e.g. wrong site key)
  | 'rejected';   // blocked / disallowed

export interface AgentService {
  name: string;
  description: string;
}

export interface AgentProduct {
  name: string;
  description: string;
  url?: string;
  price?: string;
}

export interface AgentFaq {
  question: string;
  answer: string;
}

export interface AgentTestimonial {
  quote: string;
  author: string;
  source?: string;
}

export interface AgentCitation {
  title: string;
  url: string;
}

export interface AgentLocation {
  city?: string;
  region?: string;
  country?: string;
}

export interface AgentContact {
  email?: string;
  phone?: string;
  url?: string;
}

export interface AgentSiteConfig {
  id: string;
  siteKey: string;
  domain: string;
  brandName: string;
  tagline: string;
  description: string;
  valueProposition: string;
  industry: string;
  keywords: string[];
  services: AgentService[];
  products: AgentProduct[];
  faqs: AgentFaq[];
  talkingPoints: string[];
  socialProof: AgentTestimonial[];
  contact: AgentContact;
  location?: AgentLocation;
  citations: AgentCitation[];
  llmsTxtCustom?: string;
  // If true, return enriched content for live agents only (not background crawlers).
  liveAgentsOnly: boolean;
  // If true, the agent will deny content to bots whose vendor opted out via robots.txt etc.
  respectVendorOptOuts: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementEvent {
  id: string;
  siteId: string;
  siteKey: string;
  timestamp: string;
  bot: AiBotIdentity | null;
  path: string;
  query?: string;
  intent?: string;
  outcome: EngagementOutcome;
  responseBytes: number;
}

export interface SiteStats {
  totalEvents: number;
  byVendor: Record<string, number>;
  byOutcome: Record<EngagementOutcome, number>;
  liveAgentEvents: number;
  crawlerEvents: number;
  last24h: number;
  last7d: number;
}

export interface AgentManifest {
  agent: string;
  version: string;
  description: string;
  capabilities: string[];
  endpoints: Record<string, string>;
  vendorsRecognized: AiBotVendor[];
}
