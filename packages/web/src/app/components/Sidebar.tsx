"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createChat, fetchChats } from "@/lib/api";
import type { ConversationSummary } from "@/lib/api";
import { IconChat, IconBook, IconMap, IconClock, IconX, IconPlus, IconChevronRight } from "./Icons";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeId?: string;
}

const NAV_ITEMS = [
  { label: "Chat", href: "/chat", icon: IconChat },
  { label: "Articles", href: "/articles", icon: IconBook },
  { label: "Maps", href: "/maps", icon: IconMap },
  { label: "Queue", href: "/queue", icon: IconClock },
];

export default function Sidebar({ open, onClose, activeId }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchChats().then((data) => { setConversations(data); setLoading(false); }).catch(() => setLoading(false));
  }, [pathname]);

  async function handleNew() {
    const conv = await createChat();
    if (conv) router.push(`/chat/${conv.id}`);
    onClose();
  }

  const sidebarContent = (
    <aside className="flex flex-col h-full w-full" style={{ background: "var(--surface)" }}>
      {/* Brand header */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border-light)" }}>
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm" style={{ background: "var(--accent)", color: "white" }}>
            TS
          </div>
          <span className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
            Truthseekers
          </span>
        </Link>
        <button
          onClick={onClose}
          className="btn-icon btn-ghost text-sm lg:hidden"
          aria-label="Close sidebar"
        >
          <IconX size={16} />
        </button>
      </div>

      {/* Navigation links */}
      <div className="px-3 pt-3 pb-2 shrink-0 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const IconComp = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-all"
              style={{
                background: active ? "var(--accent-bg)" : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
            >
              <IconComp size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t" style={{ borderColor: "var(--border-light)" }} />

      {/* New Chat button */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <button onClick={handleNew} className="btn btn-primary w-full text-sm">
          <IconPlus size={16} />
          New Chat
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-hidden px-2 pb-2">
        <div className="h-full overflow-y-auto space-y-0.5 pr-1">
          {loading && (
            <div className="space-y-2 pt-2">
              {[1,2,3,4].map((i) => (
                <div key={i} className="px-3 py-2.5 space-y-1.5">
                  <div className="h-3 w-3/4 skeleton" />
                  <div className="h-2 w-1/3 skeleton" />
                </div>
              ))}
            </div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="px-3 py-10 text-center text-sm" style={{ color: "var(--subtle)" }}>
              <div className="font-medium mb-1">No conversations</div>
              <div className="text-xs">Start a new chat above</div>
            </div>
          )}
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm no-underline transition-all group"
              style={{
                background: conv.id === activeId ? "var(--accent-bg)" : "transparent",
                color: conv.id === activeId ? "var(--accent)" : "var(--muted)",
              }}
            >
              <IconChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: conv.id === activeId ? "var(--accent)" : "var(--border)" }} />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-sm" style={{ color: conv.id === activeId ? "var(--ink)" : "var(--muted)" }}>
                  {conv.title}
                </div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>
                  {conv.messageCount} messages
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-4 py-2 flex items-center justify-between" style={{ borderColor: "var(--border-light)" }}>
        <span className="text-xs" style={{ color: "var(--subtle)" }}>v1.0.0</span>
        <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>◆ Truthseekers</span>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      {/* Sidebar: overlay on mobile, push-layout on desktop */}
      <div
        className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40 w-72 shrink-0 border-r transition-transform duration-200 ease-out`}
        style={{ borderColor: "var(--border-light)" }}
      >
        {sidebarContent}
      </div>
    </>
  );
}
