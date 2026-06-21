"use client";

import { useState, useRef, useCallback, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "../../hooks";
import { useChatStream } from "../../hooks/useChatStream";
import type { AgentEvent } from "../../components/ProcessViewer";
import ChatMessage from "../../components/ChatMessage";
import EmptyChatState from "../../components/EmptyChatState";
import FollowUpSuggestions from "../../components/FollowUpSuggestions";
import ChatSidebar from "../../components/ChatSidebar";
import { BASE } from "@/lib/constants";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { send: streamSend, stop: streamStop } = useChatStream();

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamSteps, setStreamSteps] = useState<string[]>([]);
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const finalizedRef = useRef(false);
  const streamContentRef = useRef("");

  const { data: conv, loading: convLoading } = useChat(convId ?? undefined);
  const messages = useMemo(() => (conv?.messages ?? []).filter((m: any) => m.role !== "tool"), [conv?.messages]);
  const hasStreaming = sending;

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
  }, [messages, streamContent, streamSteps]);

  const doSend = useCallback(async (msg: string) => {
    if (!msg.trim() || sending) return;

    let cid = convId;
    if (!cid) {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("truthseekers_token") : null;
        const res = await fetch(`${BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ title: msg.slice(0, 60) }),
        });
        const data = await res.json();
        cid = data.id;
        setConvId(cid);
        try { localStorage.setItem("truthseekers_floating_conv", cid!); } catch {}
        router.replace(`/chat/${cid}`, { scroll: false });
      } catch (err) {
        console.error("Failed to create conversation", err);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    setSending(true);
    setStreamContent("");
    setStreamSteps([]);
    setStreamBlocks([]);
    setAgentEvents([]);
    agentEventsRef.current = [];
    finalizedRef.current = false;
    streamContentRef.current = "";

    const userMsg = {
      id: `temp-${Date.now()}`,
      conversationId: cid!,
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

    await streamSend(cid!, msg, {
      onText: (text) => {
        setStreamContent(text);
        streamContentRef.current = text;
      },
      onToolEvent: (event) => {
        setAgentEvents((prev) => {
          const next = [...prev, event];
          agentEventsRef.current = next;
          return next;
        });
        // Snapshot completed thinking step at tool boundary
        const text = streamContentRef.current;
        if (text) {
          setStreamSteps((prev) => [...prev, text]);
          setStreamContent("");
          streamContentRef.current = "";
        }
      },
      onDone: (event) => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;
        const savedEvents = agentEventsRef.current;
        const finalBlocks = event.blocks ?? [];
        setStreamSteps([]);
        setStreamContent("");
        streamContentRef.current = "";
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

  const followUps = lastAssistantIndex >= 0 ? ["Tell me more", "Give me sources", "Summarize this"] : [];
  const isNew = id === "new" && !convId;

  return (
    <div className="h-full flex min-h-0">
      <ChatSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-6 h-12 border-b border-border bg-surface">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden btn-ghost p-1.5"
              aria-label="Open sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold truncate text-ink">
              {isNew ? "New Chat" : conv?.title ?? "Chat"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="btn-ghost text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          {loading || convLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 rounded-full border-2 animate-spin border-border border-t-gold" />
            </div>
          ) : messages.length === 0 && !sending && isNew ? (
            <EmptyChatState suggestedTopics={suggestedTopics} onSetInput={doSend} />
          ) : (
            <div className="max-w-3xl mx-auto w-full px-3 sm:px-6">
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
                <div className="space-y-2 px-3 sm:px-6 py-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    Thinking
                  </div>
                  {streamSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-ink">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-forest shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{step}</span>
                    </div>
                  ))}
                  {streamContent && (
                    <div className="flex items-start gap-2 text-sm text-ink/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0 mt-1.5" />
                      <span>{streamContent}</span>
                    </div>
                  )}
                  {streamSteps.length === 0 && !streamContent && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 px-3 sm:px-6 pb-4 pt-2 border-t border-border bg-surface">
          <div className="max-w-3xl mx-auto w-full">
            <div className="flex items-end gap-2 rounded-2xl p-1.5 bg-surface-elevated border border-border">
              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sending ? "Waiting for response..." : "Ask about any topic..."}
                  disabled={sending}
                  rows={1}
                  className="w-full resize-none bg-transparent border-none textarea-ring px-3 py-2.5 text-sm min-h-[40px] max-h-[200px] text-ink"
                />
              </div>
              {sending ? (
                <button onClick={streamStop} aria-label="Stop generating" className="btn btn-sm shrink-0 bg-oxblood text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => doSend(input)}
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className={`btn-icon shrink-0 rounded-[10px] ${input.trim() ? "bg-accent text-white" : "bg-border text-subtle"}`}
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