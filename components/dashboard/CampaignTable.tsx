'use client';

import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import type { MetaAdCampaign, LinkedInAdCampaign } from '@/types';

type AnyAdCampaign = MetaAdCampaign | LinkedInAdCampaign;

interface CampaignTableProps {
  campaigns: AnyAdCampaign[];
  currency?: string;
  loading?: boolean;
  platform: 'meta' | 'linkedin';
}

function statusColor(status: string) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'bg-emerald-500/20 text-emerald-400';
  if (s === 'PAUSED') return 'bg-yellow-500/20 text-yellow-400';
  if (['ARCHIVED', 'DELETED', 'COMPLETED'].includes(s)) return 'bg-gray-600/30 text-gray-400';
  return 'bg-gray-600/30 text-gray-400';
}

export function CampaignTable({
  campaigns,
  currency = 'USD',
  loading = false,
  platform,
}: CampaignTableProps) {
  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-gray-700">
          <div className="h-4 bg-gray-700 rounded animate-pulse w-40" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-gray-700/50 flex gap-4">
            <div className="h-4 bg-gray-700 rounded animate-pulse flex-1" />
            <div className="h-4 bg-gray-700 rounded animate-pulse w-20" />
            <div className="h-4 bg-gray-700 rounded animate-pulse w-20" />
            <div className="h-4 bg-gray-700 rounded animate-pulse w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-10 text-center">
        <p className="text-gray-500 text-sm">No campaigns found for this period.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">
          Campaign Performance
          <span className="ml-2 text-gray-500 font-normal">({campaigns.length})</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Campaign</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Spend</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Impressions</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Clicks</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">CTR</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">CPC</th>
              {platform === 'meta' && (
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Results</th>
              )}
              {platform === 'linkedin' && (
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Conversions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className="border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors"
              >
                <td className="px-5 py-3.5 text-gray-200 max-w-[200px]">
                  <div className="truncate font-medium">{c.name}</div>
                  {'objective' in c && c.objective && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">{c.objective}</div>
                  )}
                  {'type' in c && c.type && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">{c.type}</div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusColor(c.status))}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-gray-300 font-medium tabular-nums">
                  {formatCurrency(c.spend, currency)}
                </td>
                <td className="px-4 py-3.5 text-right text-gray-300 tabular-nums">
                  {formatNumber(c.impressions)}
                </td>
                <td className="px-4 py-3.5 text-right text-gray-300 tabular-nums">
                  {formatNumber(c.clicks)}
                </td>
                <td className="px-4 py-3.5 text-right text-gray-300 tabular-nums">
                  {formatPercent(c.ctr)}
                </td>
                <td className="px-4 py-3.5 text-right text-gray-300 tabular-nums">
                  {c.cpc > 0 ? formatCurrency(c.cpc, currency) : '—'}
                </td>
                {platform === 'meta' && (
                  <td className="px-4 py-3.5 text-right text-gray-300 tabular-nums">
                    {'actions' in c ? formatNumber(c.actions ?? 0) : '—'}
                  </td>
                )}
                {platform === 'linkedin' && (
                  <td className="px-4 py-3.5 text-right text-gray-300 tabular-nums">
                    {'conversions' in c ? formatNumber(c.conversions ?? 0) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
