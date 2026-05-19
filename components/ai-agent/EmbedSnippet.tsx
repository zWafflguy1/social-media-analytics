'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { AgentSiteConfig } from '@/lib/ai-agent/types';

interface Props {
  site: AgentSiteConfig;
  origin: string;
}

export function EmbedSnippet({ site, origin }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const scriptTag = `<script async src="${origin}/api/ai-agent/embed?siteKey=${site.siteKey}"></script>`;
  const llmsTxt = `${origin}/api/ai-agent/llms-txt?siteKey=${site.siteKey}`;
  const engageUrl = `${origin}/api/ai-agent/engage?siteKey=${site.siteKey}`;
  const queryUrl = `${origin}/api/ai-agent/query`;

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const rows: { label: string; value: string; hint: string }[] = [
    {
      label: 'Embed script',
      value: scriptTag,
      hint: 'Drop this in the <head> of every page on the client site.',
    },
    {
      label: 'llms.txt URL',
      value: llmsTxt,
      hint: 'Proxy or mirror this at /llms.txt on the client domain.',
    },
    {
      label: 'Engage endpoint',
      value: engageUrl,
      hint: 'Server-to-server elevation endpoint. AI agents and SSR can call it.',
    },
    {
      label: 'Query endpoint',
      value: queryUrl,
      hint: 'POST { siteKey, query } to get a structured AI-friendly answer.',
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-300">{r.label}</span>
            <button
              onClick={() => copy(r.label, r.value)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {copied === r.label ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <code className="block text-xs text-gray-300 bg-black/40 rounded p-2 overflow-x-auto whitespace-nowrap font-mono">
            {r.value}
          </code>
          <p className="text-[11px] text-gray-500 mt-1.5">{r.hint}</p>
        </div>
      ))}
    </div>
  );
}
