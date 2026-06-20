"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChats } from "../hooks";

export default function ChatSidebar() {
  const pathname = usePathname();
  const { data: chats, loading } = useChats();
  const currentId = pathname.match(/\/chat\/(.+)/)?.[1] ?? null;

  return (
    <aside className="w-64 shrink-0 border-r flex flex-col min-h-0" style={{ borderColor: "var(--border)", background: "var(--surface-glass)" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 h-12 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--subtle)" }}>History</span>
        <Link
          href="/chat/new"
          className="inline-flex items-center gap-1 text-[10px] font-medium hover:underline"
          style={{ color: "var(--accent)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New
        </Link>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : !chats?.length ? (
          <p className="text-xs text-center py-8" style={{ color: "var(--subtle)" }}>No conversations yet</p>
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
                      ? "bg-[var(--accent)]/10 border-l-2"
                      : "hover:bg-black/[0.03] border-l-2 border-transparent"
                  }`}
                  style={{
                    borderLeftColor: isActive ? "var(--accent)" : "transparent",
                    color: "var(--ink-secondary)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0" style={{ color: "var(--subtle)" }}>
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
  );
}
