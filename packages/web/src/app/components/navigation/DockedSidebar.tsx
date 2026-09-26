"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TruthseekersLogo from "../TruthseekersLogo";
import { useUiMode } from "../../context/UiModeContext";
import { useContestedClaims, useAllGaps, useHealth } from "../../hooks";
import { useAuth } from "../AuthProvider";
import { RETRO_ROUTES, NAV_GROUPS, canSeeAdmin, type RetroRoute } from "@/lib/routes";

// ponytail: icons keyed by registry `icon` string — one map, no drift when a
// route is added. Unknown icons fall back to the plus glyph.
function RouteIcon({ icon }: { icon: string }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
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
    case "pencil":
      return (
        <svg {...common}><path d="M17 3l4 4L8 20l-5 1 1-5L17 3Z" /></svg>
      );
    case "chat":
      return (
        <svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1.1-5.1A8.5 8.5 0 1 1 21 11.5Z" /></svg>
      );
    case "list":
      return (
        <svg {...common}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3.5" y1="6" x2="3.5" y2="6.2" /><line x1="3.5" y1="12" x2="3.5" y2="12.2" /><line x1="3.5" y1="18" x2="3.5" y2="18.2" /></svg>
      );
    case "tag":
      return (
        <svg {...common}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1" /></svg>
      );
    case "wrench":
      return (
        <svg {...common}><path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z" /></svg>
      );
    case "gear":
      return (
        <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
      );
    default:
      return (
        <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      );
  }
}

// ponytail: divider placement — "/" keeps Library together, "/article/new"
// opens Create, "/pricing" opens Account.
const GROUP_RULES: Array<{ group: (typeof NAV_GROUPS)[number]; match: (href: string) => boolean }> = [
  { group: "Encyclopedia", match: (href) => href === "/" || href.startsWith("/articles") || href === "/finder" || href === "/claim-graph" || href === "/contested" || href === "/gaps" || href === "/stale" || href === "/maps" },
  { group: "Create", match: (href) => href === "/article/new" || href.startsWith("/chat") || href === "/queue" },
  { group: "Account", match: () => true },
];

