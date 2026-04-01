'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useCallback, useRef, useState } from 'react';
import { Header } from '@/components/dashboard/Header';
import { MetaSection, LinkedInSection } from '@/components/dashboard/PlatformSection';
import type {
  MetaOverviewResponse,
  LinkedInOverviewResponse,
  DatePreset,
} from '@/types';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Sign-in screen ──────────────────────────────────────────────────────────

function SignInScreen() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-5 shadow-lg shadow-blue-500/30">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Social Analytics</h1>
          <p className="text-gray-400 text-sm">
            Connect your Meta and LinkedIn accounts to monitor performance in real time.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn('facebook', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Connect with Facebook / Meta
          </button>

          <button
            onClick={() => signIn('linkedin', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 bg-[#0A66C2] hover:bg-[#095da8] text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Connect with LinkedIn
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Your credentials are never stored — only OAuth access tokens are used to read analytics data.
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

type Tab = 'meta' | 'linkedin';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>('meta');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [metaData, setMetaData] = useState<MetaOverviewResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [linkedinData, setLinkedinData] = useState<LinkedInOverviewResponse | null>(null);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connectedProviders = session?.connectedProviders ?? [];
  const metaConnected = connectedProviders.includes('meta');
  const linkedinConnected = connectedProviders.includes('linkedin');

  const fetchMeta = useCallback(async (preset: DatePreset) => {
    if (!metaConnected) return;
    setMetaLoading(true);
    setMetaError(null);
    try {
      const res = await fetch(`/api/meta/overview?preset=${preset}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setMetaData(await res.json());
    } catch (e: unknown) {
      setMetaError(e instanceof Error ? e.message : 'Failed to load Meta data');
    } finally {
      setMetaLoading(false);
    }
  }, [metaConnected]);

  const fetchLinkedIn = useCallback(async (preset: DatePreset) => {
    if (!linkedinConnected) return;
    setLinkedinLoading(true);
    setLinkedinError(null);
    try {
      const res = await fetch(`/api/linkedin/overview?preset=${preset}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setLinkedinData(await res.json());
    } catch (e: unknown) {
      setLinkedinError(e instanceof Error ? e.message : 'Failed to load LinkedIn data');
    } finally {
      setLinkedinLoading(false);
    }
  }, [linkedinConnected]);

  const refresh = useCallback(async (preset: DatePreset) => {
    setIsRefreshing(true);
    await Promise.all([fetchMeta(preset), fetchLinkedIn(preset)]);
    setIsRefreshing(false);
    setLastRefreshed(new Date());
  }, [fetchMeta, fetchLinkedIn]);

  // Initial load + when date preset changes
  useEffect(() => {
    if (status !== 'authenticated') return;
    refresh(datePreset);
  }, [status, datePreset, refresh]);

  // Auto-refresh timer
  useEffect(() => {
    if (status !== 'authenticated') return;
    refreshTimerRef.current = setInterval(() => refresh(datePreset), REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [status, datePreset, refresh]);

  // Set initial active tab based on what's connected
  useEffect(() => {
    if (!metaConnected && linkedinConnected) setActiveTab('linkedin');
    else setActiveTab('meta');
  }, [metaConnected, linkedinConnected]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  // If signed in but no providers connected yet (shouldn't normally happen, but handle gracefully)
  if (!metaConnected && !linkedinConnected) {
    return <SignInScreen />;
  }

  const tabs: { id: Tab; label: string; connected: boolean }[] = [
    { id: 'meta', label: 'Meta (Facebook + Instagram)', connected: metaConnected },
    { id: 'linkedin', label: 'LinkedIn', connected: linkedinConnected },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <Header
        connectedProviders={connectedProviders}
        datePreset={datePreset}
        onDatePresetChange={(p) => setDatePreset(p)}
        onRefresh={() => refresh(datePreset)}
        isRefreshing={isRefreshing}
        lastRefreshed={lastRefreshed}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Platform tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-4 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.connected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
              {!tab.connected && (
                <span className="text-xs text-gray-600">(not connected)</span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Platform content */}
        {activeTab === 'meta' && (
          <div>
            {!metaConnected ? (
              <div className="text-center py-20">
                <p className="text-gray-500 mb-4">Meta account not connected.</p>
                <button
                  onClick={() => signIn('facebook')}
                  className="px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Connect with Facebook / Meta
                </button>
              </div>
            ) : (
              <MetaSection data={metaData} loading={metaLoading} error={metaError} />
            )}
          </div>
        )}

        {activeTab === 'linkedin' && (
          <div>
            {!linkedinConnected ? (
              <div className="text-center py-20">
                <p className="text-gray-500 mb-4">LinkedIn account not connected.</p>
                <button
                  onClick={() => signIn('linkedin')}
                  className="px-4 py-2 bg-[#0A66C2] hover:bg-[#095da8] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Connect with LinkedIn
                </button>
              </div>
            ) : (
              <LinkedInSection data={linkedinData} loading={linkedinLoading} error={linkedinError} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
