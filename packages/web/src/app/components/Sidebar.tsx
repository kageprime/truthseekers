"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useChats, useArticles, useMaps } from "../hooks";
import { fetchChat, fetchArticle, fetchMap } from "@/lib/api";
import { useSidebar } from "../SidebarContext";
import TruthseekersLogo from "./TruthseekersLogo";
import { useTheme } from "./ThemeProvider";
import { IconChat, IconBook, IconMap, IconSearch, IconX, IconTrash } from "./Icons";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
  { href: "/chat", label: "Chat", icon: (s: number) => <IconChat size={s} /> },
  { href: "/articles", label: "Articles", icon: (s: number) => <IconBook size={s} /> },
  { href: "/maps", label: "Maps", icon: (s: number) => <IconMap size={s} /> },
  { href: "/settings", label: "Settings", icon: (s: number) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg> },
];

type ContextMode = "chat" | "article" | "maps" | "default";

function getContext(pathname: string): ContextMode {
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/article") || pathname.startsWith("/articles")) return "article";
  if (pathname.startsWith("/map") || pathname.startsWith("/maps")) return "maps";
  return "default";
}

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

function groupKey(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

const contextVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: "easeIn" } },
} as const;

export default function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isOpen, close, open } = useSidebar();
  const currentId = pathname.match(/\/chat\/(.+)/)?.[1] ?? null;
  const context = getContext(pathname);
  const { resolved, toggle } = useTheme();

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    },
    [close],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleKey]);

  return (
    <>
      {/* Floating toggle button — visible when sidebar closed */}
      {!isOpen && (
        <button
          onClick={open}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface border border-border/40 hover:border-accent/50 hover:text-accent cursor-pointer transition-colors shadow-sm"
          aria-label="Open sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Sidebar panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="absolute left-0 top-0 bottom-0 z-40 flex flex-col overflow-hidden border-r border-border bg-surface shadow-lg"
          >
            <div className="flex flex-col h-full w-60">
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <TruthseekersLogo variant="icon" size={37} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">Truthseekers</span>
                </div>
                <button onClick={close} className="btn-ghost p-1 cursor-pointer" aria-label="Close sidebar">
                  <IconX size={11} />
                </button>
              </div>

              {/* Navigation links — always visible */}
              <nav className="shrink-0 px-2 pt-3 pb-1">
                <div className="px-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-subtle">Navigate</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {NAV_LINKS.map((link) => {
                    const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={close}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all no-underline ${
                          isActive
                            ? "bg-accent-bg text-ink font-medium"
                            : "text-muted hover:text-ink hover:bg-accent-bg/30"
                        }`}
                      >
                        <span className="shrink-0" style={{ color: isActive ? "var(--accent)" : "var(--subtle)" }}>
                          {link.icon(14)}
                        </span>
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </nav>

              {/* Divider */}
              <div className="shrink-0 px-3 py-1.5">
                <div className="h-px" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
              </div>

              {/* Contextual content — morphs per page */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <AnimatePresence mode="wait">
                  <ContextContent key={context} context={context} currentId={currentId} queryClient={queryClient} />
                </AnimatePresence>
              </div>

              {/* Footer — new conversation (chat mode only) */}
              {context === "chat" && (
                <div className="shrink-0 px-3 pb-3 pt-1.5 border-t border-border">
                  <Link
                    href="/chat/new"
                    onClick={close}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[10px] font-medium transition-colors border border-dashed border-border text-subtle hover:text-accent hover:border-accent/40 no-underline"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New conversation
                  </Link>
                </div>
              )}

              {/* Theme toggle */}
              <div className="shrink-0 px-3 py-2.5 border-t border-border">
                <button
                  onClick={toggle}
                  className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-[10px] font-medium text-muted hover:text-ink hover:bg-accent-bg/25 transition-colors cursor-pointer"
                  aria-label="Toggle theme"
                >
                  {resolved === "dark" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                  <span>{resolved === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function ContextContent({ context, currentId, queryClient }: { context: ContextMode; currentId: string | null; queryClient: any }) {
  switch (context) {
    case "chat":
      return <ChatContextContent currentId={currentId} queryClient={queryClient} />;
    case "article":
      return <ArticleContextContent />;
    case "maps":
      return <MapsContextContent />;
    default:
      return <DefaultContextContent />;
  }
}

function DefaultContextContent() {
  return (
    <motion.div variants={contextVariants} initial="initial" animate="animate" exit="exit" className="px-4 py-8 text-center">
      <p className="text-[11px] text-muted">Select a page from the navigation above</p>
    </motion.div>
  );
}

/* ── Chat context: session history ── */

function ChatContextContent({ currentId, queryClient }: { currentId: string | null; queryClient: any }) {
  const { data: chats, loading } = useChats();
  const [search, setSearch] = useState("");

  const filtered = chats?.filter((c: any) =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = useMemo(() => {
    if (!filtered) return [];
    const map = new Map<string, typeof filtered>();
    for (const c of filtered) {
      const key = groupKey(c.updatedAt ?? c.createdAt ?? "");
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered, search]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    queryClient.setQueryData(["chats"], (prev: any[] | undefined) =>
      (prev ?? []).filter((c: any) => c.id !== id),
    );
  }

  return (
    <motion.div variants={contextVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col h-full">
      {/* Search */}
      <div className="shrink-0 px-3 pb-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border bg-surface-elevated text-xs transition-colors focus-within:border-accent/50">
          <IconSearch size={10} style={{ color: "var(--subtle)", flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent border-none outline-none text-ink text-[10px] placeholder:text-subtle"
            aria-label="Search conversations"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-subtle hover:text-ink cursor-pointer p-0.5" aria-label="Clear search">
              <IconX size={8} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-1.5 px-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-2 animate-pulse">
                <div className="w-3.5 h-3.5 rounded skeleton shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2 w-3/4 skeleton rounded" />
                  <div className="h-1.5 w-1/4 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !filtered?.length ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
              <IconChat size={14} style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-[11px] text-muted">{search ? "No matching conversations" : "No conversations yet"}</p>
          </div>
        ) : (
          <div className="pt-1 stagger-children">
            {grouped.map(([group, items]) => (
              <div key={group} className="mb-2.5">
                <div className="flex items-center gap-2 px-2 mb-0.5">
                  <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-subtle">{group}</span>
                  <span className="flex-1 h-px" style={{ background: "color-mix(in srgb, var(--border) 30%, transparent)" }} />
                </div>
                {items.map((chat: any) => {
                  const isActive = chat.id === currentId;
                  return (
                    <div key={chat.id} className="group relative">
                      <Link
                        href={`/chat/${chat.id}`}
                        onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ["chat", chat.id], queryFn: () => fetchChat(chat.id) })}
                        className={`flex items-center gap-2 px-2.5 py-2 text-[11px] rounded-md transition-all no-underline ${
                          isActive
                            ? "bg-accent-bg border border-accent/15"
                            : "hover:bg-accent-bg/25 border border-transparent"
                        }`}
                        style={{ color: "var(--ink-secondary)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0" style={{ color: isActive ? "var(--accent)" : "var(--subtle)" }}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <div className="truncate" style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "var(--ink)" : "var(--ink-secondary)" }}>
                            {chat.title ?? "Untitled"}
                          </div>
                          <div className="text-[9px] text-subtle mt-px">
                            {relativeDate(chat.updatedAt ?? chat.createdAt ?? "")}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, chat.id)}
                          className={`shrink-0 p-0.5 transition-all rounded ${
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          } text-subtle hover:text-oxblood cursor-pointer`}
                          aria-label="Delete conversation"
                          title="Delete"
                        >
                          <IconTrash size={8} />
                        </button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Article context: recent articles ── */

function ArticleContextContent() {
  const { data: articlesData, loading } = useArticles(0, 10);
  const articles = (articlesData as any)?.data ?? [];
  const queryClient = useQueryClient();

  return (
    <motion.div variants={contextVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col h-full px-3 pb-2">
      <div className="shrink-0 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-subtle">Recent Articles</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-2 animate-pulse">
                <div className="w-3.5 h-3.5 rounded skeleton shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2 w-3/4 skeleton rounded" />
                  <div className="h-1.5 w-1/2 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !articles.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
              <IconBook size={14} style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-[11px] text-muted">No articles yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {articles.slice(0, 15).map((article: any) => (
              <Link
                key={article.slug}
                href={`/article/${article.slug}`}
                onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ["article", article.slug], queryFn: () => fetchArticle(article.slug) })}
                className="flex items-center gap-2 px-2.5 py-2 text-[11px] rounded-md transition-all no-underline hover:bg-accent-bg/25"
                style={{ color: "var(--ink-secondary)" }}
              >
                <IconBook size={12} style={{ color: "var(--subtle)", flexShrink: 0 }} />
                <span className="truncate">{article.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Maps context: recent maps ── */

function MapsContextContent() {
  const { data: mapsData, loading } = useMaps(10, 0);
  const maps = mapsData?.maps ?? [];
  const queryClient = useQueryClient();

  return (
    <motion.div variants={contextVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col h-full px-3 pb-2">
      <div className="shrink-0 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-subtle">Recent Maps</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-2 animate-pulse">
                <div className="w-3.5 h-3.5 rounded skeleton shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2 w-3/4 skeleton rounded" />
                  <div className="h-1.5 w-1/4 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !maps.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
              <IconMap size={14} style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-[11px] text-muted">No maps yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {maps.slice(0, 15).map((map: any) => (
              <Link
                key={map.slug}
                href={`/maps/${map.slug}`}
                onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ["map", map.slug], queryFn: () => fetchMap(map.slug) })}
                className="flex items-center gap-2 px-2.5 py-2 text-[11px] rounded-md transition-all no-underline hover:bg-accent-bg/25"
                style={{ color: "var(--ink-secondary)" }}
              >
                <IconMap size={12} style={{ color: "var(--subtle)", flexShrink: 0 }} />
                <span className="truncate">{map.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
