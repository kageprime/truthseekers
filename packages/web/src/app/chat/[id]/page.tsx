"use client";

import { useState, useRef, useCallback, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, useChats, useCreateChat } from "../../hooks";
import { useChatStream } from "../../hooks/useChatStream";
import { useTimeMachine } from "../../hooks/useTimeMachine";
import type { AgentEvent } from "../../components/ProcessViewer";
import ChatMessage from "../../components/ChatMessage";
import EmptyChatState from "../../components/EmptyChatState";
import TruthConsole from "../../components/TruthConsole";
import { useTraceSegments } from "../../components/truth-console/useTraceSegments";
import { useChatContext } from "../ChatContext";
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
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("");
  const { mutate: createChat } = useCreateChat();
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

  const [sessionsOpen, setSessionsOpen] = useState(true);

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
    <div className="studio-shell bg-surface select-text">
      {/* ── Studio Masthead ────────────────────────────────────────── */}
      <header className="h-11 shrink-0 border-b border-rule bg-surface/95 backdrop-blur-xs px-3 sm:px-5 flex items-center justify-between text-xs gap-3 z-20">
        {/* Left: Sessions toggle + Title / Status */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setSessionsOpen((v) => !v)}
            aria-label={sessionsOpen ? "Collapse research inquiries" : "Expand research inquiries"}
            title={sessionsOpen ? "Collapse inquiries" : "Expand inquiries"}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-sharp border border-rule bg-surface-elevated text-muted hover:text-ink hover:border-gold transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          <button
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open inquiries list"
            title="Inquiries"
            className="md:hidden flex items-center justify-center w-7 h-7 rounded-sharp border border-rule bg-surface-elevated text-muted hover:text-ink cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <button
            onClick={handleNewChat}
            aria-label="New research inquiry"
            title="Start new inquiry"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sharp bg-ink text-surface hover:bg-gold hover:text-ink text-[11px] font-medium transition-colors cursor-pointer"
          >
            <IconPlus size={11} />
            <span className="hidden sm:inline">New Inquiry</span>
          </button>

          <span className="text-rule hidden sm:inline">|</span>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display font-semibold text-sm sm:text-base text-ink truncate max-w-[200px] sm:max-w-md">
              {conv?.title ?? "New Epistemic Inquiry"}
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sharp border border-rule bg-surface-elevated text-[9.5px] font-mono uppercase tracking-wider text-muted">
              <span className={`w-1.5 h-1.5 rounded-full ${sending ? "bg-gold animate-pulse" : "bg-forest"}`} />
              <span>{sending ? "Agent Live" : "Verified Corpus"}</span>
            </span>
          </div>
        </div>

        {/* Right: Agent Console Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setConsoleOpen((o) => !o)}
            aria-pressed={consoleOpen}
            aria-label="Toggle Agent Telemetry Console"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-sharp border transition-colors cursor-pointer ${
              consoleOpen
                ? "bg-gold-bg text-accent-dark border-gold/60 font-semibold"
                : "bg-surface-elevated text-muted border-rule hover:text-ink hover:border-gold"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${sending ? "bg-gold" : "bg-forest/60"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${sending ? "bg-gold" : "bg-forest"}`} />
            </span>
            <span className="text-[11px] uppercase tracking-wider">Console</span>
            {seg.unreadCount > 0 && (
              <span className="bg-oxblood text-surface text-[9px] px-1 py-0.2 rounded-sharp font-bold">
                {seg.unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Main Studio Grid ────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 min-w-0 relative">

        {/* Mobile Sidebar Drawer — Dedicated Research Inquiries List */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Research Inquiries">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col bg-surface border-r border-rule shadow-elev-3 overflow-hidden animate-slide-in-left">
              <div className="shrink-0 flex items-center justify-between px-3.5 h-12 border-b border-rule text-ink font-display font-bold text-sm">
                <span>Research Inquiries</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 text-muted hover:text-ink cursor-pointer"
                  aria-label="Close inquiries list"
                >
                  ✕
                </button>
              </div>

              {/* New Inquiry Action */}
              <div className="p-2.5 border-b border-rule bg-surface-elevated">
                <button
                  onClick={() => { handleNewChat(); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-sharp bg-ink text-surface font-semibold text-xs hover:bg-gold hover:text-ink transition-colors cursor-pointer"
                >
                  <IconPlus size={13} />
                  <span>Start New Inquiry</span>
                </button>
              </div>

              {/* Inquiries List Filter */}
              <div className="p-2.5 border-b border-rule/60">
                <input
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  placeholder="Filter inquiries…"
                  aria-label="Filter research inquiries"
                  className="w-full bg-surface-elevated border border-rule rounded-sharp px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle outline-none focus:border-gold font-sans"
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 r-scroll">
                {chatsLoading ? (
                  <div className="flex items-center justify-center py-8"><Spinner size={16} /></div>
                ) : conversations.length === 0 ? (
                  <div className="px-3 py-8 text-xs text-center text-muted font-serif italic">No research inquiries yet</div>
                ) : (
                  conversations
                    .filter((c: any) => !sessionFilter.trim() || (c.title ?? "").toLowerCase().includes(sessionFilter.trim().toLowerCase()))
                    .map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => { router.push(`/chat/${c.id}`); setMobileSidebarOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-sharp border transition-colors text-xs cursor-pointer block truncate ${
                          c.id === convId
                            ? "bg-gold-bg/40 text-ink border-gold/70 font-semibold"
                            : "bg-surface-elevated border-rule/70 text-ink hover:border-rule active:bg-ink/5"
                        }`}
                      >
                        <div className="truncate font-serif">{c.title || "Untitled inquiry"}</div>
                      </button>
                    ))
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Desktop Left Rail — Research Inquiries Navigator */}
        {sessionsOpen && (
          <aside className="hidden md:flex flex-col shrink-0 w-64 lg:w-72 bg-surface border-r border-rule h-full">
            <div className="shrink-0 flex items-center justify-between px-3 h-10 border-b border-rule text-muted text-[10px] font-mono uppercase tracking-[0.16em]">
              <span>Inquiry Corpus</span>
              <span className="tabular-nums font-mono">{conversations.length}</span>
            </div>

            <div className="p-2 border-b border-rule/60 bg-surface/50">
              <input
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                placeholder="Search inquiries…"
                aria-label="Filter inquiries"
                className="w-full bg-surface-elevated border border-rule rounded-sharp px-2.5 py-1 text-xs text-ink placeholder:text-subtle outline-none focus:border-gold font-sans"
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1 r-scroll">
              {chatsLoading ? (
                <div className="flex items-center justify-center py-8"><Spinner size={14} /></div>
              ) : conversations.length === 0 ? (
                <div className="px-3 py-8 text-xs text-center text-muted font-serif italic">No inquiries recorded yet</div>
              ) : (
                conversations
                  .filter((c: any) => !sessionFilter.trim() || (c.title ?? "").toLowerCase().includes(sessionFilter.trim().toLowerCase()))
                  .map((c: any) => {
                    const active = c.id === convId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => router.push(`/chat/${c.id}`)}
                        className={`w-full text-left px-2.5 py-2 text-xs rounded-sharp border transition-all cursor-pointer ${
                          active
                            ? "bg-gold-bg/30 text-ink border-gold/60 font-medium shadow-elev-1"
                            : "bg-transparent border-transparent text-muted hover:text-ink hover:bg-surface-elevated"
                        }`}
                      >
                        <div className="truncate font-serif">{c.title || "Untitled inquiry"}</div>
                      </button>
                    );
                  })
              )}
            </div>
          </aside>
        )}

        {/* Center Pane — Reading & Investigation Canvas */}
        <main className="flex-1 flex flex-col min-w-0 bg-surface relative h-full">
          {/* Scrollable Conversation Canvas */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 r-scroll">
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-6">
              {loading || convLoading ? (
                <div className="space-y-6 py-8">
                  <div className="flex justify-end">
                    <div className="rounded-sharp p-4 max-w-[70%] bg-surface-elevated border border-rule">
                      <div className="h-3 skeleton rounded-sharp w-40" />
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="rounded-sharp p-4 max-w-[80%] bg-surface-elevated border border-rule space-y-2">
                      <div className="h-3 skeleton rounded-sharp w-56" />
                      <div className="h-3 skeleton rounded-sharp w-44" />
                    </div>
                  </div>
                </div>
              ) : showEmpty ? (
                <EmptyChatState onSetInput={doSend} />
              ) : (
                <div className="space-y-4">
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
                    <div className="p-3.5 rounded-sharp border border-oxblood/40 bg-oxblood-subtle/50 text-oxblood text-xs flex items-center justify-between gap-3 shadow-elev-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono">ERROR:</span>
                        <span>{error}</span>
                      </div>
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
                    <div className="border border-rule rounded-sharp bg-surface-elevated/80 shadow-elev-1 p-2">
                      <ChatMessage role="assistant" content={streamContent} blocks={streamBlocks} agentEvents={liveEvents} streaming />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pinned Bottom Studio Composer */}
          <div
            className="shrink-0 border-t border-rule bg-surface/90 backdrop-blur-md p-3 sm:p-4 z-10"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-4xl mx-auto w-full space-y-2">
              <div className="bg-surface-elevated border border-rule rounded-sharp p-2 flex items-end gap-2 shadow-elev-1 focus-within:border-gold focus-within:shadow-elev-2 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sending ? "Veritas is analyzing sources & writing evidence…" : "Inquire into any subject, claim, or request verified article synthesis…"}
                  disabled={sending}
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none text-[15px] sm:text-[14px] min-h-[38px] max-h-[180px] text-ink placeholder:text-subtle px-3 py-1.5 resize-none font-sans"
                  aria-label="Research inquiry input"
                  style={{ lineHeight: "1.5" }}
                />

                {sending ? (
                  <button
                    onClick={() => streamStop(convId ?? undefined)}
                    aria-label="Stop generating"
                    className="bg-oxblood text-surface font-semibold px-3.5 py-1.5 rounded-sharp hover:brightness-110 transition-colors text-xs shrink-0 h-[38px] flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={() => doSend(input)}
                    disabled={!input.trim()}
                    aria-label="Send message"
                    className="bg-ink text-surface font-bold w-10 h-[38px] rounded-sharp hover:bg-gold hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-subtle px-1">
                <span>Enter to submit · Shift+Enter for newline</span>
                <span>{sending ? "Autonomous Agent Running" : "Veritas Pipeline Ready"}</span>
              </div>
            </div>
          </div>
        </main>

        {/* Desktop Right Rail — Veritas Agent Console / TruthConsole */}
        {consoleOpen && (
          <aside className="hidden md:flex shrink-0 w-80 lg:w-96 flex-col bg-surface border-l border-rule h-full">
            <div className="bg-surface border-b border-rule text-ink text-[10px] font-mono uppercase tracking-[0.16em] px-3 py-2 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-forest animate-pulse" />
                <span>Agent Telemetry</span>
              </span>
              <button
                onClick={() => setConsoleOpen(false)}
                aria-label="Close telemetry console"
                className="text-subtle hover:text-ink cursor-pointer p-0.5"
              >
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
          </aside>
        )}

        {/* Mobile Trace Bottom Sheet */}
        {consoleOpen && (
          <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Agent trace">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setConsoleOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 top-[15vh] bg-surface border-t border-rule flex flex-col rounded-t-lg overflow-hidden shadow-elev-3">
              <div className="bg-surface border-b border-rule text-ink text-[11px] font-mono uppercase tracking-[0.14em] px-3.5 py-2.5 flex items-center justify-between shrink-0">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest animate-pulse" />
                  <span>Agent Telemetry</span>
                </span>
                <button
                  onClick={() => setConsoleOpen(false)}
                  aria-label="Close telemetry console"
                  className="p-1 text-muted hover:text-ink cursor-pointer"
                >
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
