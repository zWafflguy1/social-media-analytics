'use client';

import { Globe, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentSiteConfig } from '@/lib/ai-agent/types';

interface Props {
  sites: AgentSiteConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function SiteList({ sites, selectedId, onSelect, onCreate, onDelete }: Props) {
  return (
    <aside className="w-full md:w-72 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Connected sites
        </h2>
        <button
          onClick={onCreate}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {sites.length === 0 && (
          <div className="text-xs text-gray-500 italic">
            No sites yet — click Add to register one.
          </div>
        )}
        {sites.map((s) => (
          <div
            key={s.id}
            className={cn(
              'group relative flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
              selectedId === s.id
                ? 'bg-blue-500/10 border-blue-500/50'
                : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'
            )}
            onClick={() => onSelect(s.id)}
          >
            <Globe size={14} className="mt-0.5 text-gray-500" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{s.brandName}</div>
              <div className="text-xs text-gray-500 truncate">{s.domain}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${s.brandName}? This removes its config and events.`)) {
                  onDelete(s.id);
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
              aria-label="Delete site"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
