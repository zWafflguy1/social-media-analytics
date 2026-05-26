// Auth primitives shared between Next.js middleware (Edge runtime) and API routes
// (Node runtime). Uses Web Crypto so the same code runs in both.
//
// Token format: base64url(email + ':' + expiryMs + ':' + sig)
// Session cookies use a longer TTL (30 days). Magic links use 15 minutes.

const enc = new TextEncoder();

function getSecret(): string {
  const s = process.env.DASHBOARD_SECRET;
  if (!s || s.length < 16) {
    // Don't throw in middleware (would 500 every request). Log and use a clearly-broken
    // default so dev still works but production must set it.
    if (process.env.NODE_ENV === 'production') {
      console.warn('[auth] DASHBOARD_SECRET missing or too short — auth is insecure.');
    }
    return s || 'CHANGE-ME-IN-DOTENV-PLEASE-AT-LEAST-32-BYTES';
  }
  return s;
}

async function hmacSign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bufToB64Url(new Uint8Array(sigBuf));
}

async function signToken(email: string, ttlMs: number): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const expiry = Date.now() + ttlMs;
  const payload = `${normalized}:${expiry}`;
  const sig = await hmacSign(payload);
  return strToB64Url(`${payload}:${sig}`);
}

async function verifyToken(token: string): Promise<{ email: string; expiry: number } | null> {
  try {
    const decoded = b64UrlToStr(token);
    const idx = decoded.lastIndexOf(':');
    if (idx === -1) return null;
    const payload = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    const expected = await hmacSign(payload);
    if (!timingSafeEqual(sig, expected)) return null;
    const parts = payload.split(':');
    if (parts.length !== 2) return null;
    const [email, expiryStr] = parts;
    const expiry = Number(expiryStr);
    if (!email || !Number.isFinite(expiry)) return null;
    if (Date.now() > expiry) return null;
    return { email, expiry };
  } catch {
    return null;
  }
}

export async function signSession(email: string): Promise<string> {
  return signToken(email, 30 * 24 * 3600 * 1000);   // 30 days
}
export async function verifySession(token: string): Promise<{ email: string } | null> {
  const v = await verifyToken(token);
  return v ? { email: v.email } : null;
}
export async function signMagicLink(email: string): Promise<string> {
  return signToken(email, 15 * 60 * 1000);          // 15 minutes
}
export async function verifyMagicLink(token: string): Promise<{ email: string } | null> {
  const v = await verifyToken(token);
  return v ? { email: v.email } : null;
}

export function isAllowedEmail(email: string): boolean {
  const allow = (process.env.DASHBOARD_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}

export const SESSION_COOKIE = 'holdco_session';

// --- base64url helpers (no Buffer, so this works in Edge too) ---

function bufToB64Url(buf: Uint8Array): string {
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return strToB64Url(s);
}
function strToB64Url(s: string): string {
  const b64 = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(s)))
    : Buffer.from(s, 'utf8').toString('base64');
  return b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64UrlToStr(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  if (typeof atob !== 'undefined') return decodeURIComponent(escape(atob(b64)));
  return Buffer.from(b64, 'base64').toString('utf8');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
