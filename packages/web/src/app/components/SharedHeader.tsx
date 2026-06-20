"use client";

import Link from "next/link";

export default function SharedHeader() {
  return (
    <header className="header-bar shrink-0 sticky top-0 z-50" style={{ background: "var(--surface)", borderBottom: "1px solid var(--rule)" }}>
      <div className="max-w-[1440px] mx-auto px-3 md:px-6 h-12 flex items-center justify-between">
        <Link href="/" className="no-underline flex items-center gap-2 shrink-0">
          <img src="/logo-icon.png" alt="TS" className="shrink-0" style={{ height: 18, width: "auto", objectFit: "contain" }} />
          <span className="masthead-wordmark text-lg leading-none" style={{ color: "var(--ink)" }}>Truthseekers</span>
        </Link>

        <nav className="flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
          <Link href="/articles" className="no-underline hover:underline" style={{ color: "var(--ink-secondary)" }}>Articles</Link>
          <Link href="/maps" className="no-underline hover:underline" style={{ color: "var(--ink-secondary)" }}>Maps</Link>
          <Link href="/admin" className="no-underline hover:underline" style={{ color: "var(--ink-secondary)" }}>Admin</Link>
        </nav>
      </div>
    </header>
  );
}
