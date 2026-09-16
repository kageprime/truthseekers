"use client";

import Link from "next/navigation";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { useUiMode } from "../../context/UiModeContext";
import { useAuth } from "../../hooks/useAuth";

export default function TopNavigationBar() {
  const pathname = usePathname();
  const { widthMode, setWidthMode, toggleSidebar, sidebarOpen } = useUiMode();
  const { user } = useAuth();

  // Determine dynamic breadcrumb
  let breadcrumb = "Living Portal";
  if (pathname.startsWith("/article/")) {
    const slug = pathname.replace("/article/", "");
    breadcrumb = `Article: ${slug.replace(/-/g, " ")}`;
  } else if (pathname === "/contested") {
    breadcrumb = "Contested Claims Registry";
  } else if (pathname.startsWith("/maps")) {
    breadcrumb = "Spatial Cartography";
  } else if (pathname === "/gaps") {
    breadcrumb = "Open Evidence Gaps";
  } else if (pathname.startsWith("/chat")) {
    breadcrumb = "Veritas Studio";
  } else if (pathname === "/articles") {
    breadcrumb = "Article Corpus Directory";
  }

  const isTabActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-[#FCFCF9]/90 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Sidebar / Menu Drawer Toggle */}
        <button
          onClick={toggleSidebar}
          className={`p-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer ${
            sidebarOpen ? "bg-zinc-100 text-zinc-900" : ""
          }`}
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>

        {/* Brand Logo & Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          <NextLink href="/" className="flex items-center gap-2 no-underline group shrink-0">
            <div className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center font-bold text-xs group-hover:bg-blue-600 transition-colors">
              ❖
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-900 hidden sm:inline">
              Truthseekers
            </span>
          </NextLink>
          <span className="text-zinc-300 font-light hidden sm:inline">/</span>
          <span className="text-xs font-medium text-zinc-600 truncate max-w-[140px] sm:max-w-[220px] md:max-w-xs capitalize">
            {breadcrumb}
          </span>
        </div>
      </div>

      {/* Main View Tabs */}
      <nav className="hidden md:flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl text-xs font-medium border border-zinc-200/60" aria-label="Main Views">
        <NextLink
          href="/"
          className={`px-3 py-1 rounded-lg transition-all no-underline ${
            isTabActive("/") && pathname === "/"
              ? "bg-white text-zinc-900 shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          🏛 Living Portal
        </NextLink>

        <NextLink
          href="/article/quantum-computing"
          className={`px-3 py-1 rounded-lg transition-all no-underline ${
            pathname.startsWith("/article/")
              ? "bg-white text-zinc-900 shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          📖 Article Reader
        </NextLink>

        <NextLink
          href="/contested"
          className={`px-3 py-1 rounded-lg transition-all no-underline ${
            isTabActive("/contested")
              ? "bg-white text-zinc-900 shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          ⚖ Contested Ledger
        </NextLink>

        <NextLink
          href="/maps/ancient-trade-routes"
          className={`px-3 py-1 rounded-lg transition-all no-underline ${
            isTabActive("/maps")
              ? "bg-white text-zinc-900 shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          🗺 Spatial Maps
        </NextLink>

        <NextLink
          href="/chat/new"
          className={`px-3 py-1 rounded-lg transition-all no-underline ${
            isTabActive("/chat")
              ? "bg-white text-zinc-900 shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          💬 Veritas Studio
        </NextLink>
      </nav>

      {/* Controls: 2-Mode Layout Toggle + User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* 2-MODE WIDTH TOGGLE */}
        <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs font-medium" role="group" aria-label="Layout width mode">
          <button
            type="button"
            onClick={() => setWidthMode("focus")}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-all ${
              widthMode === "focus"
                ? "bg-white text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
            title="Focus Reading Column (max-w-3xl)"
            aria-pressed={widthMode === "focus"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect width="14" height="18" x="5" y="3" rx="2" />
            </svg>
            <span className="hidden sm:inline">Focus</span>
          </button>

          <button
            type="button"
            onClick={() => setWidthMode("expanded")}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-all ${
              widthMode === "expanded"
                ? "bg-white text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
            title="Breathable Expanded Layout (max-w-5xl)"
            aria-pressed={widthMode === "expanded"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect width="20" height="18" x="2" y="3" rx="2" />
            </svg>
            <span className="hidden sm:inline">Expanded</span>
          </button>
        </div>

        {/* User Orb / Profile */}
        {user ? (
          <NextLink
            href="/settings"
            className="w-8 h-8 rounded-full bg-zinc-900 text-white font-bold flex items-center justify-center text-xs shadow-xs no-underline hover:bg-zinc-800 transition-colors"
            title={user.name || user.email || "Account"}
          >
            {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
          </NextLink>
        ) : (
          <NextLink
            href="/login"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors no-underline"
          >
            Sign in
          </NextLink>
        )}
      </div>
    </header>
  );
}
