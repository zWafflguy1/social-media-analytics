'use client';

import { cn } from '@/lib/utils';
import type { EngagementEvent } from '@/lib/ai-agent/types';

interface Props {
  events: EngagementEvent[];
  loading: boolean;
}

const outcomeStyle: Record<string, string> = {
  elevated: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  engaged: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  logged: 'text-gray-300 bg-gray-500/10 border-gray-500/30',
  rejected: 'text-red-300 bg-red-500/10 border-red-500/30',
};

export function EventsTable({ events, loading }: Props) {
  if (loading) {
    return <div className="text-xs text-gray-500 py-8 text-center">Loading events…</div>;
  }
  if (events.length === 0) {
    return (
      <div className="text-xs text-gray-500 py-8 text-center">
        No engagement events yet — once an AI bot or your embed pings the agent, it shows up here.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border border-gray-800 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-900/60">
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Bot</th>
            <th className="px-3 py-2 font-medium">Vendor</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Path / Query</th>
            <th className="px-3 py-2 font-medium">Intent</th>
            <th className="px-3 py-2 font-medium">Outcome</th>
            <th className="px-3 py-2 font-medium text-right">Bytes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {events.map((e) => (
            <tr key={e.id} className="hover:bg-gray-900/40">
              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                {new Date(e.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </td>
              <td className="px-3 py-2 text-xs text-gray-300 whitespace-nowrap">
                {e.bot?.bot ?? <span className="text-gray-500">non-AI</span>}
              </td>
              <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                {e.bot?.vendor ?? '—'}
              </td>
              <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                {e.bot?.isLiveAgent ? 'live' : e.bot?.isCrawler ? 'crawler' : '—'}
              </td>
              <td className="px-3 py-2 text-xs text-gray-300 max-w-xs truncate">
                {e.query ? `"${e.query}"` : e.path}
              </td>
              <td className="px-3 py-2 text-xs text-gray-400">{e.intent ?? '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'inline-flex px-2 py-0.5 rounded text-[10px] border uppercase tracking-wide',
                    outcomeStyle[e.outcome]
                  )}
                >
                  {e.outcome}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500 text-right tabular-nums">
                {e.responseBytes.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
