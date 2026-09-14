"use client";

import { useState, useRef, useCallback, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, useChats, useCreateChat } from "../../hooks";
import { useChatStream } from "../../hooks/useChatStream";
import type { AgentEvent } from "../../components/ProcessViewer";
import ChatMessage from "../../components/ChatMessage";
import EmptyChatState from "../../components/EmptyChatState";
import TruthConsole from "../../components/TruthConsole";
import RetroWindow from "../../components/retro/RetroWindow";
import { useTraceSegments } from "../../components/truth-console/useTraceSegments";
import { useChatContext } from "../ChatContext";
import { useTheme } from "../../components/ThemeProvider";
import Spinner from "../../components/Spinner";
import { IconPlus } from "../../components/Icons";
import { IconBook, IconGear, IconMap } from "../../components/retro/icons";

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
  const { resolved: theme } = useTheme();

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
      setStreamSteps([]);
      setStreamBlocks([]);
      agentEventsRef.current = [];
      setLiveEvents([]);
      finalizedRef.current = false;
      lastUserMsgRef.current = msg;
      setSending(true);

      try {
        await streamSend(cid!, msg, {
          onText: (text: string) => {
            setStreamContent((prev) => prev + text);
          },
          onToolEvent: (event: AgentEvent) => {
            agentEventsRef.current = [...agentEventsRef.current, event];
            setLiveEvents([...agentEventsRef.current]);
            if (event.type === "tool_use" && event.data && typeof event.data === "object" && "name" in (event.data as Record<string, unknown>)) {
              const name = String((event.data as Record<string, unknown>).name || "");
              setStreamSteps((prev) => [...prev, `Tool call: ${name}`]);
            }
          },
          onDone: () => {
            if (finalizedRef.current) return;
            finalizedRef.current = true;
            queryClient.invalidateQueries({ queryKey: ["chat", cid] });
            queryClient.invalidateQueries({ queryKey: ["chats"] });
            setSending(false);
          },
          onError: (err: string) => {
            setError(err || "Connection lost");
            setSending(false);
          },
        });
      } catch (err: any) {
        setError(err.message || "Send failed");
        setSending(false);
      }
    },
    [convId, createChat, router, sending, setSending, setLiveEvents, streamSend, queryClient]
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
    setStreamSteps([]);
    setStreamBlocks([]);
    setError(null);
    setSending(false);
    router.push("/chat/new");
  };

  const showEmpty = !convLoading && messages.length === 0 && !hasStreaming;

  const NAV_LINKS = [
    { label: "Encyclopedia Articles", href: "/articles", Icon: IconBook },
    { label: "Claim Atlas & Graph", href: "/claim-graph", Icon: IconMap },
    { label: "Admin & Settings", href: "/admin", Icon: IconGear },
  ];

  return (
    <RetroWindow title={`TruthSeekers — Chat`} status={sending ? "Agent thinking…" : "Ready"} fixed>
      {/* ponytail: fixed shell → this fills the viewport; messages scroll, sessions + composer stay pinned. */}
      <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 min-w-0 bg-[var(--r-surface)] rounded-[var(--r-radius)] overflow-hidden transition-colors duration-200 border border-[var(--r-border)]">
        {/* Mobile Header Bar */}
        <div className="md:hidden shrink-0 flex items-center justify-between px-3 h-10 bg-[var(--r-nav-bg)] border-b border-[var(--r-border)]">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold bg-[var(--r-accent)] text-white rounded-[var(--r-radius)]"
            aria-label="Open session list"
          >
            <span>Sessions</span>
            <span>▾</span>
          </button>
          <span className="text-[12px] font-bold truncate max-w-[160px]" style={{ color: "var(--r-ink)" }}>
            {conv?.title ?? "TruthSeekers Chat"}
          </span>
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center w-7 h-7 bg-[var(--r-header-accent)] text-black font-bold rounded-sm border border-black/30"
            aria-label="New chat"
          >
            <IconPlus size={14} />
          </button>
        </div>

        {/* Mobile Sidebar Drawer */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-[var(--r-surface)] border-r border-[var(--r-border)] shadow-xl">
              <div className="shrink-0 flex items-center justify-between px-3 h-10 bg-[var(--r-accent)] text-white">
                <span className="text-[12px] font-bold">Conversations</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="flex items-center justify-center w-6 h-6 text-white"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>

              <div className="shrink-0 p-2.5 space-y-1 border-b border-[var(--r-border)]">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium text-[var(--r-ink)] hover:bg-black/5 rounded-[var(--r-radius)] no-underline"
                  >
                    <span aria-hidden><link.Icon size={14} /></span>
                    <span>{link.label}</span>
                  </Link>
                ))}
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
                      onClick={() => { router.push(`/chat/${c.id}`); setMobileSidebarOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 text-[12px] rounded-[var(--r-radius)] border transition-colors ${
                        c.id === convId ? "bg-[var(--r-accent)] text-white border-[var(--r-accent)] font-semibold" : "bg-transparent border-transparent text-[var(--r-ink)] hover:bg-black/5"
                      }`}
                    >
                      <div className="truncate">{c.title}</div>
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
                  <div className="mx-4 my-4 p-3 rounded-[var(--r-radius)] border border-red-300 bg-red-50 text-red-800 text-xs flex items-center justify-between gap-3">
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
                  <div className="border-t border-[var(--r-border)] bg-[var(--r-surface-elevated)]">
                    {streamSteps.length > 0 && (
                      <div className="px-4 py-2 space-y-1">
                        {streamSteps.map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] text-[var(--r-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--r-accent)]" />
                            <span>{step}</span>
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

          {/* Footer & Composer Input Area */}
          {!showEmpty && (
            <div className="shrink-0 bg-[var(--r-nav-bg)] border-t border-[var(--r-border)] p-2.5 sm:p-4">
              <div className="max-w-[960px] mx-auto space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--r-muted)] px-1">
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

                {/* Sleek Option C Composer Input Container */}
                <div className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-2 flex items-end gap-2 shadow-sm">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={sending ? "Agent is typing..." : "Ask a research question or request an article..."}
                    disabled={sending}
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none text-[13.5px] min-h-[36px] max-h-[160px] text-[var(--r-ink)] placeholder:text-[var(--r-muted)] px-2 py-1 resize-none"
                    aria-label="Chat message input"
                    style={{ lineHeight: "1.5" }}
                  />
                  {sending ? (
                    <button
                      onClick={() => streamStop(convId ?? undefined)}
                      aria-label="Stop generating"
                      className="bg-red-700 text-white font-bold px-3 py-2 rounded-[var(--r-radius)] hover:bg-red-800 transition-colors text-xs shrink-0 h-[36px]"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => doSend(input)}
                      disabled={!input.trim()}
                      aria-label="Send message"
                      className="bg-[var(--r-accent)] text-white font-bold px-3 py-2 rounded-[var(--r-radius)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs shrink-0 h-[36px] flex items-center justify-center gap-1.5"
                    >
                      <span>Send</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
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
    </RetroWindow>
  );
}
