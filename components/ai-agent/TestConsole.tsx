'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import type { AgentSiteConfig } from '@/lib/ai-agent/types';

interface Props {
  site: AgentSiteConfig;
}

export function TestConsole({ site }: Props) {
  const [query, setQuery] = useState('best fresh-roasted coffee subscription');
  const [bot, setBot] = useState<'none' | 'GPTBot' | 'ChatGPT-User' | 'PerplexityBot' | 'ClaudeBot'>('GPTBot');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (bot !== 'none') headers['x-simulated-user-agent'] = bot;
      // We use the engage endpoint to mirror the real path; for bot simulation
      // we re-send the chosen UA in a custom header that the server inspects
      // via the user-agent header — so we just call query for query intent.
      const res = await fetch('/api/ai-agent/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({ siteKey: site.siteKey, query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
      } else {
        setResponse(data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-gray-300 mb-1">Test the agent</h3>
        <p className="text-[11px] text-gray-500">
          Simulate an AI search query and see exactly what the agent will hand back to a crawler or live agent.
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-2">
        <input
          className="flex-1 bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. fresh roasted coffee subscription portland"
        />
        <select
          className="bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200"
          value={bot}
          onChange={(e) => setBot(e.target.value as typeof bot)}
        >
          <option value="none">No bot UA</option>
          <option value="GPTBot">GPTBot (crawler)</option>
          <option value="ChatGPT-User">ChatGPT-User (live)</option>
          <option value="PerplexityBot">PerplexityBot</option>
          <option value="ClaudeBot">ClaudeBot</option>
        </select>
        <button
          onClick={run}
          disabled={loading || !query.trim()}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
        >
          <Send size={13} />
          {loading ? 'Querying…' : 'Run'}
        </button>
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs rounded p-2">
          {error}
        </div>
      )}
      {response !== null && (
        <pre className="text-[11px] text-gray-300 bg-black/40 border border-gray-800 rounded p-3 max-h-96 overflow-auto font-mono">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
}
