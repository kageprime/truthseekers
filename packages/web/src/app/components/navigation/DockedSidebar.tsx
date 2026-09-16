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

  const contestedCount = Array.isArray((contestedRes as any)?.claims)
    ? (contestedRes as any).claims.length
    : Array.isArray(contestedRes)
    ? (contestedRes as any).length
    : 42;

  const gapsCount = Array.isArray((gapsRes as any)?.gaps)
    ? (gapsRes as any).gaps.length
    : Array.isArray(gapsRes)
    ? (gapsRes as any).length
    : 18;

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
      className="w-72 shrink-0 border-r border-zinc-200 bg-white sticky top-14 h-[calc(100vh-3.5rem)] p-5 space-y-6 overflow-y-auto z-30 transition-all duration-200"
      aria-label="Knowledge Centre Navigation"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Knowledge Centre
          </div>
          <h2 className="text-base font-bold text-zinc-900">Explore & Discover</h2>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
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
          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between no-underline transition-colors ${
            isCurrent("/") && pathname === "/"
              ? "bg-zinc-900 text-white font-semibold shadow-xs"
              : "hover:bg-zinc-50 text-zinc-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            </svg>
            <span>Living Portal</span>
          </div>
          <span className={`text-[11px] font-mono ${isCurrent("/") && pathname === "/" ? "text-zinc-300" : "text-zinc-400"}`}>
            {health?.article_count ?? "1.4k"}
          </span>
        </Link>

        <Link
          href="/contested"
          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between no-underline transition-colors ${
            isCurrent("/contested")
              ? "bg-zinc-900 text-white font-semibold shadow-xs"
              : "hover:bg-zinc-50 text-zinc-800"
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
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
            {contestedCount}
          </span>
        </Link>

        <Link
          href="/gaps"
          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between no-underline transition-colors ${
            isCurrent("/gaps")
              ? "bg-zinc-900 text-white font-semibold shadow-xs"
              : "hover:bg-zinc-50 text-zinc-800"
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
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-semibold">
            {gapsCount}
          </span>
        </Link>

        <Link
          href="/maps/ancient-trade-routes"
          className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 no-underline transition-colors ${
            isCurrent("/maps")
              ? "bg-zinc-900 text-white font-semibold shadow-xs"
              : "hover:bg-zinc-50 text-zinc-800"
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
          className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 no-underline transition-colors ${
            pathname === "/article/new"
              ? "bg-zinc-900 text-white font-semibold shadow-xs"
              : "hover:bg-zinc-50 text-zinc-800"
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
      <div className="pt-4 border-t border-zinc-100 space-y-2">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Live Epistemic Search
        </div>
        <div className="space-y-1.5 text-xs text-zinc-600 font-medium">
          <Link
            href="/article/crispr-gene-drives"
            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-zinc-50 cursor-pointer no-underline text-zinc-700 hover:text-zinc-900"
          >
            <span className="truncate">CRISPR gene drives</span>
            <span className="text-emerald-600 font-mono text-[10px] shrink-0">+142%</span>
          </Link>
          <Link
            href="/article/kingdom-of-benin"
            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-zinc-50 cursor-pointer no-underline text-zinc-700 hover:text-zinc-900"
          >
            <span className="truncate">Kingdom of Benin walls</span>
            <span className="text-emerald-600 font-mono text-[10px] shrink-0">+98%</span>
          </Link>
          <Link
            href="/article/quantum-computing"
            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-zinc-50 cursor-pointer no-underline text-zinc-700 hover:text-zinc-900"
          >
            <span className="truncate">Quantum Computing</span>
            <span className="text-emerald-600 font-mono text-[10px] shrink-0">+76%</span>
          </Link>
          <Link
            href="/article/photosynthesis"
            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-zinc-50 cursor-pointer no-underline text-zinc-700 hover:text-zinc-900"
          >
            <span className="truncate">Photosynthesis Z-scheme</span>
            <span className="text-emerald-600 font-mono text-[10px] shrink-0">+54%</span>
          </Link>
        </div>
      </div>

      {/* Veritas Autonomous CMS Banner */}
      <div className="p-3 bg-[#FEFDF8] rounded-xl border border-zinc-200 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
            Veritas Engine
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <p className="text-[11px] text-zinc-600 leading-snug">
          Watchdog monitoring stale articles and validating community evidence submissions.
        </p>
        <Link
          href="/chat/new"
          className="inline-block text-[11px] font-bold text-zinc-900 hover:text-blue-600 hover:underline pt-1 no-underline"
        >
          Consult Veritas Co-Manager →
        </Link>
      </div>
    </aside>
  );
}
