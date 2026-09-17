"use client";

import { useState, useRef, useCallback, useEffect, use, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, useChats, useCreateChat } from "../../hooks";
import { useChatStream } from "../../hooks/useChatStream";
import { useTimeMachine } from "../../hooks/useTimeMachine";
import type { AgentEvent } from "../../components/ProcessViewer";
import ChatMessage from "../../components/ChatMessage";
import EmptyChatState from "../../components/EmptyChatState";
import TruthConsole from "../../components/TruthConsole";
import { canSeeAdmin } from "@/lib/routes";
import { useAuth } from "../../hooks/useAuth";
import { useTraceSegments } from "../../components/truth-console/useTraceSegments";
import { useChatContext } from "../ChatContext";
import { useTheme } from "../../components/ThemeProvider";
import Spinner from "../../components/Spinner";
import { IconPlus } from "../../components/Icons";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { send: streamSend, stop: streamStop } = useChatStream();
  const { user } = useAuth();
  const showAdmin = canSeeAdmin(user?.role);

  const {
    consoleOpen, setConsoleOpen,
    sending, setSending,
    setLiveEvents,
    liveEvents,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("");
  const { mutate: createChat } = useCreateChat();
  const { resolved: theme } = useTheme();
  const { activeEra, isActive: timeTravelActive } = useTimeMachine();

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
  }, [messages, streamContent, liveEvents]);

  // ponytail: iOS keyboard resizes visualViewport — keep pinned to bottom so composer stays visible.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

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
        } catch (e: any) {
          setError(e.message || "Failed to create conversation");
          setLoading(false);
          return;
        } finally {
          setLoading(false);
        }
      }

      setInput("");
      setStreamContent("");
      setStreamBlocks([]);
      agentEventsRef.current = [];
      setLiveEvents([]);
      finalizedRef.current = false;
      lastUserMsgRef.current = msg;
      setSending(true);

      try {
        await streamSend(cid!, msg, {
          // ponytail: useChatStream already accumulates fullText — replace, don't append (append doubles text).
          onText: (text: string) => {
            setStreamContent(text);
          },
          onToolEvent: (event: AgentEvent) => {
            agentEventsRef.current = [...agentEventsRef.current, event];
            setLiveEvents([...agentEventsRef.current]);
          },
          onDone: (event: any) => {
            if (finalizedRef.current) return;
            finalizedRef.current = true;
            if (event?.blocks) setStreamBlocks(event.blocks);
            queryClient.invalidateQueries({ queryKey: ["chat", cid] });
            queryClient.invalidateQueries({ queryKey: ["chats"] });
            setSending(false);
          },
          onError: (err: string) => {
            setError(err || "Connection lost");
            setSending(false);
          },
        }, undefined, undefined, timeTravelActive ? activeEra : undefined);
      } catch (err: any) {
        setError(err.message || "Send failed");
        setSending(false);
      }
    },
    [convId, createChat, router, sending, setSending, setLiveEvents, streamSend, queryClient, timeTravelActive, activeEra]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend(input);
    }
  };

  const handleNewChat = () => {
    setConvId(null);
    setInput("");
    setStreamContent("");
    setStreamBlocks([]);
    setError(null);
    setSending(false);
    router.push("/chat/new");
  };

  const showEmpty = !convLoading && messages.length === 0 && !hasStreaming;

  return (
    <div className="py-6 px-4 sm:px-8 w-full max-w-5xl mx-auto">
      {/* ponytail: fixed shell → this fills the viewport; messages scroll, sessions + composer stay pinned. */}
      <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 min-w-0 bg-surface-elevated rounded-sharp overflow-hidden border border-rule">
        {/* Mobile Header Bar - Native App Style */}
        <div className="md:hidden shrink-0 flex items-center justify-between px-3 h-12 bg-[var(--r-nav-bg)] border-b border-[var(--r-border)] gap-2 shadow-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--r-surface-elevated)] border border-[var(--r-border)] text-[var(--r-ink)] active:scale-95"
              aria-label="Open sessions list"
              title="Sessions"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              onClick={handleNewChat}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--r-surface-elevated)] border border-[var(--r-border)] text-[var(--r-ink)] active:scale-95"
              aria-label="New chat"
              title="New Chat"
            >
              <IconPlus size={14} />
            </button>
          </div>

          <div className="flex flex-col items-center min-w-0 flex-1 px-1">
            <span className="text-[12.5px] font-bold truncate max-w-[170px]" style={{ color: "var(--r-ink)" }}>
              {conv?.title ?? "TruthSeekers Chat"}
            </span>
            <span className="text-[9.5px] text-[var(--r-muted)] flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${sending ? "bg-gold animate-pulse" : "bg-forest"}`} />
              <span>{sending ? "Agent working…" : "Ready"}</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setConsoleOpen((o) => !o)}
              aria-label="Toggle agent trace"
              className="flex items-center gap-1 px-2 h-8 text-[11px] font-medium bg-[var(--r-surface-elevated)] border border-[var(--r-border)] text-[var(--r-ink)] rounded-lg active:scale-95"
            >
              <span>Trace</span>
              {seg.unreadCount > 0 && (
                <span className="bg-red-700 text-white text-[8px] px-1 py-0.2 rounded-full font-bold">
                  {seg.unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Sidebar Drawer — Dedicated Research Sessions List */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Research Sessions">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] flex flex-col bg-[var(--r-surface)] border-r border-[var(--r-border)] shadow-2xl overflow-hidden animate-slide-in-left">
              <div className="shrink-0 flex items-center justify-between px-4 h-12 bg-[var(--r-accent)] text-white font-bold text-xs">
                <span>Research Sessions</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center justify-center w-7 h-7 text-white/90 hover:text-white"
                  aria-label="Close sessions"
                >
                  ✕
                </button>
              </div>

              {/* New Session Action */}
              <div className="p-3 border-b border-[var(--r-border)] bg-[var(--r-nav-bg)]">
                <button
                  onClick={() => { handleNewChat(); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[var(--r-accent)] text-white font-semibold text-xs active:scale-98 shadow-sm cursor-pointer"
                >
                  <IconPlus size={14} />
                  <span>New Research Session</span>
                </button>
              </div>

              {/* Sessions List */}
              <div className="px-3 pt-2 shrink-0">
                <input
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  placeholder="Filter sessions…"
                  aria-label="Filter research sessions"
                  className="w-full bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-lg px-3 py-2 text-xs text-[var(--r-ink)] placeholder:text-[var(--r-muted)] outline-none focus:border-[var(--r-accent)]"
                />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 r-scroll">
                {chatsLoading ? (
                  <div className="flex items-center justify-center py-8"><Spinner size={18} /></div>
                ) : conversations.length === 0 ? (
                  <div className="px-3 py-8 text-xs text-center text-[var(--r-muted)]">No research sessions yet</div>
                ) : (
                  conversations
                    .filter((c: any) => !sessionFilter.trim() || (c.title ?? "").toLowerCase().includes(sessionFilter.trim().toLowerCase()))
                    .map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { router.push(`/chat/${c.id}`); setMobileSidebarOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-xs ${
                        c.id === convId
                          ? "bg-[var(--r-accent)] text-white border-[var(--r-accent)] font-semibold shadow-sm"
                          : "bg-[var(--r-surface-elevated)] border-[var(--r-border)] text-[var(--r-ink)] active:bg-black/5"
                      }`}
                    >
                      <div className="truncate font-medium">{c.title}</div>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col shrink-0 w-64 bg-[var(--r-nav-bg)] border-r border-[var(--r-border)]">
          <div className="shrink-0 flex items-center justify-between px-3 h-9 bg-[var(--r-accent)] text-white font-bold text-[11px]">
            <span>Sessions</span>
            <button
              onClick={handleNewChat}
              className="flex items-center justify-center w-5 h-5 bg-[var(--r-header-accent)] text-black rounded-sm border border-black/30 hover:brightness-110"
              aria-label="New chat"
            >
              <IconPlus size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1 r-scroll">
            {chatsLoading ? (
              <div className="flex items-center justify-center py-6"><Spinner size={14} /></div>
            ) : conversations.length === 0 ? (
              <div className="px-2 py-6 text-[11px] text-center text-[var(--r-muted)]">No conversations yet</div>
            ) : (
              conversations.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/chat/${c.id}`)}
                  className={`w-full text-left px-2.5 py-1.5 text-[12px] rounded-[var(--r-radius)] border transition-colors ${
                    c.id === convId ? "bg-[var(--r-accent)] text-white border-[var(--r-accent)] font-semibold shadow-sm" : "bg-transparent border-transparent text-[var(--r-ink)] hover:bg-black/5"
                  }`}
                >
                  <div className="truncate">{c.title}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Workarea */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--r-surface)] relative">
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 r-scroll">
            {loading || convLoading ? (
              <div className="p-4 sm:p-6 space-y-5 max-w-[960px] mx-auto">
                <div className="flex justify-end">
                  <div className="rounded-md p-4 max-w-[70%] bg-[var(--r-surface-elevated)] border border-[var(--r-border)]">
                    <div className="h-3 skeleton rounded w-40" />
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="rounded-md p-4 max-w-[80%] bg-[var(--r-surface-elevated)] border border-[var(--r-border)] space-y-2">
                    <div className="h-3 skeleton rounded w-56" />
                    <div className="h-3 skeleton rounded w-44" />
                  </div>
                </div>
              </div>
            ) : showEmpty ? (
              <EmptyChatState onSetInput={doSend} />
            ) : (
              <div className="max-w-[960px] mx-auto w-full py-2">
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
                  <div className="mx-4 my-4 p-3 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button
                      onClick={() => {
                        setError(null);
                        if (lastUserMsgRef.current) doSend(lastUserMsgRef.current);
                      }}
                      className="text-xs font-bold underline cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {hasStreaming && (
                  <div className="border-t border-[var(--r-border)] bg-[var(--r-surface-elevated)]/60">
                    <ChatMessage role="assistant" content={streamContent} blocks={streamBlocks} agentEvents={liveEvents} streaming />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer & Composer — ponytail: always pinned outside scroll, empty state is display-only. */}
          <div className="shrink-0 sticky bottom-0 bg-[var(--r-nav-bg)]/95 backdrop-blur-md border-t border-[var(--r-border)] p-2 sm:p-3" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
            <div className="max-w-[960px] mx-auto space-y-1.5">
              {error && (
                <div className="p-2.5 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button
                    onClick={() => {
                      setError(null);
                      if (lastUserMsgRef.current) doSend(lastUserMsgRef.current);
                    }}
                    className="text-xs font-bold underline cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}
                <div className="hidden sm:flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--r-muted)] px-1">
                  <span>{sending ? "Agent working…" : conv?.title ?? "Conversation"}</span>
                  <button
                    onClick={() => setConsoleOpen((o) => !o)}
                    aria-pressed={consoleOpen}
                    aria-label="Toggle agent trace panel"
                    className="r-btn inline-flex items-center gap-1.5 px-2 py-0.5"
                  >
                    <span>Trace</span>
                    {seg.unreadCount > 0 && !consoleOpen && (
                      <span className="bg-red-700 text-white text-[9px] px-1 font-bold rounded-sm">
                        {seg.unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Sleek Mobile-Friendly Composer Input Container */}
                <div className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-2xl p-1.5 sm:p-2 flex items-end gap-1.5 sm:gap-2 shadow-sm">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={sending ? "Agent is researching & writing..." : "Ask a research question or request an article..."}
                    disabled={sending}
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none text-[15px] sm:text-[13.5px] min-h-[36px] max-h-[160px] text-[var(--r-ink)] placeholder:text-[var(--r-muted)] px-3 py-1.5 resize-none"
                    aria-label="Chat message input"
                    style={{ lineHeight: "1.5" }}
                  />
                  {sending ? (
                    <button
                      onClick={() => streamStop(convId ?? undefined)}
                      aria-label="Stop generating"
                      className="bg-red-700 text-white font-bold px-3 py-1.5 rounded-xl hover:bg-red-800 transition-colors text-xs shrink-0 h-[36px] flex items-center justify-center active:scale-95"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => doSend(input)}
                      disabled={!input.trim()}
                      aria-label="Send message"
                      className="bg-[var(--r-accent)] text-white font-bold w-9 h-9 rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs shrink-0 flex items-center justify-center active:scale-95"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
        </div>

        {/* Desktop Trace Sidebar */}
        {consoleOpen && (
          <div className="hidden md:flex shrink-0 w-80 flex-col bg-[var(--r-nav-bg)] border-l border-[var(--r-border)]">
            <div className="bg-[var(--r-accent)] text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between shrink-0">
              <span>Agent Trace</span>
              <button onClick={() => setConsoleOpen(false)} aria-label="Close trace panel" className="text-white hover:opacity-80">
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto r-scroll">
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
          </div>
        )}

        {/* Mobile Trace Bottom Sheet */}
        {consoleOpen && (
          <div className="md:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Agent trace">
            <div className="absolute inset-0 bg-black/50" onClick={() => setConsoleOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 top-[15vh] bg-[var(--r-surface)] border-t border-[var(--r-border)] flex flex-col rounded-t-lg overflow-hidden shadow-2xl">
              <div className="bg-[var(--r-accent)] text-white text-[11px] font-bold px-3 py-2 flex items-center justify-between shrink-0">
                <span>Agent Trace</span>
                <button onClick={() => setConsoleOpen(false)} aria-label="Close trace panel" className="text-white">
                  ✕
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto r-scroll">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
