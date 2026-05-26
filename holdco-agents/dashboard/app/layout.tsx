import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '../../shared/auth.js';

export const metadata = { title: 'HoldCo Agents', description: 'Autonomous holding-company agent dashboard' };

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/deals', label: 'Deals' },
  { href: '/outreach', label: 'Outreach' },
  { href: '/investors', label: 'Investors' },
  { href: '/investors/candidates', label: '↳ Candidates' },
  { href: '/lenders', label: 'Lenders' },
  { href: '/reports', label: 'Reports' },
  { href: '/agents', label: 'Agents' },
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  const session = sessionCookie ? await verifySession(sessionCookie) : null;

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex">
          <aside className="w-56 border-r border-[var(--border)] bg-[#f6f8fa] p-4 flex flex-col">
            <div className="font-semibold text-lg mb-6">HoldCo · Agents</div>
            <nav className="flex flex-col gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-2 py-1.5 rounded hover:bg-white">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto text-xs text-[var(--muted)] space-y-1">
              {session && <div className="truncate" title={session.email}>{session.email}</div>}
              {session && (
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="text-left underline hover:no-underline">Sign out</button>
                </form>
              )}
              <div>v0.1 · local</div>
            </div>
          </aside>
          <main className="flex-1 p-6 max-w-6xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
