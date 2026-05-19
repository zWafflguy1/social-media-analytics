import type {
  LinkedInOverviewResponse,
  LinkedInOrganization,
  LinkedInInsights,
  LinkedInAdAccount,
  LinkedInAdCampaign,
  DateRange,
  TimeSeriesPoint,
} from '@/types';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';

const LI_BASE = 'https://api.linkedin.com/v2';
const LI_REST = 'https://api.linkedin.com/rest';

async function liGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202404',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LinkedIn API error [${res.status}] ${url}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<T>;
}

function dateRangeFromPreset(preset: string): DateRange {
  const until = new Date();
  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
  const since = subDays(until, days);
  return {
    since: format(since, 'yyyy-MM-dd'),
    until: format(until, 'yyyy-MM-dd'),
  };
}

function parseDate(dateObj: { year: number; month: number; day: number }): string {
  return format(new Date(dateObj.year, dateObj.month - 1, dateObj.day), 'yyyy-MM-dd');
}

// ─── Organizations ───────────────────────────────────────────────────────────

async function getOrganizations(token: string): Promise<LinkedInOrganization[]> {
  // Get organizations where the user is an admin
  const acls = await liGet<{
    elements: Array<{ organizationalTarget: string; role: string; state: string }>;
  }>(`${LI_BASE}/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=10`, token);

  const orgs: LinkedInOrganization[] = [];
  for (const acl of acls.elements ?? []) {
    const orgUrn = acl.organizationalTarget;
    if (!orgUrn.includes('organization:')) continue;

    try {
      const org = await liGet<{
        id: number;
        localizedName: string;
        vanityName: string;
        logoV2?: { original: string };
      }>(`${LI_BASE}/organizations/${orgUrn.split(':').pop()}?fields=id,localizedName,vanityName,logoV2`, token);

      // Get follower count
      let followersCount = 0;
      try {
        const networkSize = await liGet<{ firstDegreeSize: number }>(
          `${LI_BASE}/networkSizes/${encodeURIComponent(orgUrn)}?edgeType=CompanyFollowedByMember`,
          token
        );
        followersCount = networkSize.firstDegreeSize ?? 0;
      } catch { /* followers unavailable */ }

      orgs.push({
        id: String(org.id),
        name: org.localizedName,
        vanityName: org.vanityName,
        logoUrl: org.logoV2?.original,
        followersCount,
      });
    } catch { /* org details unavailable */ }
  }
  return orgs;
}

// ─── Organization Page Statistics ────────────────────────────────────────────

async function getOrganizationInsights(
  orgId: string,
  token: string,
  dateRange: DateRange
): Promise<LinkedInInsights> {
  const orgUrn = encodeURIComponent(`urn:li:organization:${orgId}`);
  const since = dateRange.since.replace(/-/g, '');
  const until = dateRange.until.replace(/-/g, '');

  let stats: LinkedInInsights = {
    impressions: 0,
    uniqueImpressions: 0,
    clicks: 0,
    engagement: 0,
    reactions: 0,
    comments: 0,
    shares: 0,
    impressionsSeries: [],
    clicksSeries: [],
    engagementSeries: [],
  };

  try {
    const res = await liGet<{
      elements: Array<{
        organizationalPageStatistics: {
          pageStatisticsByMonth?: Array<{
            timeRange: { start: { year: number; month: number; day: number }; end: { year: number; month: number; day: number } };
            views: { allPageViews: { pageViews: number } };
            clicks: { allClicks: { organicClicks: number } };
          }>;
          totalPageStatistics: {
            views: { allPageViews: { pageViews: number } };
            clicks: { allClicks: { organicClicks: number } };
          };
        };
      }>;
    }>(
      `${LI_BASE}/organizationPageStatistics?q=organization&organization=${orgUrn}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${since}&timeIntervals.timeRange.end=${until}`,
      token
    );

    const el = res.elements?.[0]?.organizationalPageStatistics;
    if (el) {
      stats.impressions = el.totalPageStatistics?.views?.allPageViews?.pageViews ?? 0;
      stats.clicks = el.totalPageStatistics?.clicks?.allClicks?.organicClicks ?? 0;
    }
  } catch { /* page stats unavailable */ }

  // Get share statistics (reactions, comments, shares)
  try {
    const shareRes = await liGet<{
      elements: Array<{
        totalShareStatistics: {
          impressionCount: number;
          uniqueImpressionsCount: number;
          clickCount: number;
          engagement: number;
          likeCount: number;
          commentCount: number;
          shareCount: number;
        };
        timeRange?: { start: { year: number; month: number; day: number } };
      }>;
    }>(
      `${LI_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${since}&timeIntervals.timeRange.end=${until}`,
      token
    );

    const impressionsSeries: TimeSeriesPoint[] = [];
    const clicksSeries: TimeSeriesPoint[] = [];
    const engagementSeries: TimeSeriesPoint[] = [];

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalEngagement = 0;
    let totalReactions = 0;
    let totalComments = 0;
    let totalShares = 0;

    for (const el of shareRes.elements ?? []) {
      const s = el.totalShareStatistics;
      if (!s) continue;
      totalImpressions += s.impressionCount ?? 0;
      totalClicks += s.clickCount ?? 0;
      totalEngagement += s.engagement ?? 0;
      totalReactions += s.likeCount ?? 0;
      totalComments += s.commentCount ?? 0;
      totalShares += s.shareCount ?? 0;

      if (el.timeRange?.start) {
        const date = parseDate(el.timeRange.start);
        impressionsSeries.push({ date, value: s.impressionCount ?? 0 });
        clicksSeries.push({ date, value: s.clickCount ?? 0 });
        engagementSeries.push({ date, value: (s.likeCount ?? 0) + (s.commentCount ?? 0) + (s.shareCount ?? 0) });
      }
    }

    stats = {
      ...stats,
      impressions: stats.impressions || totalImpressions,
      uniqueImpressions: shareRes.elements?.[0]?.totalShareStatistics?.uniqueImpressionsCount ?? 0,
      clicks: stats.clicks || totalClicks,
      engagement: totalEngagement,
      reactions: totalReactions,
      comments: totalComments,
      shares: totalShares,
      impressionsSeries,
      clicksSeries,
      engagementSeries,
    };
  } catch { /* share stats unavailable */ }

  return stats;
}

