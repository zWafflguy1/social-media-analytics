import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../../shared/auth.js';

export async function POST(req: Request) {
  const resp = NextResponse.redirect(new URL('/login', req.url));
  resp.cookies.delete(SESSION_COOKIE);
  return resp;
}

export async function GET(req: Request) {
  return POST(req);
}
