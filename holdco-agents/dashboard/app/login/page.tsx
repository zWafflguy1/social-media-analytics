'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setMsg(null);
    const next = new URLSearchParams(window.location.search).get('next') ?? '/';
    try {
      const r = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Request failed');
      setStatus('sent');
      setMsg('Check your email for a sign-in link. It expires in 15 minutes.');
    } catch (e) {
      setStatus('error');
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: 360, border: '1px solid #d0d7de', borderRadius: 8, padding: 24, background: 'white' }}>
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>HoldCo · Agents</div>
        <div style={{ color: '#6e7681', fontSize: 13, marginBottom: 20 }}>Sign in to access the dashboard.</div>
        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 12, color: '#6e7681', marginBottom: 4 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourholdco.com"
            disabled={status === 'sending' || status === 'sent'}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d7de', borderRadius: 6, fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={status === 'sending' || status === 'sent' || !email}
            style={{ width: '100%', marginTop: 12, padding: '9px', border: 'none', background: '#0969da', color: 'white', borderRadius: 6, fontSize: 14, cursor: 'pointer', opacity: status === 'sending' || status === 'sent' ? 0.6 : 1 }}
          >
            {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Link sent' : 'Send sign-in link'}
          </button>
        </form>
        {msg && (
          <div style={{ marginTop: 14, padding: 10, background: status === 'error' ? '#ffebee' : '#e8f5e9', color: status === 'error' ? '#c62828' : '#1b5e20', borderRadius: 6, fontSize: 13 }}>
            {msg}
          </div>
        )}
        <div style={{ marginTop: 18, fontSize: 11, color: '#6e7681' }}>
          Only emails in <code>DASHBOARD_ALLOWED_EMAILS</code> can sign in.
        </div>
      </div>
    </div>
  );
}