// ─── Ad Accounts ─────────────────────────────────────────────────────────────

async function getAdAccounts(token: string, dateRange: DateRange): Promise<LinkedInAdAccount[]> {
  const res = await liGet<{
    elements: Array<{ id: number; name: string; currency: string; status: string }>;
  }>(`${LI_REST}/adAccounts?q=search&search.status.values[0]=ACTIVE&count=10`, token);

  const accounts: LinkedInAdAccount[] = [];
  for (const account of res.elements ?? []) {
    try {
      const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${account.id}`);
      const sinceDate = dateRange.since.replace(/-/g, '');
      const untilDate = dateRange.until.replace(/-/g, '');

      // Get campaigns
      const campaignsRes = await liGet<{
        elements: Array<{ id: number; name: string; status: string; type: string }>;
      }>(`${LI_REST}/adCampaigns?q=search&search.account.values[0]=${encodeURIComponent(`urn:li:sponsoredAccount:${account.id}`)}&count=50`, token);

      const campaigns: LinkedInAdCampaign[] = [];
      for (const campaign of (campaignsRes.elements ?? []).slice(0, 20)) {
        try {
          const campaignUrn = encodeURIComponent(`urn:li:sponsoredCampaign:${campaign.id}`);
          const analyticsRes = await liGet<{
            elements: Array<{
              totalSpend: { amount: string };
              impressions: number;
              clicks: number;
              costInLocalCurrency: string;
              externalWebsiteConversions: number;
            }>;
          }>(
            `${LI_REST}/adAnalytics?q=analytics&pivot=CAMPAIGN&campaigns[0]=${campaignUrn}&dateRange.start.year=${sinceDate.slice(0, 4)}&dateRange.start.month=${parseInt(sinceDate.slice(4, 6), 10)}&dateRange.start.day=${parseInt(sinceDate.slice(6, 8), 10)}&dateRange.end.year=${untilDate.slice(0, 4)}&dateRange.end.month=${parseInt(untilDate.slice(4, 6), 10)}&dateRange.end.day=${parseInt(untilDate.slice(6, 8), 10)}&timeGranularity=ALL&fields=impressions,clicks,totalSpend,costInLocalCurrency,externalWebsiteConversions`,
            token
          );

          const stats = analyticsRes.elements?.[0];
          if (!stats) continue;

          const spend = parseFloat(stats.totalSpend?.amount ?? stats.costInLocalCurrency ?? '0');
          const impressions = stats.impressions ?? 0;
          const clicks = stats.clicks ?? 0;
          const conversions = stats.externalWebsiteConversions ?? 0;

          campaigns.push({
            id: String(campaign.id),
            name: campaign.name,
            status: campaign.status,
            type: campaign.type,
            spend,
            impressions,
            clicks,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
            conversions,
            costPerConversion: conversions > 0 ? spend / conversions : 0,
          });
        } catch { /* skip campaign */ }
      }

      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

      accounts.push({
        id: String(account.id),
        name: account.name,
        currency: account.currency,
        totalSpend,
        campaigns,
      });
    } catch { /* skip account */ }
  }

  return accounts;
}

// ─── Public Entry Point ──────────────────────────────────────────────────────

export async function getLinkedInOverview(token: string, preset = '30d'): Promise<LinkedInOverviewResponse> {
  const dateRange = dateRangeFromPreset(preset);

  const organizations = await getOrganizations(token).catch(() => []);

  let insights: LinkedInInsights = {
    impressions: 0,
    uniqueImpressions: 0,
    clicks: 0,
    engagement: 0,
    reactions: 0,
    comments: 0,
    shares: 0,
    impressionsSeries: [],
    clicksSeries: [],
    engagementSeries: [],
  };

  if (organizations.length > 0) {
    try {
      const allInsights = await Promise.all(
        organizations.map((org) => getOrganizationInsights(org.id, token, dateRange))
      );
      insights = allInsights.reduce((acc, curr) => ({
        impressions: acc.impressions + curr.impressions,
        uniqueImpressions: acc.uniqueImpressions + curr.uniqueImpressions,
        clicks: acc.clicks + curr.clicks,
        engagement: acc.engagement + curr.engagement,
        reactions: acc.reactions + curr.reactions,
        comments: acc.comments + curr.comments,
        shares: acc.shares + curr.shares,
        impressionsSeries: mergeSeries(acc.impressionsSeries, curr.impressionsSeries),
        clicksSeries: mergeSeries(acc.clicksSeries, curr.clicksSeries),
        engagementSeries: mergeSeries(acc.engagementSeries, curr.engagementSeries),
      }), insights);
    } catch { /* insights unavailable */ }
  }

  const adAccounts = await getAdAccounts(token, dateRange).catch(() => []);

  return { organizations, insights, adAccounts, dateRange };
}

function mergeSeries(a: TimeSeriesPoint[], b: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const map = new Map<string, number>();
  for (const p of a) map.set(p.date, (map.get(p.date) ?? 0) + p.value);
  for (const p of b) map.set(p.date, (map.get(p.date) ?? 0) + p.value);
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
