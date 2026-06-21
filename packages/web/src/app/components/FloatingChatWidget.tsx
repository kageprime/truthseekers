"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useChat, useChats } from "../hooks";
import { useChatStream } from "../hooks/useChatStream";
import { useChatContext } from "../chat/ChatContext";
import { useFloatingChat } from "../FloatingChatContext";
import type { AgentEvent } from "./ProcessViewer";
import ChatMessage from "./ChatMessage";
import EmptyChatState from "./EmptyChatState";
import FollowUpSuggestions from "./FollowUpSuggestions";
import TruthConsole from "./TruthConsole";
import { BASE } from "@/lib/constants";

const CONV_STORAGE_KEY = "truthseekers_floating_conv";

export default function FloatingChatWidget() {
  const queryClient = useQueryClient();
  const { close, activeConversationId, setActiveConversationId, toggleExpanded } = useFloatingChat();
  const { agentEvents, setAgentEvents, setConsoleOpen, consoleOpen } = useChatContext();
  const { send: streamSend, stop: streamStop } = useChatStream();
  const { data: conversations = [], loading: chatsLoading } = useChats();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "console">("chat");
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const finalizedRef = useRef(false);
  const streamContentRef = useRef("");
  const streamAccumulatorRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Populate agent events from historical messages on load
  const prevConvRef = useRef(conv);
  useEffect(() => {
    if (!conv || conv === prevConvRef.current) return;
    prevConvRef.current = conv;
    const events: AgentEvent[] = [];
    for (const m of conv.messages ?? []) {
      if (m.agentEvents?.length) {
        events.push(...m.agentEvents);
      } else if (m.role === "tool") {
        // Reconstruct tool events from stored tool messages
        const name = m.tool_name || "tool_call";
        events.push({
          type: "tool_use",
          data: { name, args: {} },
          timestamp: new Date(m.createdAt).getTime(),
        });
        if (m.content?.trim()) {
          events.push({
            type: "tool_result",
            data: { name, result: m.content.slice(0, 1000) },
            timestamp: new Date(m.createdAt).getTime(),
          });
        }
      }
    }
    if (events.length > 0) setAgentEvents(events);
  }, [conv, setAgentEvents]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv?.messages, streamContent, agentEvents.length]);

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
          body: JSON.stringify({ title: "Quick Chat" }),
        });
        const data = await res.json();
        id = data.id;
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
    setAgentEvents([]);
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
        setAgentEvents((prev) => {
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
                content: finalBlocks.length > 0 ? "" : (event.content || ""),
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
  }, [convId, sending, streamSend, queryClient, setAgentEvents, setActiveConversationId]);

  const messages = useMemo(() => (conv?.messages ?? []).filter((m: any) => m.role !== "tool"), [conv?.messages]);
  const hasStreaming = sending;
  const currentConv = conversations.find((c) => c.id === convId);
  const lastAssistantIdx = [...messages].reverse().findIndex((m: any) => m.role === "assistant");
  const lastAssistantIndex = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;
  const followUps = lastAssistantIndex >= 0 ? ["Tell me more", "Give me sources", "Summarize this"] : [];

  const suggestedTopics = [
    "What is quantum computing?",
    "Explain the history of the Roman Empire",
    "How does CRISPR gene editing work?",
    "Show me a timeline of space exploration",
    "Compare classical vs quantum computing",
    "What caused the Industrial Revolution?",
  ];

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
                    <div className="w-4 h-4 rounded-full border-2 animate-spin border-border border-t-gold" />
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
          <button
            onClick={() => setView("console")}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${view === "console" ? "bg-accent-bg text-accent" : "text-subtle"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>Console{agentEvents.length > 0 && <span className="ml-0.5">({agentEvents.length})</span>}</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleExpanded} className="btn-ghost text-xs p-1.5" aria-label="Expand chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button onClick={close} className="btn-ghost text-xs p-1.5" aria-label="Close chat">
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
              <div className="w-6 h-6 rounded-full border-2 animate-spin border-border border-t-gold" />
            </div>
          ) : messages.length === 0 && !sending ? (
            <EmptyChatState suggestedTopics={suggestedTopics} onSetInput={doSend} />
          ) : (
            <div className="max-w-4xl mx-auto">
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
                <ChatMessage role="assistant" content={streamContent} streaming />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <TruthConsole events={agentEvents} loading={sending && agentEvents.length === 0} />
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(input); } }}
            placeholder={sending ? "Waiting for response..." : "Type a message..."}
            disabled={sending || loading}
            className="input flex-1 text-sm py-2"
          />
          <button
            onClick={sending ? streamStop : () => doSend(input)}
            disabled={!sending && !input.trim()}
            className="btn btn-primary btn-sm shrink-0 min-h-[38px]"
          >
            {sending ? "■" : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}