export default function DockedSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUiMode();
  const { data: health } = useHealth();
  const { data: contestedRes } = useContestedClaims(10);
  const { data: gapsRes } = useAllGaps();
  const { user } = useAuth();

  // ≥lg the rail is persistent (sidebarOpen = expanded vs icon rail);
  // <lg it is a slide-over drawer (sidebarOpen = open vs closed).
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const drawerHidden = !sidebarOpen && !isDesktop;
  const contestedClaims = Array.isArray((contestedRes as any)?.claims)
    ? (contestedRes as any).claims
    : [];
  const contestedCount = contestedClaims.length;

  const gapsList = Array.isArray((gapsRes as any)?.gaps) ? (gapsRes as any).gaps : [];
  const gapsCount = gapsList.length;
  const trendingGaps = gapsList.slice(0, 4);

  // Escape dismisses the <lg drawer only — never the persistent rail.
  // Route-change dismissal lives in UiModeProvider (also <lg only).
  useEffect(() => {
    if (!sidebarOpen || isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, isDesktop, setSidebarOpen]);

  const isCurrent = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  // ponytail: sidebar reads the same route registry as palette/breadcrumbs —
  // a page can't exist without a nav slot. Non-admins never see admin routes.
  const showAdmin = canSeeAdmin(user?.role);
  const visibleRoutes = RETRO_ROUTES.filter((r) => !r.hideInNav && (!r.adminOnly || showAdmin));

  return (
    <>
      {/* Backdrop — <lg slide-over only (lg:hidden); the persistent rail
          needs none. All layout decisions here are CSS-driven off
          sidebarOpen so SSR and first paint always agree. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-[var(--masthead-h)] bg-black/40 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id="sidebar-drawer"
        aria-hidden={drawerHidden}
        inert={drawerHidden}
        className={`fixed lg:static left-0 top-[var(--masthead-h)] bottom-0 bg-surface border-r border-rule shadow-elev-3 lg:shadow-none p-5 space-y-6 overflow-y-auto z-40 transition-all duration-200 ease-out ${
          sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
        } lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto ${
          sidebarOpen ? "w-72 lg:w-60" : "w-72 lg:w-16 lg:p-1.5 lg:space-y-3"
        }`}
        aria-label="Knowledge Centre Navigation"
      >
      <div className={`flex items-center gap-1 ${sidebarOpen ? "justify-between" : "justify-between lg:justify-center"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <TruthseekersLogo variant="icon" size={sidebarOpen ? 28 : 24} />
          {sidebarOpen && (
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle">
                Knowledge Centre
              </div>
              <h2 className="font-display text-xl font-bold text-ink leading-none">Explore</h2>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md text-subtle hover:text-ink hover:bg-ink/5 cursor-pointer shrink-0"
          title={sidebarOpen ? "Hide navigation" : "Show navigation"}
          aria-label={sidebarOpen ? "Hide navigation" : "Show navigation"}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-drawer"
        >
          {/* <lg drawer: close ✕ — ≥lg persistent rail: collapse ‹ / expand › */}
          <svg className="lg:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <svg className="hidden lg:block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen ? (
              <polyline points="14 6 8 12 14 18" />
            ) : (
              <polyline points="10 6 16 12 10 18" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation Links — registry-driven, grouped. Claim Graph, Stale Watch
          and the rest can never drift out of the nav again.
          ≥lg collapsed: icon buttons only (title tooltips); expanded rail
          (sidebarOpen) and <lg drawer: full labels. */}
      <nav aria-label="Site sections" className="space-y-4 lg:space-y-5 text-xs font-medium">
        {NAV_GROUPS.map((group) => {
          const rule = GROUP_RULES.find((g) => g.group === group)!;
          const items = visibleRoutes.filter((r: RetroRoute) => r.group === group && rule.match(r.href));
          if (items.length === 0) return null;
          return (
            <div key={group} className="space-y-1 lg:space-y-1.5">
              {/* Group labels only when expanded (drawer or wide rail) —
                  the icon rail needs no text */}
              <div className={`px-2 text-[10px] font-mono uppercase tracking-[0.18em] text-subtle ${sidebarOpen ? "" : "lg:hidden"}`}>
                {group}
              </div>
              {items.map((r: RetroRoute) => {
                const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
                const badge =
                  r.href === "/" ? (
                    <span className="text-[11px] font-mono tabular-nums text-subtle">
                      {health?.article_count ?? "—"}
                    </span>
                  ) : r.href === "/contested" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-sharp bg-oxblood-subtle text-oxblood font-semibold font-mono">
                      {contestedCount}
                    </span>
                  ) : r.href === "/gaps" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-sharp bg-gold-bg text-accent-dark font-semibold font-mono">
                      {gapsCount}
                    </span>
                  ) : null;
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    title={r.label}
                    aria-current={active ? "page" : undefined}
                    className={`no-underline transition-colors ${
                      active ? "text-ink font-semibold" : "text-muted hover:text-ink"
                    } ${
                      /* ≥lg collapsed rail: centered icon button */
                      sidebarOpen
                        ? ""
                        : "lg:flex lg:items-center lg:justify-center lg:w-10 lg:h-10 lg:rounded-sharp lg:border lg:border-transparent lg:hover:border-rule lg:hover:bg-surface-elevated"
                    } ${/* drawer / expanded rail row */ "w-full text-left px-2 py-2.5 border-b border-border-light flex items-center justify-between"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <RouteIcon icon={r.icon} />
                      {/* Label when expanded (drawer or wide rail) */}
                      <span className={sidebarOpen ? "" : "lg:hidden"}>{r.label}</span>
                    </div>
                    {/* Badges only when expanded — counts also live in the folio */}
                    <span className={`${sidebarOpen ? "" : "lg:hidden"} flex items-center`}>
                      {badge}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Discovery sections — drawer / expanded rail only; the icon rail
          is pure nav. Counts/badges also live in the folio above. */}
      <div className={`${sidebarOpen ? "" : "lg:hidden"} pt-4 border-t border-rule space-y-2`}>
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

      {/* Veritas Autonomous CMS Banner — drawer / expanded rail only */}
      <div className={`${sidebarOpen ? "" : "lg:hidden"} p-4 bg-surface-elevated rounded-sharp border border-rule text-xs space-y-1.5`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted font-medium">
            Veritas Engine
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-forest animate-pulse" />
        </div>
        <p className="text-[11px] text-muted leading-snug">
          Watchdog monitoring stale articles and validating community evidence submissions.
        </p>
      </div>
    </aside>
    </>
  );
}
