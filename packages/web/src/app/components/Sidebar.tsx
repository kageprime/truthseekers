"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createChat, fetchChats } from "@/lib/api";
import type { ConversationSummary } from "@/lib/api";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeId?: string;
}

const NAV_ITEMS = [
  { label: "Queue", href: "/queue", icon: "⏳" },
  { label: "Maps", href: "/maps", icon: "🗺️" },
  { label: "Articles", href: "/articles", icon: "📖" },
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

  const sidebar = (
    <aside
      className="flex flex-col h-full w-full"
      style={{
        background: "var(--warm)",
        backgroundImage: "radial-gradient(#f5d0a9 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Brand header */}
      <div className="shrink-0 border-b-2 border-black px-4 py-3 flex items-center justify-between" style={{ background: "white" }}>
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div
            className="flex items-center justify-center font-bold text-white w-8 h-8 text-[8px] border-2 border-black rounded-lg shadow-[2px_2px_0_#1a1a1a]"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            <span style={{ color: "#ea580c" }}>T</span>
            <span style={{ color: "#0c4a6e" }}>S</span>
          </div>
          <span className="pixel text-xs" style={{ color: "var(--ink)" }}>
            Truthseekers
          </span>
        </Link>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center border-2 border-black shadow-[2px_2px_0_#1c1917] bg-white text-xs transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#1c1917] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#1c1917]"
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Navigation links */}
      <div className="px-3 pt-3 pb-2 shrink-0 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2.5 no-underline transition-all border-2 ${
              pathname.startsWith(item.href)
                ? "border-black shadow-[2px_2px_0_#1c1917]"
                : "border-transparent hover:border-black hover:shadow-[2px_2px_0_#1c1917] hover:translate-x-[-1px] hover:translate-y-[-1px]"
            }`}
            style={{
              background: pathname.startsWith(item.href) ? "white" : "transparent",
              color: pathname.startsWith(item.href) ? "var(--ink)" : "var(--muted)",
            }}
          >
            <span style={{ fontSize: "14px", lineHeight: 1 }}>{item.icon}</span>
            <span className="pixel text-[9px]" style={{ textTransform: "uppercase" }}>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t-2 border-dashed" style={{ borderColor: "#d4d0c8" }} />

      {/* New Chat button */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <button onClick={handleNew} className="btn-primary btn-sm w-full">
          + New Chat
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-hidden px-2 pb-2">
        <div className="h-full overflow-y-auto space-y-1 pr-1">
          {loading && (
            <div className="space-y-2 pt-2">
              {[1,2,3,4].map((i) => (
                <div key={i} className="px-3 py-3 space-y-1.5 border-2 border-black" style={{ background: "white" }}>
                  <div className="h-3 w-3/4 animate-pulse rounded" style={{ background: "#e5e5e5" }} />
                  <div className="h-2 w-1/3 animate-pulse rounded" style={{ background: "#e5e5e5" }} />
                </div>
              ))}
            </div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="px-3 py-10 text-center">
              <div className="pixel text-[9px]" style={{ color: "var(--subtle)" }}>No conversations</div>
              <div className="pixel text-[8px] mt-1" style={{ color: "#d4d0c8" }}>Start a new chat above</div>
            </div>
          )}
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              className={`block px-3 py-2.5 no-underline transition-all border-2 ${
                conv.id === activeId
                  ? "border-black shadow-[2px_2px_0_#1c1917]"
                  : "border-transparent hover:border-black hover:shadow-[2px_2px_0_#1c1917] hover:translate-x-[-1px] hover:translate-y-[-1px]"
              }`}
              style={{
                background: conv.id === activeId ? "white" : "transparent",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--orange)" }}>▸</span>
                <div className="flex-1 min-w-0">
                  <span
                    className="block truncate font-medium text-sm"
                    style={{ color: conv.id === activeId ? "var(--ink)" : "var(--muted)" }}
                  >
                    {conv.title}
                  </span>
                  <span className="pixel text-[8px]" style={{ color: "var(--subtle)" }}>
                    {conv.messageCount} messages
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t-2 border-black px-4 py-2" style={{ background: "white" }}>
        <div className="flex items-center justify-between">
          <span className="pixel text-[7px]" style={{ color: "var(--subtle)" }}>v1.0.0</span>
          <span className="pixel text-[7px]" style={{ color: "var(--orange)" }}>◆ encarta</span>
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className="flex w-60 shrink-0 border-r-2 border-black relative z-10 transition-all duration-200 ease-out"
      style={{
        transform: open ? "translateX(0)" : "translateX(-100%)",
        marginLeft: open ? "0" : "-15rem",
      }}
    >
      {sidebar}
    </div>
  );
}
