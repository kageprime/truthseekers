"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiMode } from "../../context/UiModeContext";
import { useContestedClaims, useAllGaps, useHealth } from "../../hooks";

export default function DockedSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUiMode();
  const { data: health } = useHealth();
  const { data: contestedRes } = useContestedClaims(10);
  const { data: gapsRes } = useAllGaps();

  const contestedClaims = Array.isArray((contestedRes as any)?.claims)
    ? (contestedRes as any).claims
    : [];
  const contestedCount = contestedClaims.length;

  const gapsList = Array.isArray((gapsRes as any)?.gaps) ? (gapsRes as any).gaps : [];
  const gapsCount = gapsList.length;
  const trendingGaps = gapsList.slice(0, 4);

  if (!sidebarOpen) {
    return null;
  }

  const isCurrent = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <aside
      id="sidebar-drawer"
      className="w-72 shrink-0 border-r border-rule bg-surface sticky top-14 h-[calc(100vh-3.5rem)] p-5 space-y-6 overflow-y-auto z-30 transition-all duration-200"
      aria-label="Knowledge Centre Navigation"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle">
            Knowledge Centre
          </div>
          <h2 className="font-display text-xl font-bold text-ink">Explore & Discover</h2>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded-md text-subtle hover:text-ink hover:bg-ink/5 cursor-pointer"
          title="Close Sidebar"
          aria-label="Close Sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation Links */}
      <div className="space-y-1 text-xs font-medium">
        <Link
          href="/"
          className={`w-full text-left px-2 py-2.5 border-b border-border-light flex items-center justify-between no-underline transition-colors ${
            isCurrent("/") && pathname === "/"
              ? "text-ink font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            </svg>
            <span>Living Portal</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-subtle">
            {health?.article_count ?? "—"}
          </span>
        </Link>

        <Link
          href="/finder"
          className={`w-full text-left px-2 py-2.5 border-b border-border-light flex items-center gap-2.5 no-underline transition-colors ${
            isCurrent("/finder")
              ? "text-ink font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <span>Claim Finder</span>
        </Link>

        <Link
          href="/contested"
          className={`w-full text-left px-2 py-2.5 border-b border-border-light flex items-center justify-between no-underline transition-colors ${
            isCurrent("/contested")
              ? "text-ink font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10M12 3v18" />
            </svg>
            <span>Contested Claims</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-sharp bg-oxblood-subtle text-oxblood font-semibold font-mono">
            {contestedCount}
          </span>
        </Link>

        <Link
          href="/gaps"
          className={`w-full text-left px-2 py-2.5 border-b border-border-light flex items-center justify-between no-underline transition-colors ${
            isCurrent("/gaps")
              ? "text-ink font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Open Evidence Gaps</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-sharp bg-gold-bg text-accent-dark font-semibold font-mono">
            {gapsCount}
          </span>
        </Link>

        <Link
          href="/maps"
          className={`w-full text-left px-2 py-2.5 border-b border-border-light flex items-center gap-2.5 no-underline transition-colors ${
            isCurrent("/maps")
              ? "text-ink font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
          <span>Spatial Cartography</span>
        </Link>

        <Link
          href="/article/new"
          className={`w-full text-left px-2 py-2.5 flex items-center gap-2.5 no-underline transition-colors ${
            pathname === "/article/new"
              ? "text-ink font-semibold"
              : "text-muted hover:text-ink"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Create Article</span>
        </Link>
      </div>

      {/* Trending Epistemic Searches */}
      <div className="pt-4 border-t border-rule space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle">
          Open Gaps Needing Evidence
        </div>
        {trendingGaps.length > 0 ? (
          <div className="space-y-1 text-xs font-medium">
            {trendingGaps.map((g: any) => (
              <Link
                key={g.id}
                href={`/article/${g.article_slug}`}
                className="flex items-center justify-between py-1.5 border-b border-border-light cursor-pointer no-underline text-muted hover:text-ink"
              >
                <span className="truncate">{g.claim_text?.slice(0, 48) ?? g.gap_type}</span>
                <span className="text-gold font-mono text-[10px] shrink-0">{g.upvotes ?? 0}▲</span>
              </Link>
            ))}
          </div>
        ) : contestedClaims.length > 0 ? (
          <div className="space-y-1 text-xs font-medium">
            {contestedClaims.slice(0, 4).map((c: any) => (
              <Link
                key={c.id}
                href={c.article_slug ? `/article/${c.article_slug}` : "/contested"}
                className="block py-1.5 border-b border-border-light cursor-pointer no-underline text-muted hover:text-ink truncate"
              >
                {c.text?.slice(0, 60)}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-subtle leading-snug">No open gaps yet — new evidence needs will appear here.</p>
        )}
      </div>

      {/* Veritas Autonomous CMS Banner */}
      <div className="p-4 bg-surface-elevated rounded-sharp border border-rule text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted font-medium">
            Veritas Engine
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-forest animate-pulse" />
        </div>
        <p className="text-[11px] text-muted leading-snug">
          Watchdog monitoring stale articles and validating community evidence submissions.
        </p>
        <Link
          href="/chat/new"
          className="category-link inline-block text-[11px] font-semibold text-ink pt-1 no-underline"
        >
          Consult Veritas Co-Manager →
        </Link>
      </div>
    </aside>
  );
}
