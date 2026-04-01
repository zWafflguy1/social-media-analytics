'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: number; // % change vs prior period
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconColor = 'text-blue-400',
  trend,
  loading = false,
}: MetricCardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={cn('p-2 rounded-lg bg-gray-700/50', iconColor)}>
          <Icon size={14} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-7 bg-gray-700 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
          <div className="flex items-center justify-between">
            {subValue && <span className="text-xs text-gray-400">{subValue}</span>}
            {trend !== undefined && (
              <span
                className={cn(
                  'text-xs font-medium ml-auto',
                  trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
                )}
              >
                {trend > 0 ? '▲' : trend < 0 ? '▼' : '–'}{' '}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
