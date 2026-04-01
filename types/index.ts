// ─── Shared ────────────────────────────────────────────────────────────────

export interface DateRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface MetricSeries {
  label: string;
  data: TimeSeriesPoint[];
}

// ─── Meta ───────────────────────────────────────────────────────────────────

export interface MetaPage {
  id: string;
  name: string;
  category: string;
  fanCount: number;
  followersCount: number;
  picture?: string;
  instagramAccountId?: string;
  instagramUsername?: string;
  instagramFollowers?: number;
}

export interface MetaInsights {
  pageImpressions: number;
  pageReach: number;
  pageEngagedUsers: number;
  pageFollowerAdds: number;
  impressionsSeries: TimeSeriesPoint[];
  reachSeries: TimeSeriesPoint[];
  engagementSeries: TimeSeriesPoint[];
}

export interface MetaAdCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  actions?: number; // conversions / results
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  totalSpend: number;
  campaigns: MetaAdCampaign[];
}

export interface MetaOverviewResponse {
  pages: MetaPage[];
  insights: MetaInsights;
  adAccounts: MetaAdAccount[];
  dateRange: DateRange;
}

// ─── LinkedIn ───────────────────────────────────────────────────────────────

export interface LinkedInOrganization {
  id: string;
  name: string;
  vanityName: string;
  logoUrl?: string;
  followersCount: number;
}

export interface LinkedInInsights {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  engagement: number;
  reactions: number;
  comments: number;
  shares: number;
  impressionsSeries: TimeSeriesPoint[];
  clicksSeries: TimeSeriesPoint[];
  engagementSeries: TimeSeriesPoint[];
}

export interface LinkedInAdCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  costPerConversion: number;
}

export interface LinkedInAdAccount {
  id: string;
  name: string;
  currency: string;
  totalSpend: number;
  campaigns: LinkedInAdCampaign[];
}

export interface LinkedInOverviewResponse {
  organizations: LinkedInOrganization[];
  insights: LinkedInInsights;
  adAccounts: LinkedInAdAccount[];
  dateRange: DateRange;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export type Platform = 'meta' | 'linkedin';

export type DatePreset = '7d' | '30d' | '90d';

export interface DashboardState {
  datePreset: DatePreset;
  lastRefreshed: Date | null;
  isRefreshing: boolean;
}
