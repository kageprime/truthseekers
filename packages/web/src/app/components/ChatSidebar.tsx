"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useChats } from "../hooks";
import { useTheme } from "./ThemeProvider";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="btn-ghost p-1"
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {resolved === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const pathname = usePathname();
  const { data: chats, loading } = useChats();
  const currentId = pathname.match(/\/chat\/(.+)/)?.[1] ?? null;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);

  useEffect(() => {
    if (open && !scrollLocked) {
      document.body.style.overflow = "hidden";
      setScrollLocked(true);
    } else if (!open && scrollLocked) {
      document.body.style.overflow = "";
      setScrollLocked(false);
    }
    return () => {
      if (scrollLocked) {
        document.body.style.overflow = "";
      }
    };
  }, [open, scrollLocked]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const sidebarContent = (
    <>
      <div className="shrink-0 flex items-center justify-between px-3 h-12 border-b border-border">
        <Link href="/" className="no-underline flex items-center gap-2 shrink-0 min-w-0">
          <img src="/logo-icon.png" alt="TS" className="shrink-0 h-7 w-auto object-contain" />
          <span className="masthead-wordmark text-sm leading-none text-ink truncate">Truthseekers</span>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/chat/new"
            className="inline-flex items-center gap-1 text-[10px] font-medium hover:underline text-accent"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </Link>
          {/* Theme toggle */}
          <ThemeToggle />
          {/* Collapse button — desktop only */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex btn-ghost p-1 ml-1"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed
                ? <><polyline points="9 18 15 12 9 6" /></>
                : <><polyline points="15 18 9 12 15 6" /></>
              }
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 rounded-full border-2 animate-spin border-border border-t-gold" />
          </div>
        ) : !chats?.length ? (
          <p className="text-xs text-center py-8 text-subtle">No conversations yet</p>
        ) : (
          <div className="py-1">
            {chats.map((chat) => {
              const isActive = chat.id === currentId;
              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={`flex items-center gap-2 px-3 py-2.5 text-xs transition-colors no-underline ${
                    isActive
                      ? "bg-accent/10 border-l-2 border-accent"
                      : "hover:bg-black/[0.03] border-l-2 border-transparent"
                  }`}
                  style={{ color: "var(--ink-secondary)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-subtle">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="truncate">{chat.title ?? "Untitled"}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: static sidebar (≥1024px) — collapsible */}
      <aside className={`hidden lg:flex shrink-0 border-r flex-col min-h-0 border-border bg-surface-glass/60 transition-all duration-200 ${sidebarCollapsed ? "w-0 overflow-hidden border-r-0" : "w-64"}`}>
        {!sidebarCollapsed && sidebarContent}
      </aside>
      {/* Desktop collapse/expand tab when collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="hidden lg:flex shrink-0 items-center justify-center w-5 border-r border-border bg-surface-glass/60 hover:bg-surface cursor-pointer text-subtle hover:text-ink transition-colors"
          aria-label="Expand sidebar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Mobile: overlay drawer (<1024px) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-surface border-r border-border flex flex-col min-h-0 shadow-2xl animate-fade-slide-up">
            <div className="shrink-0 flex items-center justify-between px-3 h-12 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle">History</span>
              <button
                onClick={onClose}
                className="btn-ghost p-1.5"
                aria-label="Close sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 rounded-full border-2 animate-spin border-border border-t-gold" />
                </div>
              ) : !chats?.length ? (
                <p className="text-xs text-center py-8 text-subtle">No conversations yet</p>
              ) : (
                <div className="py-1">
                  {chats.map((chat) => {
                    const isActive = chat.id === currentId;
                    return (
                      <Link
                        key={chat.id}
                        href={`/chat/${chat.id}`}
                        onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-2.5 text-xs transition-colors no-underline ${
                          isActive
                            ? "bg-accent/10 border-l-2 border-accent"
                            : "hover:bg-black/[0.03] border-l-2 border-transparent"
                        }`}
                        style={{ color: "var(--ink-secondary)" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-subtle">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="truncate">{chat.title ?? "Untitled"}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}