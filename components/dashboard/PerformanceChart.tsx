'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TimeSeriesPoint } from '@/types';
import { formatDate, formatNumber } from '@/lib/utils';

interface Series {
  key: string;
  label: string;
  color: string;
  data: TimeSeriesPoint[];
}

interface PerformanceChartProps {
  series: Series[];
  loading?: boolean;
  title?: string;
}

function mergeSeriesData(seriesList: Series[]): Record<string, number | string>[] {
  const dateMap = new Map<string, Record<string, number | string>>();

  for (const s of seriesList) {
    for (const point of s.data) {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, { date: point.date });
      }
      dateMap.get(point.date)![s.key] = point.value;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-2">{label ? formatDate(String(label)) : ''}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-medium">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function PerformanceChart({ series, loading = false, title }: PerformanceChartProps) {
  const data = mergeSeriesData(series);

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        {title && <p className="text-sm font-medium text-gray-300 mb-4">{title}</p>}
        <div className="h-52 bg-gray-700/40 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        {title && <p className="text-sm font-medium text-gray-300 mb-4">{title}</p>}
        <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
          No trend data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      {title && <p className="text-sm font-medium text-gray-300 mb-4">{title}</p>}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(v) => formatDate(String(v))}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(v) => formatNumber(Number(v))}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#9CA3AF', paddingTop: '12px' }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
