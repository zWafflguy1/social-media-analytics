import type {
  MetaOverviewResponse,
  MetaPage,
  MetaInsights,
  MetaAdAccount,
  MetaAdCampaign,
  DateRange,
  TimeSeriesPoint,
} from '@/types';
import { format, subDays } from 'date-fns';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

async function graphGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API error on ${path}: ${err?.error?.message ?? res.statusText}`);
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

// ─── Pages ──────────────────────────────────────────────────────────────────

async function getPages(token: string): Promise<MetaPage[]> {
  const res = await graphGet<{ data: Array<{ id: string; name: string; category: string; fan_count: number; followers_count: number; picture: { data: { url: string } }; instagram_business_account?: { id: string } }> }>(
    '/me/accounts',
    token,
    { fields: 'id,name,category,fan_count,followers_count,picture,instagram_business_account' }
  );

  const pages: MetaPage[] = [];
  for (const p of res.data ?? []) {
    const page: MetaPage = {
      id: p.id,
      name: p.name,
      category: p.category,
      fanCount: p.fan_count ?? 0,
      followersCount: p.followers_count ?? 0,
      picture: p.picture?.data?.url,
    };

    if (p.instagram_business_account?.id) {
      try {
        const ig = await graphGet<{ id: string; username: string; followers_count: number }>(
          `/${p.instagram_business_account.id}`,
          token,
          { fields: 'id,username,followers_count' }
        );
        page.instagramAccountId = ig.id;
        page.instagramUsername = ig.username;
        page.instagramFollowers = ig.followers_count ?? 0;
      } catch {
        // Instagram account may not be accessible
      }
    }

    pages.push(page);
  }
  return pages;
}

// ─── Page Insights ───────────────────────────────────────────────────────────

async function getPageInsights(pageId: string, token: string, dateRange: DateRange): Promise<MetaInsights> {
  const metrics = [
    'page_impressions',
    'page_reach',
    'page_engaged_users',
    'page_fan_adds',
  ].join(',');

  const res = await graphGet<{ data: Array<{ name: string; values: Array<{ value: number; end_time: string }> }> }>(
    `/${pageId}/insights`,
    token,
    {
      metric: metrics,
      period: 'day',
      since: dateRange.since,
      until: dateRange.until,
    }
  );

  const byName: Record<string, TimeSeriesPoint[]> = {};
  for (const metric of res.data ?? []) {
    byName[metric.name] = (metric.values ?? []).map((v) => ({
      date: v.end_time.split('T')[0],
      value: typeof v.value === 'number' ? v.value : 0,
    }));
  }

  const sum = (series: TimeSeriesPoint[]) => series.reduce((a, b) => a + b.value, 0);

  return {
    pageImpressions: sum(byName['page_impressions'] ?? []),
    pageReach: sum(byName['page_reach'] ?? []),
    pageEngagedUsers: sum(byName['page_engaged_users'] ?? []),
    pageFollowerAdds: sum(byName['page_fan_adds'] ?? []),
    impressionsSeries: byName['page_impressions'] ?? [],
    reachSeries: byName['page_reach'] ?? [],
    engagementSeries: byName['page_engaged_users'] ?? [],
  };
}

// ─── Ad Accounts ─────────────────────────────────────────────────────────────

async function getAdAccounts(token: string, dateRange: DateRange): Promise<MetaAdAccount[]> {
  const res = await graphGet<{ data: Array<{ id: string; name: string; currency: string; account_status: number }> }>(
    '/me/adaccounts',
    token,
    { fields: 'id,name,currency,account_status', limit: '20' }
  );

  const accounts: MetaAdAccount[] = [];
  for (const account of res.data ?? []) {
    if (account.account_status !== 1) continue; // only active accounts

    try {
      const insights = await graphGet<{ data: Array<{ campaign_id: string; campaign_name: string; status: string; objective: string; spend: string; impressions: string; clicks: string; reach: string; ctr: string; cpc: string; actions?: Array<{ action_type: string; value: string }> }> }>(
        `/${account.id}/insights`,
        token,
        {
          fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,ctr,cpc,actions',
          level: 'campaign',
          date_preset: 'last_30d',
          limit: '50',
        }
      );

      const campaigns: MetaAdCampaign[] = (insights.data ?? []).map((c) => {
        const conversions = (c.actions ?? [])
          .filter((a) => ['purchase', 'lead', 'complete_registration', 'offsite_conversion'].some((t) => a.action_type.includes(t)))
          .reduce((sum, a) => sum + parseInt(a.value ?? '0', 10), 0);

        return {
          id: c.campaign_id,
          name: c.campaign_name,
          status: c.status ?? 'UNKNOWN',
          objective: c.objective ?? '',
          spend: parseFloat(c.spend ?? '0'),
          impressions: parseInt(c.impressions ?? '0', 10),
          clicks: parseInt(c.clicks ?? '0', 10),
          reach: parseInt(c.reach ?? '0', 10),
          ctr: parseFloat(c.ctr ?? '0'),
          cpc: parseFloat(c.cpc ?? '0'),
          actions: conversions,
        };
      });

      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

      accounts.push({
        id: account.id,
        name: account.name,
        currency: account.currency,
        totalSpend,
        campaigns,
      });
    } catch {
      // Skip accounts we can't read insights for
    }
  }

  return accounts;
}

// ─── Public Entry Point ──────────────────────────────────────────────────────

export async function getMetaOverview(token: string, preset = '30d'): Promise<MetaOverviewResponse> {
  const dateRange = dateRangeFromPreset(preset);

  const pages = await getPages(token);

  // Get insights for the first connected page (primary page)
  let insights: MetaInsights = {
    pageImpressions: 0,
    pageReach: 0,
    pageEngagedUsers: 0,
    pageFollowerAdds: 0,
    impressionsSeries: [],
    reachSeries: [],
    engagementSeries: [],
  };

  if (pages.length > 0) {
    try {
      // Aggregate insights across all pages
      const allInsights = await Promise.all(
        pages.map((p) => getPageInsights(p.id, token, dateRange))
      );
      insights = allInsights.reduce((acc, curr) => ({
        pageImpressions: acc.pageImpressions + curr.pageImpressions,
        pageReach: acc.pageReach + curr.pageReach,
        pageEngagedUsers: acc.pageEngagedUsers + curr.pageEngagedUsers,
        pageFollowerAdds: acc.pageFollowerAdds + curr.pageFollowerAdds,
        impressionsSeries: mergeSeries(acc.impressionsSeries, curr.impressionsSeries),
        reachSeries: mergeSeries(acc.reachSeries, curr.reachSeries),
        engagementSeries: mergeSeries(acc.engagementSeries, curr.engagementSeries),
      }), insights);
    } catch {
      // insights unavailable
    }
  }

  const adAccounts = await getAdAccounts(token, dateRange).catch(() => []);

  return { pages, insights, adAccounts, dateRange };
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
