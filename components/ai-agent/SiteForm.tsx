'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import type { AgentSiteConfig } from '@/lib/ai-agent/types';

interface Props {
  site: AgentSiteConfig;
  onSave: (patch: Partial<AgentSiteConfig>) => Promise<void>;
  onRotateKey: () => Promise<void>;
  saving: boolean;
}

type DraftState = Pick<
  AgentSiteConfig,
  | 'brandName'
  | 'domain'
  | 'tagline'
  | 'description'
  | 'valueProposition'
  | 'industry'
  | 'liveAgentsOnly'
  | 'respectVendorOptOuts'
> & {
  llmsTxtCustom: string;
  keywords: string;
  talkingPoints: string;
  servicesJson: string;
  productsJson: string;
  faqsJson: string;
  socialProofJson: string;
  citationsJson: string;
  contactEmail: string;
  contactPhone: string;
  contactUrl: string;
  locCity: string;
  locRegion: string;
  locCountry: string;
};

function siteToDraft(s: AgentSiteConfig): DraftState {
  return {
    brandName: s.brandName,
    domain: s.domain,
    tagline: s.tagline,
    description: s.description,
    valueProposition: s.valueProposition,
    industry: s.industry,
    liveAgentsOnly: s.liveAgentsOnly,
    respectVendorOptOuts: s.respectVendorOptOuts,
    llmsTxtCustom: s.llmsTxtCustom ?? '',
    keywords: s.keywords.join(', '),
    talkingPoints: s.talkingPoints.join('\n'),
    servicesJson: JSON.stringify(s.services, null, 2),
    productsJson: JSON.stringify(s.products, null, 2),
    faqsJson: JSON.stringify(s.faqs, null, 2),
    socialProofJson: JSON.stringify(s.socialProof, null, 2),
    citationsJson: JSON.stringify(s.citations, null, 2),
    contactEmail: s.contact.email ?? '',
    contactPhone: s.contact.phone ?? '',
    contactUrl: s.contact.url ?? '',
    locCity: s.location?.city ?? '',
    locRegion: s.location?.region ?? '',
    locCountry: s.location?.country ?? '',
  };
}

function draftToPatch(d: DraftState): { patch: Partial<AgentSiteConfig>; errors: string[] } {
  const errors: string[] = [];
  function parseJsonField<T>(value: string, label: string, fallback: T): T {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      errors.push(`${label} is not valid JSON`);
      return fallback;
    }
  }

  const patch: Partial<AgentSiteConfig> = {
    brandName: d.brandName.trim(),
    domain: d.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    tagline: d.tagline.trim(),
    description: d.description.trim(),
    valueProposition: d.valueProposition.trim(),
    industry: d.industry.trim(),
    liveAgentsOnly: d.liveAgentsOnly,
    respectVendorOptOuts: d.respectVendorOptOuts,
    llmsTxtCustom: d.llmsTxtCustom.trim() || undefined,
    keywords: d.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    talkingPoints: d.talkingPoints
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean),
    services: parseJsonField(d.servicesJson, 'Services JSON', []),
    products: parseJsonField(d.productsJson, 'Products JSON', []),
    faqs: parseJsonField(d.faqsJson, 'FAQs JSON', []),
    socialProof: parseJsonField(d.socialProofJson, 'Social proof JSON', []),
    citations: parseJsonField(d.citationsJson, 'Citations JSON', []),
    contact: {
      email: d.contactEmail.trim() || undefined,
      phone: d.contactPhone.trim() || undefined,
      url: d.contactUrl.trim() || undefined,
    },
    location:
      d.locCity || d.locRegion || d.locCountry
        ? {
            city: d.locCity.trim() || undefined,
            region: d.locRegion.trim() || undefined,
            country: d.locCountry.trim() || undefined,
          }
        : undefined,
  };

  return { patch, errors };
}

