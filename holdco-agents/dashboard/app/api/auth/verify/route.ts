import { NextResponse } from 'next/server';
import { verifyMagicLink, signSession, isAllowedEmail, SESSION_COOKIE } from '../../../../../shared/auth.js';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const next = url.searchParams.get('next') || '/';

  if (!token) return NextResponse.redirect(new URL('/login?err=missing', req.url));

  const verified = await verifyMagicLink(token);
  if (!verified) return NextResponse.redirect(new URL('/login?err=invalid', req.url));
  if (!isAllowedEmail(verified.email)) return NextResponse.redirect(new URL('/login?err=denied', req.url));

  const session = await signSession(verified.email);
  const resp = NextResponse.redirect(new URL(next, req.url));
  resp.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
  return resp;
}
