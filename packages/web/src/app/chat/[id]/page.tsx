"use client";

import { useState, useRef, useCallback, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, useChats } from "../../hooks";
import { useChatStream } from "../../hooks/useChatStream";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../components/ThemeProvider";
import QueueIndicator from "../../components/QueueIndicator";
import type { AgentEvent } from "../../components/ProcessViewer";
import ChatMessage from "../../components/ChatMessage";
import EmptyChatState from "../../components/EmptyChatState";
import FollowUpSuggestions from "../../components/FollowUpSuggestions";
import { BASE } from "@/lib/constants";

const CONV_STORAGE_KEY = "truthseekers_floating_conv";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { send: streamSend, stop: streamStop } = useChatStream();
  const { data: conversations = [], loading: chatsLoading } = useChats();
  const { user } = useAuth();
  const { resolved, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const agentEventsRef = useRef<AgentEvent[]>([]);

  const { data: conv, loading: convLoading } = useChat(convId ?? undefined);
  const messages = (conv?.messages ?? []).filter((m: any) => m.role !== "tool");
  const hasStreaming = sending && (streamContent || streamBlocks.length > 0);
  const currentConv = conversations.find((c) => c.id === convId);

  const lastAssistantIdx = [...messages].reverse().findIndex((m: any) => m.role === "assistant");
  const lastAssistantIndex = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;

  const suggestedTopics = [
    "What is quantum computing?",
    "Explain the history of the Roman Empire",
    "How does CRISPR gene editing work?",
    "Show me a timeline of space exploration",
    "Compare classical vs quantum computing",
    "What caused the Industrial Revolution?",
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent]);

  const doSend = useCallback(async (msg: string) => {
    if (!msg.trim() || sending) return;

    let id = convId;
    if (!id) {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("truthseekers_token") : null;
        const res = await fetch(`${BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ title: msg.slice(0, 60) }),
        });
        const data = await res.json();
        id = data.id;
        setConvId(id);
        try { localStorage.setItem(CONV_STORAGE_KEY, id!); } catch {}
        router.replace(`/chat/${id}`, { scroll: false });
      } catch (err) {
        console.error("Failed to create conversation", err);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    const cid = id!;
    setSending(true);
    setStreamContent("");
    setStreamBlocks([]);
    setAgentEvents([]);
    agentEventsRef.current = [];

    const userMsg = {
      id: `temp-${Date.now()}`,
      conversationId: cid,
      role: "user" as const,
      content: msg,
      createdAt: new Date().toISOString(),
    };

    await queryClient.cancelQueries({ queryKey: ["chat", cid] });
    queryClient.setQueryData(["chat", cid], (prev: any) => {
      if (!prev) return prev;
      return { ...prev, messages: [...prev.messages, userMsg] };
    });

    setInput("");

    await streamSend(cid, msg, {
      onText: (text) => setStreamContent(text),
      onToolEvent: (event) => {
        setAgentEvents((prev) => {
          const next = [...prev, event];
          agentEventsRef.current = next;
          return next;
        });
        const d = event.data as Record<string, unknown> | undefined;
        if (d?.name === "render_blocks") {
          const result = d.result as Record<string, unknown> | undefined;
          const blocks = result?.blocks ?? (d.args as Record<string, unknown> | undefined)?.blocks;
          if (Array.isArray(blocks)) setStreamBlocks(blocks);
        }
      },
      onDone: (event) => {
        const savedEvents = agentEventsRef.current;
        const finalBlocks = event.blocks ?? [];
        setStreamContent("");
        setStreamBlocks(finalBlocks);
        queryClient.cancelQueries({ queryKey: ["chat", cid] });
        queryClient.setQueryData(["chat", cid], (prev: any) => {
          if (!prev) return prev;
          if (prev.messages.some((m: any) => m.role === "assistant" && !m.id.startsWith("temp-"))) return prev;
          const real = prev.messages.map((m: any) =>
            m.id.startsWith("temp-") ? { ...m, id: `${Date.now()}-${Math.random()}`, conversationId: cid } : m
          );
          return {
            ...prev,
            messages: [
              ...real,
              {
                id: event.msgId ?? `msg-${Date.now()}-${Math.random()}`,
                conversationId: cid,
                role: "assistant" as const,
                content: event.content || "",
                blocks: finalBlocks,
                agentEvents: savedEvents,
                createdAt: new Date().toISOString(),
              },
            ],
          };
        });
      },
      onError: () => {},
    });

    setTimeout(() => setSending(false), 0);
  }, [convId, sending, streamSend, queryClient, router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend(input);
    } else if (e.key === "Escape") {
      if (editingIndex !== null) setEditingIndex(null);
    }
  }

  function handleNewChat() {
    setConvId(null);
    setInput("");
    setStreamContent("");
    setStreamBlocks([]);
    setAgentEvents([]);
    setSidebarOpen(false);
    router.push("/chat/new");
  }

  function switchChat(cid: string) {
    setConvId(cid);
    setInput("");
    setStreamContent("");
    setStreamBlocks([]);
    setAgentEvents([]);
    setSidebarOpen(false);
    router.push(`/chat/${cid}`);
  }

  const followUps = lastAssistantIndex >= 0 ? ["Tell me more", "Give me sources", "Summarize this"] : [];
  const isNew = id === "new" && !convId;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const sidebar = (
    <div className="h-full flex flex-col" style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}>
      {/* Logo */}
      {/* Chat header */}
      <div className="shrink-0 flex items-center px-4 h-12 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Chats</span>
      </div>

      {/* New Chat */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-[var(--accent-bg)]/30" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Chat
        </button>
      </div>

      {/* Platform navigation */}
      <div className="shrink-0 px-3 pb-2 space-y-0.5">
        {[
          { label: "Home", href: "/", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg> },
          { label: "Articles", href: "/articles", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
          { label: "Maps", href: "/maps", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg> },
          { label: "Queue", href: "/queue", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg> },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm no-underline transition-colors hover:bg-[var(--accent-bg)]/30"
            style={{ color: "var(--ink-secondary)" }}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </div>

      <div className="mx-3 border-t" style={{ borderColor: "var(--border)" }} />

      {/* Chat sessions */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-0.5">
        {chatsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--subtle)" }}>No conversations yet</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => switchChat(c.id)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: c.id === convId ? "var(--accent-bg)" : "transparent",
                color: c.id === convId ? "var(--accent)" : "var(--ink-secondary)",
              }}
            >
              <div className="truncate font-medium">{c.title}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--subtle)" }}>{c.messageCount} messages</div>
            </button>
          ))
        )}
      </div>

      {/* Bottom: utilities */}
      <div className="shrink-0 border-t px-3 py-3 space-y-2" style={{ borderColor: "var(--border)" }}>
        {user && (
          <Link href="/settings" className="flex items-center gap-2 no-underline px-2 py-1.5 rounded-lg hover:bg-[var(--accent-bg)]/30 transition-colors">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0" style={{ background: "var(--gold)", color: "#fff" }}>
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>{user.name || user.email}</div>
              <div className="text-[9px] font-semibold uppercase" style={{ color: "var(--gold)" }}>{user.subscriptionTier}</div>
            </div>
          </Link>
        )}
        <div className="flex items-center gap-2 px-2">
          <QueueIndicator />
          <span className="text-xs" style={{ color: "var(--subtle)" }}>Queue</span>
          <div className="flex-1" />
          <button onClick={toggle} className="btn-icon btn-ghost" aria-label="Toggle theme">
            {resolved === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {!user && (
            <Link href="/login" className="text-xs font-medium" style={{ color: "var(--gold)" }}>Sign in</Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 shrink-0 flex-col min-h-0">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.2)" }} onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 h-full shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden btn-ghost text-xs p-1.5 shrink-0" aria-label="Open sidebar" style={{ color: "var(--subtle)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Link href="/" className="btn-ghost text-xs p-1.5 shrink-0 hidden md:inline-flex" aria-label="Back to home" style={{ color: "var(--subtle)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                {isNew ? "New Chat" : currentConv?.title ?? conv?.title ?? "Chat"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleNewChat} className="btn-ghost text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hidden md:flex" style={{ color: "var(--accent)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Chat
            </button>
            <button onClick={() => setConsoleOpen((o) => !o)} className="btn-ghost text-xs px-2.5 py-1.5 rounded-lg" style={{ color: consoleOpen ? "var(--accent)" : "var(--subtle)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              Console{agentEvents.length > 0 && ` (${agentEvents.length})`}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          {loading || convLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
            </div>
          ) : consoleOpen ? (
            <div className="h-full flex items-center justify-center py-16 text-center px-6">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>Agent Console</p>
                <p className="text-xs mt-1" style={{ color: "var(--subtle)" }}>
                  {agentEvents.length === 0 ? "No agent activity yet. Send a message to see tool calls in action." : `${agentEvents.length} events`}
                </p>
              </div>
            </div>
          ) : messages.length === 0 && !sending && isNew ? (
            <EmptyChatState suggestedTopics={suggestedTopics} onSetInput={doSend} />
          ) : (
            <div className="max-w-3xl max-md:max-w-full mx-auto">
              {messages.map((msg: any, i: number) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  blocks={msg.blocks}
                  createdAt={msg.createdAt}
                  isLastAssistant={i === lastAssistantIndex}
                />
              ))}
              {!sending && lastAssistantIndex >= 0 && followUps.length > 0 && (
                <FollowUpSuggestions followUps={followUps} onClick={doSend} />
              )}
              {hasStreaming && (
                <ChatMessage role="assistant" content={streamContent} blocks={streamBlocks} streaming />
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 pb-4 pt-2 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="max-w-3xl max-md:max-w-full mx-auto">
            <div className="flex items-end gap-2 rounded-2xl p-1.5" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sending ? "Waiting for response..." : "Ask about any topic..."}
                  disabled={sending}
                  rows={1}
                  className="w-full resize-none bg-transparent border-none outline-none px-3 py-2.5 text-sm"
                  style={{ minHeight: "40px", maxHeight: "200px", color: "var(--ink)" }}
                />
              </div>
              {sending ? (
                <button onClick={streamStop} aria-label="Stop generating" className="btn btn-sm shrink-0" style={{ background: "var(--red)", color: "white" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => doSend(input)}
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className="btn-icon shrink-0"
                  style={{
                    background: input.trim() ? "var(--accent)" : "var(--border)",
                    color: input.trim() ? "white" : "var(--subtle)",
                    borderRadius: "10px",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