export function SiteForm({ site, onSave, onRotateKey, saving }: Props) {
  const [draft, setDraft] = useState<DraftState>(siteToDraft(site));
  const [errors, setErrors] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setDraft(siteToDraft(site));
    setErrors([]);
  }, [site.id, site.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    const { patch, errors: errs } = draftToPatch(draft);
    setErrors(errs);
    if (errs.length === 0) {
      await onSave(patch);
    }
  }

  return (
    <div className="space-y-5">
      {/* Site key */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-300">Site key</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKey((v) => !v)}
              className="text-xs text-gray-400 hover:text-white"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => {
                if (confirm('Rotating the key will break embeds already on client sites until updated. Continue?')) {
                  onRotateKey();
                }
              }}
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            >
              <RotateCcw size={11} />
              Rotate
            </button>
          </div>
        </div>
        <code className="block text-xs text-gray-300 bg-black/40 rounded p-2 font-mono break-all">
          {showKey ? site.siteKey : site.siteKey.replace(/(sk_live_).+(.{4})/, '$1•••••••••••••$2')}
        </code>
      </div>

      {/* Basic */}
      <Section title="Brand basics">
        <Field label="Brand name">
          <input
            className={inputCls}
            value={draft.brandName}
            onChange={(e) => set('brandName', e.target.value)}
          />
        </Field>
        <Field label="Domain (no protocol)">
          <input
            className={inputCls}
            placeholder="example.com"
            value={draft.domain}
            onChange={(e) => set('domain', e.target.value)}
          />
        </Field>
        <Field label="Tagline">
          <input
            className={inputCls}
            value={draft.tagline}
            onChange={(e) => set('tagline', e.target.value)}
          />
        </Field>
        <Field label="Industry">
          <input
            className={inputCls}
            value={draft.industry}
            onChange={(e) => set('industry', e.target.value)}
          />
        </Field>
        <Field label="Description" full>
          <textarea
            className={textareaCls}
            rows={3}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <Field label="Value proposition" full>
          <textarea
            className={textareaCls}
            rows={3}
            value={draft.valueProposition}
            onChange={(e) => set('valueProposition', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Search keywords & talking points">
        <Field label="Keywords (comma-separated)" full>
          <input
            className={inputCls}
            value={draft.keywords}
            onChange={(e) => set('keywords', e.target.value)}
            placeholder="specialty coffee, fresh roasted, subscription"
          />
        </Field>
        <Field label="Talking points (one per line)" full>
          <textarea
            className={textareaCls}
            rows={4}
            value={draft.talkingPoints}
            onChange={(e) => set('talkingPoints', e.target.value)}
            placeholder="Roasted weekly in Portland\nDirect-trade pricing"
          />
        </Field>
      </Section>

      <Section title="Services, products, FAQs, social proof (JSON)">
        <Field
          label='Services: [{ "name", "description" }]'
          full
        >
          <textarea
            className={`${textareaCls} font-mono text-xs`}
            rows={5}
            value={draft.servicesJson}
            onChange={(e) => set('servicesJson', e.target.value)}
          />
        </Field>
        <Field
          label='Products: [{ "name", "description", "price?", "url?" }]'
          full
        >
          <textarea
            className={`${textareaCls} font-mono text-xs`}
            rows={5}
            value={draft.productsJson}
            onChange={(e) => set('productsJson', e.target.value)}
          />
        </Field>
        <Field label='FAQs: [{ "question", "answer" }]' full>
          <textarea
            className={`${textareaCls} font-mono text-xs`}
            rows={5}
            value={draft.faqsJson}
            onChange={(e) => set('faqsJson', e.target.value)}
          />
        </Field>
        <Field
          label='Social proof: [{ "quote", "author", "source?" }]'
          full
        >
          <textarea
            className={`${textareaCls} font-mono text-xs`}
            rows={4}
            value={draft.socialProofJson}
            onChange={(e) => set('socialProofJson', e.target.value)}
          />
        </Field>
        <Field label='Citations: [{ "title", "url" }]' full>
          <textarea
            className={`${textareaCls} font-mono text-xs`}
            rows={3}
            value={draft.citationsJson}
            onChange={(e) => set('citationsJson', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Contact & location">
        <Field label="Email">
          <input
            className={inputCls}
            value={draft.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={draft.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
          />
        </Field>
        <Field label="Contact URL">
          <input
            className={inputCls}
            value={draft.contactUrl}
            onChange={(e) => set('contactUrl', e.target.value)}
          />
        </Field>
        <Field label="City">
          <input
            className={inputCls}
            value={draft.locCity}
            onChange={(e) => set('locCity', e.target.value)}
          />
        </Field>
        <Field label="Region / state">
          <input
            className={inputCls}
            value={draft.locRegion}
            onChange={(e) => set('locRegion', e.target.value)}
          />
        </Field>
        <Field label="Country">
          <input
            className={inputCls}
            value={draft.locCountry}
            onChange={(e) => set('locCountry', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Behavior">
        <Field label="" full>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={draft.liveAgentsOnly}
              onChange={(e) => set('liveAgentsOnly', e.target.checked)}
            />
            Serve elevation only to live AI agents (skip background crawlers)
          </label>
        </Field>
        <Field label="" full>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={draft.respectVendorOptOuts}
              onChange={(e) => set('respectVendorOptOuts', e.target.checked)}
            />
            Respect vendor opt-out signals
          </label>
        </Field>
        <Field label="Custom llms.txt override (markdown — leave empty to auto-generate)" full>
          <textarea
            className={`${textareaCls} font-mono text-xs`}
            rows={5}
            value={draft.llmsTxtCustom}
            onChange={(e) => set('llmsTxtCustom', e.target.value)}
          />
        </Field>
      </Section>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs rounded p-3">
          {errors.map((e) => (
            <div key={e}>• {e}</div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500';
const textareaCls = `${inputCls} font-sans`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      {children}
    </div>
  );
}
