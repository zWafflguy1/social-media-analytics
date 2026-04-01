'use client';

import { RefreshCw, LogOut, ChevronDown } from 'lucide-react';
import { signOut, signIn } from 'next-auth/react';
import { cn } from '@/lib/utils';
import type { DatePreset } from '@/types';

interface HeaderProps {
  connectedProviders: string[];
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshed: Date | null;
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function ConnectButton({ provider, label, color }: { provider: string; label: string; color: string }) {
  return (
    <button
      onClick={() => signIn(provider)}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
        color
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      Connect {label}
    </button>
  );
}

export function Header({
  connectedProviders,
  datePreset,
  onDatePresetChange,
  onRefresh,
  isRefreshing,
  lastRefreshed,
}: HeaderProps) {
  const metaConnected = connectedProviders.includes('meta');
  const linkedinConnected = connectedProviders.includes('linkedin');

  return (
    <header className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Social Analytics</h1>
            {lastRefreshed && (
              <p className="text-xs text-gray-500">
                Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Connect buttons for disconnected providers */}
          {!metaConnected && (
            <ConnectButton
              provider="facebook"
              label="Meta"
              color="border-blue-700 text-blue-400 hover:bg-blue-900/30"
            />
          )}
          {!linkedinConnected && (
            <ConnectButton
              provider="linkedin"
              label="LinkedIn"
              color="border-blue-600 text-sky-400 hover:bg-sky-900/30"
            />
          )}

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {metaConnected && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2.5 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Meta
              </span>
            )}
            {linkedinConnected && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2.5 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LinkedIn
              </span>
            )}
          </div>

          {/* Date preset */}
          <div className="relative">
            <select
              value={datePreset}
              onChange={(e) => onDatePresetChange(e.target.value as DatePreset)}
              className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={12} />
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Sign out */}
          {(metaConnected || linkedinConnected) && (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors rounded-lg hover:bg-gray-800"
            >
              <LogOut size={12} />
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
