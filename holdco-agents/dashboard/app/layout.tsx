import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = { title: 'HoldCo Agents', description: 'Autonomous holding-company agent dashboard' };

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/deals', label: 'Deals' },
  { href: '/outreach', label: 'Outreach' },
  { href: '/investors', label: 'Investors' },
  { href: '/lenders', label: 'Lenders' },
  { href: '/reports', label: 'Reports' },
  { href: '/agents', label: 'Agents' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
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
            <div className="mt-auto text-xs text-[var(--muted)]">v0.1 · local</div>
          </aside>
          <main className="flex-1 p-6 max-w-6xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
