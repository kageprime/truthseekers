"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TruthseekersLogo from "../TruthseekersLogo";
import { useUiMode } from "../../context/UiModeContext";
import { useAuth } from "../../hooks/useAuth";

// ponytail: compact icon set shared by the md–lg icon tab strip —
// one map keyed by tab `icon` string, no drift when a tab is added.
function TabIcon({ icon }: { icon: string }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
  switch (icon) {
    case "home":
      return (
        <svg {...common}><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" /></svg>
      );
    case "book":
      return (
        <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>
      );
    case "search":
      return (
        <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
      );
    case "graph":
      return (
        <svg {...common}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="12" cy="18" r="2.5" /><line x1="8" y1="7" x2="15.5" y2="7.6" /><line x1="7" y1="8.2" x2="10.8" y2="16" /><line x1="17" y1="10.2" x2="13.2" y2="16" /></svg>
      );
    case "scale":
      return (
        <svg {...common}><line x1="12" y1="3" x2="12" y2="21" /><line x1="5" y1="7" x2="19" y2="7" /><path d="M5 7l-2.5 6a3.5 3.5 0 0 0 7 0L7 7" /><path d="M19 7l-2.5 6a3.5 3.5 0 0 0 7 0L21 7" /></svg>
      );
    case "question":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 5 .2c0 1.8-2.5 2.3-2.5 3.8" /><line x1="12" y1="17" x2="12" y2="17.2" /></svg>
      );
    case "clock":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
      );
    case "map":
      return (
        <svg {...common}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>
      );
    case "chat":
      return (
        <svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1.1-5.1A8.5 8.5 0 1 1 21 11.5Z" /></svg>
      );
    default:
      return (
        <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      );
  }
}

export default function TopNavigationBar() {
  const pathname = usePathname();
  const { widthMode, setWidthMode, alignMode, setAlignMode, toggleSidebar, sidebarOpen, typeScale, setTypeScale } = useUiMode();
  const { user } = useAuth();

  const isTabActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-surface/90 backdrop-blur-md border-b border-rule px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Single sidebar toggle — hamburger at <lg (opens the nav drawer),
            icon-collapse at ≥lg (checker view / reading room swap) */}
        <button
          onClick={toggleSidebar}
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

        {/* Brand mark */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 no-underline group shrink-0">
            <TruthseekersLogo variant="icon" size={24} />
            <span className="font-display font-bold text-sm tracking-tight text-ink hidden sm:inline">
              Truthseekers
            </span>
          </Link>
        </div>
      </div>

      {/* Main View Tabs — all primary encyclopedia surfaces.
          md–lg shows the icon tab strip (compact rail); ≥lg shows the full
          text tab rail. Below md only the hamburger remains. */}
      <nav className="hidden md:flex items-center gap-5 text-[13px] font-medium" aria-label="Main Views">
        {[
          { href: "/", label: "Portal", icon: "home", active: pathname === "/" },
          { href: "/articles", label: "Articles", icon: "book", active: pathname.startsWith("/article") || pathname.startsWith("/articles") },
          { href: "/finder", label: "Finder", icon: "search", active: pathname.startsWith("/finder") },
          { href: "/claim-graph", label: "Claim Map", icon: "graph", active: isTabActive("/claim-graph") },
          { href: "/contested", label: "Contested", icon: "scale", active: isTabActive("/contested") },
          { href: "/gaps", label: "Open Gaps", icon: "question", active: isTabActive("/gaps") },
          { href: "/stale", label: "Stale", icon: "clock", active: isTabActive("/stale") },
          { href: "/maps", label: "Maps", icon: "map", active: isTabActive("/maps") },
          { href: "/chat/new", label: "Research Studio", icon: "chat", active: isTabActive("/chat") },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            title={t.label}
            aria-current={t.active ? "page" : undefined}
            className={`category-link no-underline transition-colors ${
              t.active ? "category-link-active font-semibold" : "text-muted hover:text-ink"
            }`}
          >
            {/* Compact icon tab at md–lg, full text at ≥lg */}
            <span className="lg:hidden flex items-center">
              <TabIcon icon={t.icon} />
            </span>
            <span className="hidden lg:inline">{t.label}</span>
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
