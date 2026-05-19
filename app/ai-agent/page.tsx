'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { ArrowLeft, Bot, RefreshCw } from 'lucide-react';
import { SiteList } from '@/components/ai-agent/SiteList';
import { SiteForm } from '@/components/ai-agent/SiteForm';
import { EmbedSnippet } from '@/components/ai-agent/EmbedSnippet';
import { StatsCards } from '@/components/ai-agent/StatsCards';
import { EventsTable } from '@/components/ai-agent/EventsTable';
import { TestConsole } from '@/components/ai-agent/TestConsole';
import type {
  AgentSiteConfig,
  EngagementEvent,
  SiteStats,
} from '@/lib/ai-agent/types';

const REFRESH_MS = 30_000;

export default function AiAgentPage() {
  const { data: session, status } = useSession();
  const [sites, setSites] = useState<AgentSiteConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<EngagementEvent[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedId) ?? null,
    [sites, selectedId]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const loadSites = useCallback(async () => {
    const res = await fetch('/api/ai-agent/sites');
    if (!res.ok) return;
    const data = (await res.json()) as { sites: AgentSiteConfig[] };
    setSites(data.sites);
    if (data.sites.length > 0 && !selectedId) {
      setSelectedId(data.sites[0].id);
    }
  }, [selectedId]);

  const loadEvents = useCallback(async (siteId: string | null) => {
    setEventsLoading(true);
    try {
      const url = siteId
        ? `/api/ai-agent/events?siteId=${siteId}&limit=100`
        : '/api/ai-agent/events?limit=100';
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { events: EngagementEvent[] };
        setEvents(data.events);
      }
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async (siteId: string | null) => {
    const url = siteId
      ? `/api/ai-agent/stats?siteId=${siteId}`
      : '/api/ai-agent/stats';
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { stats: SiteStats };
      setStats(data.stats);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSites(), loadEvents(selectedId), loadStats(selectedId)]);
  }, [loadSites, loadEvents, loadStats, selectedId]);

  // Initial load
  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      setLoading(true);
      await loadSites();
      setLoading(false);
    })();
  }, [status, loadSites]);

  // Reload events + stats when selection changes
  useEffect(() => {
    if (status !== 'authenticated') return;
    loadEvents(selectedId);
    loadStats(selectedId);
  }, [selectedId, status, loadEvents, loadStats]);

  // Auto-refresh
  useEffect(() => {
    if (status !== 'authenticated') return;
    timerRef.current = setInterval(refreshAll, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, refreshAll]);

  async function handleCreate() {
    const brandName = prompt('Brand or site name?');
    if (!brandName) return;
    const domain = prompt('Domain (no protocol)?', 'example.com');
    if (!domain) return;
    const res = await fetch('/api/ai-agent/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandName, domain }),
    });
    if (res.ok) {
      const data = (await res.json()) as { site: AgentSiteConfig };
      await loadSites();
      setSelectedId(data.site.id);
    }
  }

  async function handleSave(patch: Partial<AgentSiteConfig>) {
    if (!selectedSite) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-agent/sites/${selectedSite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) await loadSites();
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateKey() {
    if (!selectedSite) return;
    const res = await fetch(`/api/ai-agent/sites/${selectedSite.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rotateKey' }),
    });
    if (res.ok) await loadSites();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/ai-agent/sites/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (selectedId === id) setSelectedId(null);
      await loadSites();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Bot size={36} className="mx-auto mb-4 text-blue-400" />
          <h1 className="text-xl font-semibold text-white mb-2">Sign in to manage AI agents</h1>
          <p className="text-sm text-gray-400 mb-5">
            The AI Search Elevation Agent dashboard requires you to be signed in.
          </p>
          <button
            onClick={() => signIn()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
            >
              <ArrowLeft size={14} />
              Back to analytics
            </Link>
            <span className="text-gray-700">|</span>
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-blue-400" />
              <h1 className="text-sm font-semibold text-white">AI Search Elevation Agent</h1>
            </div>
          </div>
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center text-gray-500 py-20">Loading sites…</div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            <SiteList
              sites={sites}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={handleCreate}
              onDelete={handleDelete}
            />

            <section className="flex-1 min-w-0 space-y-6">
              <StatsCards stats={stats} loading={false} />

              {selectedSite ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h2 className="text-sm font-semibold text-gray-300">
                        Embed for {selectedSite.brandName}
                      </h2>
                      {origin && <EmbedSnippet site={selectedSite} origin={origin} />}
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-sm font-semibold text-gray-300">Live test console</h2>
                      <TestConsole site={selectedSite} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-300">Configuration</h2>
                    <SiteForm
                      site={selectedSite}
                      onSave={handleSave}
                      onRotateKey={handleRotateKey}
                      saving={saving}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 py-20">
                  Select a site on the left, or click <strong className="text-gray-300">+ Add</strong> to register one.
                </div>
              )}

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-300">
                  Recent AI engagement events
                </h2>
                <EventsTable events={events} loading={eventsLoading} />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
