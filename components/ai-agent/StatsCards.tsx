'use client';

import { Activity, Bot, Eye, Zap } from 'lucide-react';
import type { SiteStats } from '@/lib/ai-agent/types';

interface Props {
  stats: SiteStats | null;
  loading: boolean;
}

export function StatsCards({ stats, loading }: Props) {
  const cards = [
    {
      label: 'Total engagements',
      value: stats?.totalEvents ?? 0,
      icon: Activity,
      color: 'text-blue-400',
    },
    {
      label: 'Live AI agents',
      value: stats?.liveAgentEvents ?? 0,
      icon: Zap,
      color: 'text-emerald-400',
    },
    {
      label: 'Crawler visits',
      value: stats?.crawlerEvents ?? 0,
      icon: Bot,
      color: 'text-indigo-400',
    },
    {
      label: 'Last 24h',
      value: stats?.last24h ?? 0,
      icon: Eye,
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="bg-gray-800/50 border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                {c.label}
              </span>
              <Icon size={14} className={c.color} />
            </div>
            <div className="text-2xl font-semibold text-white">
              {loading ? '—' : c.value.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
