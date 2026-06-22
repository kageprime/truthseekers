"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChats } from "../hooks";
import { useTheme } from "./ThemeProvider";

interface HistorySheetProps {
  open: boolean;
  onClose: () => void;
}

export default function HistorySheet({ open, onClose }: HistorySheetProps) {
  const pathname = usePathname();
  const currentId = pathname.match(/\/chat\/(.+)/)?.[1] ?? null;
  const { data: chats, loading } = useChats();
  const { resolved, toggle } = useTheme();

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  return (
    <aside className={`w-72 shrink-0 border-r border-border bg-surface flex flex-col transition-all duration-300 overflow-hidden ${open ? "opacity-100" : "w-0 opacity-0"}`}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">
            History
          </span>
          <div className="flex items-center gap-1">
            <Link
              href="/chat/new"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:underline"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </Link>
            <button onClick={toggle} className="btn-ghost p-1" aria-label="Toggle theme">
              {resolved === "dark" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close history">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 rounded-full border-2 animate-spin border-border border-t-gold" />
            </div>
          ) : !chats?.length ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="mb-3 text-2xl opacity-50">💬</div>
              <p className="text-xs text-subtle">No conversations yet</p>
            </div>
          ) : (
            <div className="py-1">
              {chats.map((chat) => {
                const isActive = chat.id === currentId;
                return (
                  <Link
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-4 py-3 text-xs transition-colors no-underline ${
                      isActive
                        ? "bg-accent/10 border-l-2 border-accent"
                        : "hover:bg-accent-bg/30 border-l-2 border-transparent"
                    }`}
                    style={{ color: "var(--ink-secondary)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-subtle">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="truncate">{chat.title ?? "Untitled"}</div>
                      {chat.updatedAt && (
                        <div className="text-[10px] text-subtle mt-0.5">
                          {chat.updatedAt.split("T")[0]}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
    </aside>
  );
}
