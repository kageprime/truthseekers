"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useChats, useArticles, useMaps } from "../hooks";
import { IconChat, IconBook, IconMap, IconSearch, IconX } from "./Icons";

// ─── SVG Icons ────────────────────────────────────────────────────

function ChatIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ArticleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function MapIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function SettingsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ─── Magnetic button ─────────────────────────────────────────────

function MagneticButton({ children, onClick, ariaLabel, className }: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const ref = useRef<HTMLButtonElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setX((e.clientX - rect.left - rect.width / 2) * 0.25);
    setY((e.clientY - rect.top - rect.height / 2) * 0.25);
  }, []);

  const handleMouseLeave = useCallback(() => { setX(0); setY(0); }, []);

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 150, damping: 12, mass: 0.5 }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.95 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.button>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────

function SkeletonBar({ w }: { w: string }) {
  return (
    <div className="rounded-md overflow-hidden relative" style={{ width: w, height: "0.75rem", background: "var(--border-light)" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "shimmer-sweep 1.5s ease-in-out infinite" }} />
    </div>
  );
}

// ─── Contextual content (was Sidebar) ────────────────────────────

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ContextPanel({ pathname, close }: { pathname: string; close: () => void }) {
  const currentId = pathname.match(/\/chat\/(.+)/)?.[1] ?? null;

  return (
    <div className="p-4 space-y-4">
      {/* Nav links row */}
      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs no-underline transition-all ${
                isActive ? "bg-accent-bg font-medium" : "hover:bg-accent-bg/30"
              }`}
              style={{ color: isActive ? "var(--ink)" : "var(--muted)" }}
            >
              <Icon size={13} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Contextual content per page */}
      {pathname.startsWith("/chat") && <ChatContext currentId={currentId} close={close} />}
      {pathname.startsWith("/article") && <ArticleContext />}
      {pathname.startsWith("/articles") && <ArticleContext />}
      {pathname.startsWith("/map") && <MapContext />}
      {pathname.startsWith("/maps") && <MapContext />}
    </div>
  );
}

function ChatContext({ currentId, close }: { currentId: string | null; close: () => void }) {
  const { data: chats, loading } = useChats();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const filtered = chats?.filter((c: any) => !search || c.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--subtle)" }}>Sessions</span>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border flex-1 max-w-[200px]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <IconSearch size={9} style={{ color: "var(--subtle)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent border-none outline-none text-[10px]" style={{ color: "var(--ink)" }} aria-label="Search" />
          {search && <button onClick={() => setSearch("")} className="cursor-pointer p-0.5" style={{ color: "var(--subtle)" }}><IconX size={7} /></button>}
        </div>
      </div>
      <div className="overflow-y-auto max-h-[280px]" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <SkeletonBar key={i} w="80%" />)}</div>
        ) : !filtered?.length ? (
          <p className="text-xs italic" style={{ color: "var(--muted)" }}>{search ? "No matches" : "No conversations yet"}</p>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((c: any) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                onClick={close}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs no-underline transition-colors hover:bg-accent-bg/20"
                style={{ background: c.id === currentId ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "transparent", color: "var(--ink-secondary)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0" style={{ color: c.id === currentId ? "var(--accent)" : "var(--subtle)" }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="truncate" style={{ fontWeight: c.id === currentId ? 500 : 400 }}>{c.title ?? "Untitled"}</div>
                  <div className="text-[9px]" style={{ color: "var(--subtle)" }}>{relativeDate(c.updatedAt ?? c.createdAt ?? "")}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Link href="/chat/new" onClick={close} className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs no-underline mt-1" style={{ color: "var(--accent)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New conversation
        </Link>
      </div>
    </div>
  );
}

function ArticleContext() {
  const { data: articlesData, loading } = useArticles(0, 10);
  const articles = (articlesData as any)?.data ?? [];

  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2 block" style={{ color: "var(--subtle)" }}>Recent articles</span>
      <div className="overflow-y-auto max-h-[280px]" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <SkeletonBar key={i} w="70%" />)}</div>
        ) : !articles.length ? (
          <p className="text-xs italic" style={{ color: "var(--muted)" }}>No articles yet</p>
        ) : (
          <div className="space-y-0.5">
            {articles.map((a: any) => (
              <Link key={a.slug} href={`/article/${a.slug}`} className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs no-underline transition-colors hover:bg-accent-bg/20" style={{ color: "var(--ink-secondary)" }}>
                <IconBook size={12} style={{ color: "var(--subtle)", flexShrink: 0 }} />
                <span className="truncate">{a.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MapContext() {
  const { data: mapsData, loading } = useMaps(10, 0);
  const maps = mapsData?.maps ?? [];

  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2 block" style={{ color: "var(--subtle)" }}>Recent maps</span>
      <div className="overflow-y-auto max-h-[280px]" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <SkeletonBar key={i} w="60%" />)}</div>
        ) : !maps.length ? (
          <p className="text-xs italic" style={{ color: "var(--muted)" }}>No maps yet</p>
        ) : (
          <div className="space-y-0.5">
            {maps.map((m: any) => (
              <Link key={m.slug} href={`/maps/${m.slug}`} className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs no-underline transition-colors hover:bg-accent-bg/20" style={{ color: "var(--ink-secondary)" }}>
                <IconMap size={12} style={{ color: "var(--subtle)", flexShrink: 0 }} />
                <span className="truncate">{m.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dock link with scale hover ──────────────────────────────────

function DockLink({ href, isActive, icon: Icon, label }: {
  href: string;
  isActive: boolean;
  icon: React.ComponentType<{ size: number }>;
  label: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.35 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
    >
      <Link
        href={href}
        className="flex items-center justify-center no-underline"
        style={{
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "0.75rem",
          color: isActive ? "var(--surface)" : "var(--muted)",
          background: isActive ? "var(--accent)" : "transparent",
        }}
        title={label}
      >
        <Icon size={16} />
      </Link>
    </motion.div>
  );
}

// ─── Dock inner ──────────────────────────────────────────────────

function DockInner({ pathname, horizontal }: {
  pathname: string;
  horizontal?: boolean;
}) {
  const { resolved, toggle } = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  // Click outside to close
  useEffect(() => {
    if (!panelOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [panelOpen, closePanel]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") closePanel(); }
    if (panelOpen) { window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }
  }, [panelOpen, closePanel]);

  const dockShell = (
    <div className="flex items-center gap-0.5 px-2 py-1.5" style={{
      borderRadius: "calc(1.25rem - 3px)",
      background: "var(--surface-glass)",
      backdropFilter: "blur(24px) saturate(1.4)",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.06)",
    }}>
      {/* Logo — opens panel */}
      <button onClick={() => setPanelOpen((v) => !v)} className="p-1.5 rounded-full hover:bg-accent-bg/50 transition-all duration-200 cursor-pointer" aria-label="Toggle panel">
        <img src="/logo-icon.png" alt="Truthseekers" height={24} style={{ height: 24, width: "auto", objectFit: "contain" }} />
      </button>

      <div className="w-px h-5 mx-0.5 shrink-0" style={{ background: "var(--glass-border)" }} />

      {/* Nav links */}
      <div className={`flex ${horizontal ? "flex-row" : "flex-col"} items-center gap-0.5`}>
        {NAV_LINKS.map((link) => (
          <DockLink key={link.href} href={link.href} isActive={pathname.startsWith(link.href)} icon={link.icon} label={link.label} />
        ))}
      </div>

      <div className="w-px h-5 mx-0.5 shrink-0" style={{ background: "var(--glass-border)" }} />

      {/* Controls */}
      <div className={`flex ${horizontal ? "flex-row" : "flex-col"} items-center gap-0.5`}>
        <button onClick={toggle} className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-accent-bg/30 transition-all duration-200 cursor-pointer" aria-label="Toggle theme">
          {resolved === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        </button>

        {/* Hamburger — opens contextual panel */}
        <button onClick={() => setPanelOpen((v) => !v)} className="relative w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-accent-bg/30 transition-all duration-200 cursor-pointer" aria-label={panelOpen ? "Close panel" : "Open panel"}>
          <div className="relative w-3.5 h-3 flex items-center justify-center" style={{ pointerEvents: "none" }}>
            <div className="relative w-3.5 h-3">
              <span className="absolute left-0 w-full h-px rounded-full bg-current block transition-all duration-300" style={{ top: panelOpen ? "calc(50% - 0.5px)" : "0", transform: panelOpen ? "rotate(45deg)" : "none" }} />
              <span className="absolute left-0 top-1/2 w-full h-px rounded-full bg-current block transition-all duration-200" style={{ marginTop: "-0.5px", opacity: panelOpen ? "0" : "1" }} />
              <span className="absolute left-0 w-full h-px rounded-full bg-current block transition-all duration-300" style={{ bottom: panelOpen ? "calc(50% - 0.5px)" : "0", top: panelOpen ? "auto" : "auto", transform: panelOpen ? "rotate(-45deg)" : "none" }} />
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div ref={panelRef} className="relative">
      {/* Outer shell */}
      <div className="p-[3px]" style={{ borderRadius: "1.25rem", background: "color-mix(in srgb, var(--border) 20%, transparent)" }}>
        {dockShell}
      </div>

      {/* Dropdown panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className={horizontal ? "absolute top-full left-1/2 -translate-x-1/2 mt-2" : "absolute right-0 top-full mt-2"}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            style={{ minWidth: "320px", maxWidth: "480px", zIndex: 50 }}
          >
            <div className="p-[3px]" style={{ borderRadius: "0.75rem", background: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
              <div style={{
                borderRadius: "calc(0.75rem - 3px)",
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-light)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.08)",
              }}>
                <ContextPanel pathname={pathname} close={closePanel} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── NAV_LINKS ─────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/chat", label: "Chat", icon: ChatIcon },
  { href: "/articles", label: "Articles", icon: ArticleIcon },
  { href: "/maps", label: "Maps", icon: MapIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

// ─── Entry point ──────────────────────────────────────────────────

export default function FloatIslandNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile: bottom nav bar */}
      <div className="pointer-events-none md:hidden flex justify-center" style={{ position: "fixed", bottom: "0.75rem", left: "0.75rem", right: "0.75rem", zIndex: "var(--z-island-nav)" }}>
        <div className="pointer-events-auto" style={{ width: "100%" }}>
          <DockInner pathname={pathname} horizontal />
        </div>
      </div>

      {/* Desktop: top-center pill */}
      <div className="pointer-events-none hidden md:flex justify-center" style={{ position: "fixed", top: "0.75rem", left: "50%", transform: "translateX(-50%)", zIndex: "var(--z-island-nav)" }}>
        <div className="pointer-events-auto">
          <DockInner pathname={pathname} horizontal />
        </div>
      </div>
    </>
  );
}
