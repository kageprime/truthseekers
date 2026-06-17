"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useChats, useCreateChat } from "../hooks";
import { IconChat, IconBook, IconMap, IconClock, IconPlus } from "./Icons";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeId?: string;
}

const NAV_ITEMS = [
  { label: "Chat", href: "/", icon: IconChat },
  { label: "Articles", href: "/articles", icon: IconBook },
  { label: "Maps", href: "/maps", icon: IconMap },
  { label: "Queue", href: "/queue", icon: IconClock },
];

export default function Sidebar({ open, onClose, activeId }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: conversations = [], loading } = useChats();
  const { mutate: createChat } = useCreateChat();

  async function handleNew() {
    const conv = await createChat();
    if (conv) {
      router.push(`/chat/${conv.id}`);
    }
    onClose();
  }

  function NavLink({ item }: { item: typeof NAV_ITEMS[number] }) {
    const IconComp = item.icon;
    const active = pathname.startsWith(item.href);
    return (
      <Link
        href={item.href}
        className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-all duration-150 hover:bg-[var(--accent-bg)]/40"
        style={{ color: active ? "var(--accent)" : "var(--muted)" }}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: "var(--accent)" }} />}
        <IconComp size={17} />
        <span>{item.label}</span>
      </Link>
    );
  }

  const sidebarContent = (
    <aside className="flex flex-col h-full w-full backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--surface) 85%, transparent)" }}>
      {/* Brand */}
      <div className="shrink-0 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 no-underline min-w-0">
          <img src="/logo-icon.png" alt="" className="w-7 h-7 shrink-0" style={{ objectFit: "contain" }} />
          <span className="font-semibold text-sm tracking-tight" style={{ color: "var(--ink)" }}>Truthseekers</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-2.5 pb-2 shrink-0 space-y-0.5">
        {NAV_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* New Chat */}
      <div className="px-2.5 pb-3 shrink-0">
        <button onClick={handleNew} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-all duration-150 hover:bg-[var(--accent-bg)]/40" style={{ color: "var(--accent)" }}>
          <IconPlus size={16} />
          New Chat
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-hidden px-2 pb-2">
        <div className="h-full overflow-y-auto space-y-0.5 pr-1">
          {loading && (
            <div className="flex items-center justify-center h-full min-h-[120px]">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
            </div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="px-3 py-10 text-center text-xs" style={{ color: "var(--subtle)" }}>
              <div className="font-medium mb-0.5">No conversations</div>
              <div>Start a new chat above</div>
            </div>
          )}
          {conversations.map((conv) => {
            const active = conv.id === activeId;
            return (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm no-underline transition-all duration-150 hover:bg-[var(--accent-bg)]/20"
                style={{ color: active ? "var(--accent)" : "var(--muted)" }}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ background: "var(--accent)" }} />}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm" style={{ color: active ? "var(--ink)" : "var(--muted)" }}>{conv.title}</div>
                  <div className="text-[11px] opacity-50">{conv.messageCount} msgs</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-t" style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}>
        <span className="text-[11px]" style={{ color: "var(--subtle)" }}>v1.0.0</span>
        <img src="/logo-text.png" alt="Truthseekers" style={{ height: 12, width: "auto", objectFit: "contain", opacity: 0.35 }} />
      </div>
    </aside>
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} aria-hidden="true" />
      )}
      <div
        className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40 shrink-0 border-r transition-all duration-200 ease-out sidebar-panel w-64`}
        style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}
      >
        {sidebarContent}
      </div>
    </>
  );
}
