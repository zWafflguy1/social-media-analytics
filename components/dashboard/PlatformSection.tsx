'use client';

import {
  Users,
  Eye,
  MousePointerClick,
  Heart,
  DollarSign,
  TrendingUp,
  BarChart2,
  UserPlus,
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { PerformanceChart } from './PerformanceChart';
import { CampaignTable } from './CampaignTable';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import type { MetaOverviewResponse, LinkedInOverviewResponse } from '@/types';

// ─── Meta Section ─────────────────────────────────────────────────────────────

interface MetaSectionProps {
  data: MetaOverviewResponse | null;
  loading: boolean;
  error?: string | null;
}

export function MetaSection({ data, loading, error }: MetaSectionProps) {
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-5 text-red-300 text-sm">
        Failed to load Meta data: {error}
      </div>
    );
  }

  const totalFollowers = data?.pages.reduce((s, p) => s + p.followersCount, 0) ?? 0;
  const totalFans = data?.pages.reduce((s, p) => s + p.fanCount, 0) ?? 0;
  const igFollowers = data?.pages.reduce((s, p) => s + (p.instagramFollowers ?? 0), 0) ?? 0;
  const totalAdSpend = data?.adAccounts.reduce((s, a) => s + a.totalSpend, 0) ?? 0;
  const allCampaigns = data?.adAccounts.flatMap((a) => a.campaigns) ?? [];
  const totalClicks = allCampaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = allCampaigns.reduce((s, c) => s + c.impressions, 0);
  const currency = data?.adAccounts[0]?.currency ?? 'USD';

  const chartSeries = [
    {
      key: 'impressions',
      label: 'Impressions',
      color: '#1877F2',
      data: data?.insights.impressionsSeries ?? [],
    },
    {
      key: 'reach',
      label: 'Reach',
      color: '#E1306C',
      data: data?.insights.reachSeries ?? [],
    },
    {
      key: 'engagement',
      label: 'Engaged Users',
      color: '#10B981',
      data: data?.insights.engagementSeries ?? [],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Account pills */}
      {!loading && data && data.pages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.pages.map((page) => (
            <div key={page.id} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5 text-xs text-gray-300">
              {page.picture && (
                <img src={page.picture} alt={page.name} className="w-4 h-4 rounded-full" />
              )}
              <span className="font-medium">{page.name}</span>
              {page.instagramUsername && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-pink-400">@{page.instagramUsername}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Organic metrics */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Organic</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="FB Page Fans"
            value={loading ? '—' : formatNumber(totalFans)}
            subValue={loading ? undefined : `${formatNumber(totalFollowers)} followers`}
            icon={Users}
            iconColor="text-blue-400"
            loading={loading}
          />
          <MetricCard
            label="IG Followers"
            value={loading ? '—' : formatNumber(igFollowers)}
            subValue={data?.pages.filter((p) => p.instagramUsername).map((p) => `@${p.instagramUsername}`).join(', ')}
            icon={Users}
            iconColor="text-pink-400"
            loading={loading}
          />
          <MetricCard
            label="Page Impressions"
            value={loading ? '—' : formatNumber(data?.insights.pageImpressions ?? 0)}
            subValue="Total this period"
            icon={Eye}
            iconColor="text-indigo-400"
            loading={loading}
          />
          <MetricCard
            label="Engaged Users"
            value={loading ? '—' : formatNumber(data?.insights.pageEngagedUsers ?? 0)}
            subValue={`+${formatNumber(data?.insights.pageFollowerAdds ?? 0)} new fans`}
            icon={Heart}
            iconColor="text-rose-400"
            loading={loading}
          />
        </div>
      </div>

      {/* Paid metrics */}
      {(loading || totalAdSpend > 0 || allCampaigns.length > 0) && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Paid (Ads)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Ad Spend"
              value={loading ? '—' : formatCurrency(totalAdSpend, currency)}
              subValue={`${data?.adAccounts.length ?? 0} ad account(s)`}
              icon={DollarSign}
              iconColor="text-yellow-400"
              loading={loading}
            />
            <MetricCard
              label="Ad Impressions"
              value={loading ? '—' : formatNumber(totalImpressions)}
              subValue={`${allCampaigns.length} campaigns`}
              icon={BarChart2}
              iconColor="text-blue-400"
              loading={loading}
            />
            <MetricCard
              label="Ad Clicks"
              value={loading ? '—' : formatNumber(totalClicks)}
              subValue="Link clicks"
              icon={MousePointerClick}
              iconColor="text-emerald-400"
              loading={loading}
            />
            <MetricCard
              label="Avg CTR"
              value={loading ? '—' : formatPercent(totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0)}
              subValue="Click-through rate"
              icon={TrendingUp}
              iconColor="text-orange-400"
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* Trend chart */}
      <PerformanceChart
        series={chartSeries}
        loading={loading}
        title="Page Reach & Engagement Trend"
      />

      {/* Campaign table */}
      <CampaignTable
        campaigns={allCampaigns}
        currency={currency}
        loading={loading}
        platform="meta"
      />
    </div>
  );
}

// ─── LinkedIn Section ─────────────────────────────────────────────────────────

interface LinkedInSectionProps {
  data: LinkedInOverviewResponse | null;
  loading: boolean;
  error?: string | null;
}

export function LinkedInSection({ data, loading, error }: LinkedInSectionProps) {
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-5 text-red-300 text-sm">
        Failed to load LinkedIn data: {error}
      </div>
    );
  }

  const totalFollowers = data?.organizations.reduce((s, o) => s + o.followersCount, 0) ?? 0;
  const totalAdSpend = data?.adAccounts.reduce((s, a) => s + a.totalSpend, 0) ?? 0;
  const allCampaigns = data?.adAccounts.flatMap((a) => a.campaigns) ?? [];
  const totalClicks = allCampaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = allCampaigns.reduce((s, c) => s + c.impressions, 0);
  const currency = data?.adAccounts[0]?.currency ?? 'USD';

  const chartSeries = [
    {
      key: 'impressions',
      label: 'Post Impressions',
      color: '#0A66C2',
      data: data?.insights.impressionsSeries ?? [],
    },
    {
      key: 'clicks',
      label: 'Clicks',
      color: '#10B981',
      data: data?.insights.clicksSeries ?? [],
    },
    {
      key: 'engagement',
      label: 'Engagement',
      color: '#F59E0B',
      data: data?.insights.engagementSeries ?? [],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Account pills */}
      {!loading && data && data.organizations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.organizations.map((org) => (
            <div key={org.id} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5 text-xs text-gray-300">
              {org.logoUrl && (
                <img src={org.logoUrl} alt={org.name} className="w-4 h-4 rounded object-contain bg-white" />
              )}
              <span className="font-medium">{org.name}</span>
              <span className="text-gray-500">/{org.vanityName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Organic metrics */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Organic</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Followers"
            value={loading ? '—' : formatNumber(totalFollowers)}
            subValue={`${data?.organizations.length ?? 0} page(s)`}
            icon={Users}
            iconColor="text-blue-400"
            loading={loading}
          />
          <MetricCard
            label="Post Impressions"
            value={loading ? '—' : formatNumber(data?.insights.impressions ?? 0)}
            subValue={`${formatNumber(data?.insights.uniqueImpressions ?? 0)} unique`}
            icon={Eye}
            iconColor="text-indigo-400"
            loading={loading}
          />
          <MetricCard
            label="Reactions"
            value={loading ? '—' : formatNumber(data?.insights.reactions ?? 0)}
            subValue={`${formatNumber(data?.insights.comments ?? 0)} comments · ${formatNumber(data?.insights.shares ?? 0)} shares`}
            icon={Heart}
            iconColor="text-rose-400"
            loading={loading}
          />
          <MetricCard
            label="Organic Clicks"
            value={loading ? '—' : formatNumber(data?.insights.clicks ?? 0)}
            subValue="Link clicks on posts"
            icon={MousePointerClick}
            iconColor="text-emerald-400"
            loading={loading}
          />
        </div>
      </div>

      {/* Paid metrics */}
      {(loading || totalAdSpend > 0 || allCampaigns.length > 0) && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Paid (Ads)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Ad Spend"
              value={loading ? '—' : formatCurrency(totalAdSpend, currency)}
              subValue={`${data?.adAccounts.length ?? 0} ad account(s)`}
              icon={DollarSign}
              iconColor="text-yellow-400"
              loading={loading}
            />
            <MetricCard
              label="Ad Impressions"
              value={loading ? '—' : formatNumber(totalImpressions)}
              subValue={`${allCampaigns.length} campaigns`}
              icon={BarChart2}
              iconColor="text-blue-400"
              loading={loading}
            />
            <MetricCard
              label="Ad Clicks"
              value={loading ? '—' : formatNumber(totalClicks)}
              subValue="Sponsored clicks"
              icon={MousePointerClick}
              iconColor="text-emerald-400"
              loading={loading}
            />
            <MetricCard
              label="Avg CTR"
              value={loading ? '—' : formatPercent(totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0)}
              subValue="Click-through rate"
              icon={TrendingUp}
              iconColor="text-orange-400"
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* Trend chart */}
      <PerformanceChart
        series={chartSeries}
        loading={loading}
        title="Post Impressions & Engagement Trend"
      />

      {/* Campaign table */}
      <CampaignTable
        campaigns={allCampaigns}
        currency={currency}
        loading={loading}
        platform="linkedin"
      />
    </div>
  );
}
