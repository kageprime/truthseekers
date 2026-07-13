"use client";

import { useState, useRef, useCallback, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import ContentCard from "../../components/ContentCard";
import Spinner from "../../components/Spinner";
import { IconPlus } from "../../components/Icons";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { send: streamSend, stop: streamStop } = useChatStream();


  // Console state lives in ChatContext so the FloatingChatWidget and this page
  // share one source of truth; `useTraceSegments` derives the per-response
  // segments from history + the live array in context.
  const {
    consoleOpen, setConsoleOpen,
    sending, setSending,
    setLiveEvents,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamSteps, setStreamSteps] = useState<string[]>([]);
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("deepseek-4-flash");
  const { mutate: createChat } = useCreateChat();
  const { data: apiModels } = useModels();

  // Per-response segment derivation — must come after convId is declared.
  const seg = useTraceSegments(convId ?? id ?? null);

  const MODELS = (apiModels && apiModels.length > 0)
    ? apiModels.filter((m: any) => m.toolCall).map((m: any) => ({ id: m.name, label: m.displayName }))
    : [
        { id: "deepseek-4-flash", label: "DeepSeek 4 Flash" },
        { id: "gemma-4-31b-it", label: "Gemma 4 31B" },
      ];
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const finalizedRef = useRef(false);
  const lastUserMsgRef = useRef<string>("");
  const switcherRef = useRef<HTMLDivElement>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { data: conversations = [], loading: chatsLoading } = useChats();

  const { data: conv, loading: convLoading } = useChat(convId ?? undefined);
  const messages = useMemo(() => (conv?.messages ?? []).filter((m: any) => m.role !== "tool"), [conv?.messages]);
  const hasStreaming = sending;

  const lastAssistantIdx = [...messages].reverse().findIndex((m: any) => m.role === "assistant");
  const lastAssistantIndex = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";

  // Auto-scroll on new content. requestAnimationFrame defers the layout read
  // to the next frame so we don't force a synchronous reflow inside a render.
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages, streamContent, streamSteps]);

  // Auto-resize textarea. Debounce to avoid a forced reflow on every
  // keystroke; 16ms (≈1 frame) is imperceptible but batches rapid input.
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

  // Auto-open console when the live run emits its first tool event —
  // desktop only (the 440px rail doesn't fit on mobile; users open it
  // manually via the notification deck badge).
  useEffect(() => {
    if (seg.liveSegmentId && !consoleOpen && window.innerWidth >= 768) setConsoleOpen(true);
  }, [seg.liveSegmentId, consoleOpen, setConsoleOpen]);

  // Close session switcher on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    if (switcherOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [switcherOpen]);

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
              // Defer the steps update to avoid cascading re-renders inside
              // a state updater (which blocked the next paint for ~444ms).
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
          // NOTE: intentionally NOT closing the console here — the segment
          // cycling model keeps it open so the user can review the just-finished
          // turn's tool calls. The active segment migrates from "live" to the
          // committed historical message (handled by useTraceSegments).
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
      }, model);

      setTimeout(() => setSending(false), 0);
    },
    [convId, sending, streamSend, queryClient, router, model],
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ContentCard
        header={
          <div className="flex items-center justify-between px-3 py-2.5 gap-2">
            <div className="flex items-center gap-1 min-w-0">
              {/* Session switcher */}
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() => setSwitcherOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded hover:bg-accent-bg/30 transition-colors"
                  style={{ color: "var(--muted)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="truncate max-w-[80px] sm:max-w-[180px]">{isNew ? "New Chat" : conv?.title ?? "Chat"}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {switcherOpen && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-lg py-1 shadow-xl z-50 bg-surface border border-border max-h-[300px] overflow-y-auto">
                    {chatsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner size={16} />
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="px-3 py-2 text-xs" style={{ color: "var(--subtle)" }}>No conversations</div>
                    ) : (
                      conversations.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            router.push(`/chat/${c.id}`);
                            setSwitcherOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs transition-colors"
                          style={{
                            color: c.id === convId ? "var(--accent)" : "var(--muted)",
                            background: c.id === convId ? "var(--accent-bg)" : "transparent",
                          }}
                        >
                          <div className="truncate">{c.title}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Model picker */}
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  aria-label="Select AI model"
                  className="appearance-none bg-transparent text-[10px] text-subtle border border-border/50 rounded px-1.5 py-1 pr-4 cursor-pointer hover:text-ink hover:border-accent/40 transition-colors outline-none"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-subtle">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleNewChat} className="btn-ghost p-1.5 text-subtle hover:text-accent cursor-pointer" aria-label="New chat" title="New chat">
                <IconPlus size={16} />
              </button>
            </div>
          </div>
        }
        footer={
          <>
            {!showEmpty && (
              <div className="shrink-0 flex items-center justify-end px-4 py-1 border-t border-border/40">
                <TruthConsoleDeck
                  variant="footer"
                  segments={seg.segments}
                  liveSegmentId={seg.liveSegmentId}
                  unreadTotal={seg.unreadCount}
                  onClick={() => setConsoleOpen((o) => !o)}
                />
              </div>
            )}
            {!showEmpty && (
              <div className="shrink-0 px-4 pb-3 pt-1.5">
                <div className="flex items-end gap-2 rounded-xl p-1 bg-surface-elevated border border-border/70 transition-all focus-within:border-accent/50 focus-within:shadow-[0_0_0_3px_var(--gold-bg)]">
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={sending ? "Waiting for response..." : "Ask about any topic..."}
                      disabled={sending}
                      rows={1}
                      className="w-full resize-none bg-transparent border-none px-3 py-2 text-sm min-h-[38px] max-h-[180px] text-ink outline-none placeholder:text-subtle/60"
                      aria-label="Chat message input"
                    />
                  </div>
                  {sending ? (
                    <button
                      onClick={() => streamStop(convId ?? undefined)}
                      aria-label="Stop generating"
                      className="btn btn-sm shrink-0 rounded-lg bg-oxblood text-white active:scale-90 h-8"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      <span className="text-[11px]">Stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => doSend(input)}
                      disabled={!input.trim()}
                      aria-label="Send message"
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${input.trim() ? "bg-accent text-white" : "bg-border/50 text-subtle cursor-not-allowed"}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex justify-between mt-1 px-1">
                  <span className="text-[8px] text-subtle/60">Enter to send &middot; Shift+Enter for new line</span>
                </div>
              </div>
            )}
          </>
        }
      >
        {loading || convLoading ? (
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5">
            {/* User message skeleton — right-aligned */}
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-md p-3 sm:p-4 max-w-[70%]" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                <div className="h-3 skeleton rounded w-40" />
              </div>
            </div>
            {/* Assistant message skeleton — left-aligned */}
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
            {/* Another user message */}
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-md p-3 sm:p-4 max-w-[60%]" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                <div className="h-3 skeleton rounded w-32" />
              </div>
            </div>
            {/* Assistant typing skeleton */}
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
          <div className="flex-1 overflow-y-auto">
            <EmptyChatState onSetInput={doSend} />
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
              <div>
                {messages.map((msg: any, i: number) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    blocks={msg.blocks}
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
                  <div className="border-t border-border/40" style={{ background: "color-mix(in srgb, var(--accent-bg) 6%, transparent)" }}>
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
                    <ChatMessage role="assistant" content={streamContent} blocks={streamBlocks} streaming />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </ContentCard>

      {consoleOpen && (
        <div className="fixed right-0 top-0 bottom-0 z-[var(--z-overlay)] w-[440px] max-w-[92vw] flex flex-col bg-surface border-l border-border/40 animate-slide-in-right">
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
