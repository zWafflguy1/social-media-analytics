import { NextResponse } from 'next/server';
import { signMagicLink, isAllowedEmail } from '../../../../../shared/auth.js';
import { sendEmail } from '../../../../../shared/email/resend.js';

export async function POST(req: Request) {
  let body: { email?: string; next?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const email = (body.email ?? '').trim().toLowerCase();
  const next = body.next ?? '/';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  // Don't leak which emails are allowed. Always return 200 to the same prompt.
  // But still skip the actual send if not allowed.
  if (isAllowedEmail(email)) {
    const token = await signMagicLink(email);
    const origin = new URL(req.url).origin;
    const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:24px auto;padding:24px;border:1px solid #d0d7de;border-radius:8px">
        <div style="font-weight:600;font-size:18px;margin-bottom:8px">HoldCo · Agents</div>
        <div style="color:#6e7681;font-size:13px;margin-bottom:16px">Click below to sign in. This link expires in 15 minutes.</div>
        <a href="${link}" style="display:inline-block;padding:10px 16px;background:#0969da;color:#fff;border-radius:6px;text-decoration:none;font-size:14px">Sign in</a>
        <div style="margin-top:24px;font-size:11px;color:#6e7681;word-break:break-all">If the button doesn't work, paste this URL in your browser:<br>${link}</div>
      </div>`;
    const text = `Sign in to HoldCo Agents: ${link}\n\nThis link expires in 15 minutes.`;

    const result = await sendEmail({ to: email, subject: 'Your HoldCo sign-in link', html, text });
    if (result.error) {
      console.error('[auth/request] send failed:', result.error);
      // Return 500 only on infra failure, not "email not allowed"
      return NextResponse.json({ error: 'send failed: ' + result.error }, { status: 500 });
    }
  } else {
    console.warn('[auth/request] denied for', email);
  }

  return NextResponse.json({ ok: true });
}
