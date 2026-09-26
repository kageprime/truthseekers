"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TruthseekersLogo from "../TruthseekersLogo";
import { useUiMode } from "../../context/UiModeContext";
import { useAuth } from "../../hooks/useAuth";

export default function TopNavigationBar() {
  const pathname = usePathname();
  const { widthMode, setWidthMode, alignMode, setAlignMode, toggleSidebar, sidebarOpen, hoverSidebarIn, hoverSidebarOut, typeScale, setTypeScale } = useUiMode();
  const { user } = useAuth();

  const isTabActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-surface/90 backdrop-blur-md border-b border-rule px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Sidebar / Menu Drawer Toggle — hover floats the drawer in */}
        <button
          onClick={toggleSidebar}
          onMouseEnter={hoverSidebarIn}
          onMouseLeave={hoverSidebarOut}
          onFocus={hoverSidebarIn}
          className={`p-1.5 rounded-md text-muted hover:bg-ink/5 transition-colors cursor-pointer ${
            sidebarOpen ? "bg-ink/5 text-ink" : ""
          }`}
          title="Browse navigation"
          aria-label="Browse navigation"
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-drawer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>

        {/* Brand mark — mobile only (sidebar owns lg+), hidden on home */}
        {pathname !== "/" && (
        <div className="flex items-center gap-2.5 min-w-0 lg:hidden">
          <Link href="/" className="flex items-center gap-2 no-underline group shrink-0">
            <TruthseekersLogo variant="icon" size={24} />
          </Link>
        </div>
        )}
      </div>

      {/* Main View Tabs — one entry per encyclopedia surface */}
      <nav className="hidden md:flex items-center gap-5 text-[13px] font-medium" aria-label="Main Views">
        {[
          { href: "/", label: "Portal", active: pathname === "/" },
          { href: "/articles", label: "Articles", active: pathname.startsWith("/article") || pathname.startsWith("/articles") },
          { href: "/finder", label: "Finder", active: pathname.startsWith("/finder") },
          { href: "/claim-graph", label: "Claim Map", active: isTabActive("/claim-graph") },
          { href: "/contested", label: "Contested", active: isTabActive("/contested") },
          { href: "/gaps", label: "Open Gaps", active: isTabActive("/gaps") },
          { href: "/stale", label: "Stale", active: isTabActive("/stale") },
          { href: "/maps", label: "Maps", active: isTabActive("/maps") },
          { href: "/chat/new", label: "Veritas Studio", active: isTabActive("/chat") },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`category-link no-underline transition-colors ${
              t.active ? "category-link-active font-semibold" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Controls: 2-Mode Layout Toggle + User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* 2-MODE WIDTH TOGGLE + TYPE SCALE */}
        <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-wider" role="group" aria-label="Layout width mode">
          <button
            type="button"
            onClick={() => setWidthMode("focus")}
            className={`cursor-pointer transition-colors tracking-wider ${
              widthMode === "focus"
                ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                : "text-subtle hover:text-ink"
            }`}
            title="Focus Reading Column"
            aria-pressed={widthMode === "focus"}
          >
            Focus
          </button>
          <span className="text-rule">/</span>
          <button
            type="button"
            onClick={() => setWidthMode("expanded")}
            className={`cursor-pointer transition-colors tracking-wider ${
              widthMode === "expanded"
                ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                : "text-subtle hover:text-ink"
            }`}
            title="Breathable Expanded Layout"
            aria-pressed={widthMode === "expanded"}
          >
            Expanded
          </button>
        </div>
        <span className="text-rule text-xs" aria-hidden>|</span>
        {/* COLUMN ALIGNMENT — left hangs content off the gutter, center floats it */}
        <div className="hidden sm:flex items-center gap-3 text-xs font-mono uppercase tracking-wider" role="group" aria-label="Reading column alignment">
          <button
            type="button"
            onClick={() => setAlignMode("left")}
            className={`cursor-pointer transition-colors tracking-wider ${
              alignMode === "left"
                ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                : "text-subtle hover:text-ink"
            }`}
            title="Left-aligned column — anchored to the contents index"
            aria-pressed={alignMode === "left"}
          >
            Left
          </button>
          <span className="text-rule">/</span>
          <button
            type="button"
            onClick={() => setAlignMode("center")}
            className={`cursor-pointer transition-colors tracking-wider ${
              alignMode === "center"
                ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                : "text-subtle hover:text-ink"
            }`}
            title="Centered column — floats in the viewport"
            aria-pressed={alignMode === "center"}
          >
            Center
          </button>
        </div>
        <span className="text-rule text-xs" aria-hidden>|</span>
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono" role="group" aria-label="Adjustable type size">
          {(["s", "m", "l"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTypeScale(s)}
              aria-pressed={typeScale === s}
              title={s === "s" ? "Compact type" : s === "m" ? "Standard type" : "Large type"}
              className={`cursor-pointer px-1 uppercase transition-colors ${
                typeScale === s
                  ? "text-ink font-bold underline decoration-gold decoration-2 underline-offset-4"
                  : "text-subtle hover:text-ink"
              }`}
              style={{ fontSize: s === "s" ? "0.65rem" : s === "m" ? "0.75rem" : "0.85rem" }}
            >
              {s === "s" ? "A" : s === "m" ? "A+" : "A++"}
            </button>
          ))}
        </div>

        {/* User Orb / Profile */}
        {user ? (
          <Link
            href="/settings"
            className="w-8 h-8 rounded-full bg-ink text-surface font-bold flex items-center justify-center text-xs no-underline hover:bg-gold hover:text-ink transition-colors"
            title={user.name || user.email || "Account"}
          >
            {(user.name || user.email || "U").slice(0, 2).toUpperCase()}
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-xs font-semibold px-3 py-1.5 rounded-sharp bg-ink text-surface hover:bg-gold hover:text-ink transition-colors no-underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
