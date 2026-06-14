"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createChat, fetchChats } from "@/lib/api";
import type { ConversationSummary } from "@/lib/api";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeId?: string;
}

export default function Sidebar({ open, onClose, activeId }: SidebarProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchChats().then((data) => { setConversations(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleNew() {
    const conv = await createChat();
    if (conv) router.push(`/chat/${conv.id}`);
    onClose();
  }

  const sidebar = (
    <aside className="flex flex-col h-full w-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button onClick={handleNew} className="btn-primary btn-sm w-full">+ New Chat</button>
      </div>
      <div className="flex-1 overflow-hidden px-1.5 pb-2 space-y-0.5">
        {loading && (
          <div className="space-y-2 pt-2">
            {[1,2,3,4].map((i) => (
              <div key={i} className="px-2.5 py-2 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded animate-pulse" style={{ background: "#e5e5e5" }} />
                <div className="h-2.5 w-1/3 rounded animate-pulse" style={{ background: "#e5e5e5" }} />
              </div>
            ))}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div className="px-2.5 py-6 text-center text-xs" style={{ color: "#9aa0a6" }}>
            No conversations yet
          </div>
        )}
        {conversations.map((conv) => (
          <Link
            key={conv.id}
            href={`/chat/${conv.id}`}
            className={`block px-2.5 py-2 text-sm rounded-lg transition-colors ${conv.id === activeId ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]"}`}
            style={{ textDecoration: "none", color: conv.id === activeId ? "var(--ink)" : "#5f6368" }}
          >
            <span className="block truncate font-medium text-sm">{conv.title}</span>
            <span className="text-[11px]" style={{ color: "#9aa0a6" }}>{conv.messageCount} messages</span>
          </Link>
        ))}
      </div>
    </aside>
  );

  if (!open) return null;

  return (
    <div className="flex w-56 shrink-0 border-r" style={{ borderColor: "#e5e5e5", background: "white" }}>
      {sidebar}
    </div>
  );
}
