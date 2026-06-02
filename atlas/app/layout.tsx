import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Atlas — AI Knowledge Layer",
  description: "Institutional memory + agency for the business",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/chat", label: "Ask Atlas" },
  { href: "/data", label: "Data Inputs" },
  { href: "/workforce", label: "Workforce" },
  { href: "/approvals", label: "Approvals" },
  { href: "/onboarding", label: "Onboarding" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-slate-100">
        <div className="flex">
          <aside className="w-56 shrink-0 border-r border-white/10 p-5 min-h-screen">
            <div className="text-xl font-semibold tracking-tight">Atlas</div>
            <div className="mt-1 text-xs text-slate-400">knowledge layer</div>
            <nav className="mt-8 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
