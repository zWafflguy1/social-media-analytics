import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../shared/auth.js';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths (no auth required)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
  }

  const session = await verifySession(cookie);
  if (!session) {
    const resp = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
    resp.cookies.delete(SESSION_COOKIE);
    return resp;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
