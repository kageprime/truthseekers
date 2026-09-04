"use client";

import { useState, useRef, useCallback, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, useChats, useCreateChat, useModels } from "../../hooks";
import { useChatStream } from "../../hooks/useChatStream";
import type { AgentEvent } from "../../components/ProcessViewer";
import ChatMessage from "../../components/ChatMessage";
import EmptyChatState from "../../components/EmptyChatState";
import TruthConsole from "../../components/TruthConsole";
import TruthConsoleDeck from "../../components/truth-console/TruthConsoleDeck";
import { useTraceSegments } from "../../components/truth-console/useTraceSegments";
import { useChatContext } from "../ChatContext";
import { useTheme } from "../../components/ThemeProvider";
import Spinner from "../../components/Spinner";
import { IconPlus } from "../../components/Icons";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { send: streamSend, stop: streamStop } = useChatStream();

  const {
    consoleOpen, setConsoleOpen,
    sending, setSending,
    setLiveEvents,
    liveEvents,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamSteps, setStreamSteps] = useState<string[]>([]);
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { mutate: createChat } = useCreateChat();
  const { resolved: theme, toggle: toggleTheme } = useTheme();

  const seg = useTraceSegments(convId ?? id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const finalizedRef = useRef(false);
  const lastUserMsgRef = useRef<string>("");
  const { data: conversationsData, loading: chatsLoading } = useChats();
  const conversations = conversationsData || [];

  const { data: conv, loading: convLoading } = useChat(convId ?? undefined);
  const messages = useMemo(() => (conv?.messages ?? []).filter((m: any) => m.role !== "tool"), [conv?.messages]);
  const hasStreaming = sending;

  const lastAssistantIdx = [...messages].reverse().findIndex((m: any) => m.role === "assistant");
  const lastAssistantIndex = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages, streamContent, streamSteps]);

  const resizeRAF = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(resizeRAF.current);
    resizeRAF.current = requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    });
    return () => cancelAnimationFrame(resizeRAF.current);
  }, [input]);

  useEffect(() => {
    if (seg.liveSegmentId && !consoleOpen && window.innerWidth >= 768) setConsoleOpen(true);
  }, [seg.liveSegmentId, consoleOpen, setConsoleOpen]);

  const doSend = useCallback(
    async (msg: string) => {
      if (!msg.trim() || sending) return;
      setError(null);

      let cid = convId;
      if (!cid) {
        setLoading(true);
        try {
          const conv = await createChat(msg.slice(0, 60));
          if (!conv) throw new Error("No conversation returned");
          cid = conv.id;
          setConvId(cid);
          try { localStorage.setItem("truthseekers_floating_conv", cid!); } catch {}
          router.replace(`/chat/${cid}`, { scroll: false });
        } catch (err) {
          console.error("Failed to create conversation", err);
          setError("Failed to start conversation. Please try again.");
          setLoading(false);
          return;
        }
        setLoading(false);
      }

      setSending(true);
      setStreamContent("");
      setStreamSteps([]);
      setStreamBlocks([]);
      setLiveEvents([]);
      agentEventsRef.current = [];
      finalizedRef.current = false;
      lastUserMsgRef.current = msg;

      const userMsg = {
        id: `temp-${Date.now()}`,
        conversationId: cid!,
        role: "user" as const,
        content: msg,
        createdAt: new Date().toISOString(),
      };

      await queryClient.cancelQueries({ queryKey: ["chat", cid] });
      queryClient.setQueryData(["chat", cid], (prev: any) => ({
        ...(prev || { id: cid, title: "Chat", userId: "", createdAt: new Date().toISOString() }),
        messages: [...(prev?.messages || []), userMsg],
      }));

      setInput("");

      await streamSend(cid!, msg, {
        onText: (text) => {
          setStreamContent(text);
        },
        onToolEvent: (event) => {
          setStreamContent((cur) => {
            if (cur.trim()) {
              const step = cur.trim();
              requestAnimationFrame(() => setStreamSteps((s) => [...s, step]));
            }
            return "";
          });
          setLiveEvents((prev) => {
            const next = [...prev, event];
            agentEventsRef.current = next;
            return next;
          });
        },
        onDone: (event) => {
          if (finalizedRef.current) return;
          finalizedRef.current = true;
          const savedEvents = agentEventsRef.current;
          const finalBlocks = event.blocks ?? [];
          setStreamContent("");
          setStreamSteps([]);
          setStreamBlocks(finalBlocks);
          queryClient.setQueryData(["chat", cid], (prev: any) => {
            if (!prev) return prev;
            const real = prev.messages.map((m: any) =>
              m.id.startsWith("temp-") ? { ...m, id: `${Date.now()}-${Math.random()}`, conversationId: cid } : m,
            );
            return {
              ...prev,
              messages: [...real, {
                id: event.msgId ?? `msg-${Date.now()}-${Math.random()}`,
                conversationId: cid,
                role: "assistant" as const,
                content: event.content || "",
                blocks: finalBlocks,
                agentEvents: savedEvents,
                createdAt: new Date().toISOString(),
              }],
            };
          });
        },
        onError: (errMsg) => {
          setError(errMsg || "Something went wrong. Please try again.");
        },
      }, "muse-spark-1.3-contributor");

      setTimeout(() => setSending(false), 0);
    },
    [convId, sending, streamSend, queryClient, router],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend(input);
    }
  }

  function handleNewChat() {
    setConvId(null);
    setInput("");
    setStreamContent("");
    setStreamSteps([]);
    setStreamBlocks([]);
    setLiveEvents([]);
    agentEventsRef.current = [];
    setError(null);
    router.push("/chat/new");
  }

  const isNew = id === "new" && !convId;
  const showEmpty = messages.length === 0 && !sending && isNew;

  const NAV_LINKS = [
    { href: "/articles", label: "Articles", icon: "📚" },
    { href: "/maps", label: "Maps", icon: "🗺️" },
    { href: "/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="flex-1 flex min-h-0 bg-surface">
      {/* ── Mobile header bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 flex items-center justify-between px-3 h-11 bg-surface/95 backdrop-blur-md border-b border-border/30" style={{ zIndex: 40 }}>
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-accent-bg/20 transition-all"
          aria-label="Open menu"
          style={{ background: "none", border: "none" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-xs font-semibold tracking-tight" style={{ color: "var(--ink)" }}>Truthseekers</span>
        <button onClick={handleNewChat} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-accent hover:bg-accent-bg/20 transition-all" aria-label="New chat" style={{ background: "none", border: "none" }}>
          <IconPlus size={16} />
        </button>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0" style={{ zIndex: 50 }}>
          <div className="absolute inset-0 bg-black/40 animate-appear-blur" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-surface border-r border-border/30 shadow-2xl animate-slide-in-left">
            {/* Sidebar header */}
            <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-border/30">
              <div className="flex items-center gap-2">
                <img src="/logo-icon.png" alt="" height={18} style={{ height: 18, width: "auto" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Truthseekers</span>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-md text-subtle hover:text-ink hover:bg-accent-bg/20 transition-all"
                aria-label="Close menu"
                style={{ background: "none", border: "none" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <div className="shrink-0 px-3 pt-3 pb-2 space-y-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg no-underline transition-colors hover:bg-accent-bg/15"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="text-base">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg w-full text-left transition-colors hover:bg-accent-bg/15"
                style={{ color: "var(--muted)", background: "none", border: "none" }}
              >
                <span className="text-base">{theme === "dark" ? "☀️" : "🌙"}</span>
                <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
            </div>

            <div className="mx-3 border-t border-border/20" />

            {/* Sessions header */}
            <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--subtle)" }}>Sessions</span>
              <button onClick={() => { handleNewChat(); setMobileSidebarOpen(false); }} className="flex items-center justify-center w-5 h-5 rounded text-subtle hover:text-accent hover:bg-accent-bg/30 transition-all cursor-pointer" aria-label="New chat" style={{ background: "none", border: "none" }}>
                <IconPlus size={12} />
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-3">
              {chatsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner size={14} />
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-3 py-6 text-xs text-center" style={{ color: "var(--subtle)" }}>No conversations yet</div>
              ) : (
                conversations.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { router.push(`/chat/${c.id}`); setMobileSidebarOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-md transition-colors hover:bg-accent-bg/15 mb-0.5"
                    style={{
                      color: c.id === convId ? "var(--accent)" : "var(--muted)",
                      background: c.id === convId ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                    }}
                  >
                    <div className="truncate font-medium">{c.title}</div>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ── Sidebar: session list (desktop) ── */}
      <aside className="hidden md:flex flex-col shrink-0 w-60 border-r border-border/30 bg-surface-elevated/40">
        <div className="shrink-0 flex items-center justify-between px-3 h-11 border-b border-border/30">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--subtle)" }}>Sessions</span>
          <button onClick={handleNewChat} className="flex items-center justify-center w-6 h-6 rounded-md text-subtle hover:text-accent hover:bg-accent-bg/30 transition-all cursor-pointer" aria-label="New chat" style={{ background: "none", border: "none" }}>
            <IconPlus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {chatsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size={14} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-6 text-xs text-center" style={{ color: "var(--subtle)" }}>No conversations yet</div>
          ) : (
            conversations.map((c: any) => (
              <button
                key={c.id}
                onClick={() => router.push(`/chat/${c.id}`)}
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-accent-bg/15"
                style={{
                  color: c.id === convId ? "var(--accent)" : "var(--muted)",
                  background: c.id === convId ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                }}
              >
                <div className="truncate font-medium">{c.title}</div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Messages area ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 pt-12 md:pt-0">
          {loading || convLoading ? (
            <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-br-md p-3 sm:p-4 max-w-[70%]" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                  <div className="h-3 skeleton rounded w-40" />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md p-3 sm:p-4 max-w-[80%]" style={{ background: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
                  <div className="space-y-2.5">
                    <div className="h-3 skeleton rounded w-56" />
                    <div className="h-3 skeleton rounded w-44" />
                    <div className="h-3 skeleton rounded w-36" />
                    <div className="h-3 skeleton rounded w-52" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-br-md p-3 sm:p-4 max-w-[60%]" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                  <div className="h-3 skeleton rounded w-32" />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md p-3 sm:p-4 max-w-[40%]" style={{ background: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full skeleton" />
                    <div className="w-2 h-2 rounded-full skeleton" />
                    <div className="w-2 h-2 rounded-full skeleton" />
                  </div>
                </div>
              </div>
            </div>
          ) : showEmpty ? (
            <EmptyChatState onSetInput={doSend} />
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg: any, i: number) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  blocks={msg.blocks}
                  agentEvents={msg.agentEvents}
                  createdAt={msg.createdAt}
                  isLastAssistant={i === lastAssistantIndex}
                  onRegenerate={i === lastAssistantIndex && lastUserMsg ? () => doSend(lastUserMsg) : undefined}
                />
              ))}

              {error && (
                <div className="mx-3 my-4 px-4 py-3 rounded-xl border border-oxblood/30 bg-oxblood-subtle/30 text-sm text-oxblood flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button
                    onClick={() => {
                      setError(null);
                      if (lastUserMsgRef.current) doSend(lastUserMsgRef.current);
                    }}
                    className="shrink-0 text-xs font-medium underline"
                    style={{ color: "var(--oxblood)" }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {hasStreaming && (
                <div style={{ background: "color-mix(in srgb, var(--accent-bg) 6%, transparent)" }}>
                  {streamSteps.length > 0 && (
                    <div className="px-3 sm:px-6 pt-3 pb-1 space-y-1">
                      {streamSteps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-muted">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 shrink-0" />
                          <span className="line-clamp-2 font-serif-body">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <ChatMessage role="assistant" content={streamContent} blocks={streamBlocks} agentEvents={liveEvents} streaming />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer: console deck + input ── */}
        {!showEmpty && (
          <div className="shrink-0 border-t border-border/30">
            <div className="max-w-3xl mx-auto px-4">
              <div className="flex items-center justify-end py-1">
                <TruthConsoleDeck
                  variant="footer"
                  segments={seg.segments}
                  liveSegmentId={seg.liveSegmentId}
                  unreadTotal={seg.unreadCount}
                  onClick={() => setConsoleOpen((o) => !o)}
                />
              </div>
            </div>
          </div>
        )}
        {!showEmpty && (
          <div className="shrink-0 px-2 sm:px-4 pb-3 sm:pb-4 pt-0">
            <div className="max-w-3xl mx-auto">
              <div className="bezel">
                <div
                  className="bezel-inner flex items-end gap-1.5 sm:gap-2 p-1.5 sm:p-2"
                  style={{ borderRadius: "calc(2rem - 1.5px)" }}
                >
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={sending ? "Waiting..." : "Ask anything..."}
                      disabled={sending}
                      rows={1}
                      className="w-full resize-none bg-transparent border-none outline-none text-[13px] sm:text-sm min-h-[24px] sm:min-h-[28px] max-h-[120px] sm:max-h-[180px] text-ink placeholder:text-subtle/60 px-2.5 py-2"
                      aria-label="Chat message input"
                      style={{ lineHeight: "1.5" }}
                    />
                  </div>
                  {sending ? (
                    <button
                      onClick={() => streamStop(convId ?? undefined)}
                      aria-label="Stop generating"
                      className="cta-bevel shrink-0 !p-1 !gap-0"
                      style={{ background: "var(--oxblood)" }}
                    >
                      <span
                        className="cta-bevel-icon !w-7 !h-7"
                        style={{ background: "color-mix(in srgb, var(--surface) 25%, transparent)", color: "var(--surface)" }}
                        aria-hidden
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => doSend(input)}
                      disabled={!input.trim()}
                      aria-label="Send message"
                      className="cta-bevel shrink-0 !p-1 !gap-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                    >
                      <span
                        className="cta-bevel-icon !w-7 !h-7"
                        style={{ background: input.trim() ? "var(--gold)" : "color-mix(in srgb, var(--border) 60%, transparent)" }}
                        aria-hidden
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Truth Console panel ── */}
      {consoleOpen && (
        <div className="hidden md:flex shrink-0 w-[400px] flex-col bg-surface border-l border-border/30">
          <TruthConsole
            segments={seg.segments}
            activeSegmentId={seg.activeSegmentId}
            liveSegmentId={seg.liveSegmentId}
            unreadCount={seg.unreadCount}
            activeEvents={seg.activeEvents}
            onSelectSegment={seg.selectSegment}
            onJumpToLive={seg.jumpToLive}
            onClose={() => setConsoleOpen(false)}
            loading={sending && seg.activeEvents.length === 0}
          />
        </div>
      )}
    </div>
  );
}
