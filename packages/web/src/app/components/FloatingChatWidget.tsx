"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useChat, useChats, useCreateChat } from "../hooks";
import { useChatStream } from "../hooks/useChatStream";
import { useChatContext } from "../chat/ChatContext";
import { useFloatingChat } from "../FloatingChatContext";
import type { AgentEvent } from "./ProcessViewer";
import ChatMessage from "./ChatMessage";
import EmptyChatState from "./EmptyChatState";
import TruthConsole from "./TruthConsole";
import TruthConsoleDeck from "./truth-console/TruthConsoleDeck";
import { useTraceSegments } from "./truth-console/useTraceSegments";
import Spinner from "./Spinner";

const CONV_STORAGE_KEY = "truthseekers_floating_conv";

export default function FloatingChatWidget() {
  const queryClient = useQueryClient();
  const { close, activeConversationId, setActiveConversationId, toggleExpanded } = useFloatingChat();
  // Console + sending state now live in ChatContext so this widget and the
  // chat page share one source of truth (useTraceSegments reads them).
  const { sending, setSending, setLiveEvents } = useChatContext();
  const { send: streamSend, stop: streamStop } = useChatStream();
  const { data: conversations = [], loading: chatsLoading } = useChats();
  const { mutate: createChat } = useCreateChat();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "console">("chat");
  const [model, setModel] = useState("deepseek-4-flash");
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const finalizedRef = useRef(false);
  const streamContentRef = useRef("");
  const streamAccumulatorRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Per-response segment derivation (history + live, shared via context).
  const seg = useTraceSegments(convId);

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

  // Load saved conversation ID
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(CONV_STORAGE_KEY) : null;
    if (saved) {
      setConvId(saved);
      setActiveConversationId(saved);
    }
  }, [setActiveConversationId]);

  // Load conversation data
  const { data: conv, loading: convLoading } = useChat(convId ?? undefined);

  // NOTE: historical agent events are no longer reconstructed here —
  // useTraceSegments derives per-response segments directly from the React
  // Query `["chat", convId]` cache (the same cache both hosts write to).

  // Auto-scroll — defer layout read to avoid forced reflow during render.
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [conv?.messages, streamContent, seg.activeEvents.length]);

  const doSend = useCallback(async (msg: string) => {
    if (!msg.trim() || sending) return;

    let id = convId;
    if (!id) {
      setLoading(true);
      try {
        const conv = await createChat("Quick Chat");
        if (!conv) throw new Error("No conversation returned");
        id = conv.id;
        setConvId(id);
        setActiveConversationId(id);
        try { localStorage.setItem(CONV_STORAGE_KEY, id!); } catch {}
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
    setLiveEvents([]);
    agentEventsRef.current = [];
    finalizedRef.current = false;
    streamContentRef.current = "";
    streamAccumulatorRef.current = "";

    const userMsg = {
      id: `temp-${Date.now()}`,
      conversationId: cid,
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

    await streamSend(cid, msg, {
      onText: (text) => {
        streamContentRef.current = text;
        const acc = streamAccumulatorRef.current;
        setStreamContent(acc ? `${acc}\n- ${text}` : `- ${text}`);
      },
      onToolEvent: (event) => {
        setLiveEvents((prev) => {
          const next = [...prev, event];
          agentEventsRef.current = next;
          return next;
        });
        // Append completed step text to the accumulator
        const text = streamContentRef.current;
        if (text) {
          const prev = streamAccumulatorRef.current;
          streamAccumulatorRef.current = prev ? `${prev}\n- ${text}` : `- ${text}`;
          streamContentRef.current = "";
        }
      },
      onDone: (event) => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;
        const savedEvents = agentEventsRef.current;
        const finalBlocks = event.blocks ?? [];
        setStreamContent("");
        streamContentRef.current = "";
        streamAccumulatorRef.current = "";
        setStreamBlocks(finalBlocks);
        queryClient.setQueryData(["chat", cid], (prev: any) => {
          if (!prev) return prev;
          const real = prev.messages.map((m: any) =>
            m.id.startsWith("temp-") ? { ...m, id: `${Date.now()}-${Math.random()}`, conversationId: cid } : m
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
      onError: (err: string) => console.warn("Stream error:", err),
    }, model);

    setTimeout(() => setSending(false), 0);
  }, [convId, sending, streamSend, queryClient, setLiveEvents, setActiveConversationId, model]);

  const messages = useMemo(() => (conv?.messages ?? []).filter((m: any) => m.role !== "tool"), [conv?.messages]);
  const hasStreaming = sending;
  const currentConv = conversations.find((c) => c.id === convId);
  const lastAssistantIdx = [...messages].reverse().findIndex((m: any) => m.role === "assistant");
  const lastAssistantIndex = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;

  return (
    <div className="h-full flex flex-col max-md:max-h-[85vh]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {/* Session switcher */}
          <div className="relative" ref={switcherRef}>
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded max-w-[80px] sm:max-w-[140px] hover:bg-accent-bg/30 transition-colors text-muted"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="truncate max-w-[60px] sm:max-w-[100px]">{currentConv?.title ?? "Quick Chat"}</span>
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
                  <div className="px-3 py-2 text-xs text-subtle">No conversations</div>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setConvId(c.id);
                        setActiveConversationId(c.id);
                        try { localStorage.setItem(CONV_STORAGE_KEY, c.id); } catch {}
                        setSwitcherOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${c.id === convId ? "font-medium text-accent bg-accent-bg" : "text-muted bg-transparent"}`}
                    >
                      <div className="truncate">{c.title}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-border" />

          <button
            onClick={() => setView("chat")}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${view === "chat" ? "bg-accent-bg text-accent" : "text-subtle"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Chat</span>
          </button>
          {/* Console tab — the deck IS the clickable control (it's a <button>),
              so the wrapper is a styled span, not a nested button. */}
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${view === "console" ? "bg-accent-bg text-accent" : "text-subtle"}`}>
            <TruthConsoleDeck
              variant="tab"
              segments={seg.segments}
              liveSegmentId={seg.liveSegmentId}
              unreadTotal={seg.unreadCount}
              onClick={() => setView("console")}
            />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleExpanded} className="btn-ghost text-xs p-1.5 hover:scale-105 transition-transform" aria-label="Expand chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button onClick={close} className="btn-ghost text-xs p-1.5 hover:scale-105 transition-transform" aria-label="Close chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {view === "chat" ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          {loading || convLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner size={24} />
            </div>
          ) : messages.length === 0 && !sending ? (
            <EmptyChatState onSetInput={doSend} />
          ) : (
            <div className="max-w-4xl mx-auto px-3">
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
              {hasStreaming && (
                <ChatMessage role="assistant" content={streamContent} blocks={streamBlocks} streaming />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <TruthConsole
            segments={seg.segments}
            activeSegmentId={seg.activeSegmentId}
            liveSegmentId={seg.liveSegmentId}
            unreadCount={seg.unreadCount}
            activeEvents={seg.activeEvents}
            onSelectSegment={seg.selectSegment}
            onJumpToLive={seg.jumpToLive}
            loading={sending && seg.activeEvents.length === 0}
          />
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <div className="flex items-end gap-2 rounded-2xl p-1.5 bg-surface-elevated border border-border focus-within:border-accent transition-colors">
          <div className="flex-1 min-w-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(input); } }}
              placeholder={sending ? "Waiting for response..." : "Ask about any topic..."}
              disabled={sending || loading}
              rows={1}
              className="w-full resize-none bg-transparent border-none textarea-ring px-3 py-2 text-sm min-h-[36px] max-h-[120px] text-ink outline-none"
            />
          </div>
          {sending ? (
            <button
              onClick={() => streamStop(convId ?? undefined)}
              aria-label="Stop generating"
              className="btn btn-sm shrink-0 rounded-[10px] bg-oxblood text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              onClick={() => doSend(input)}
              disabled={!input.trim()}
              aria-label="Send message"
              className={`btn-icon shrink-0 rounded-[10px] transition-colors ${input.trim() ? "bg-accent text-white" : "bg-border text-subtle"}`}
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
  );
}
