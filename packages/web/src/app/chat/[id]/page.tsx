"use client";

import { useState, useRef, useCallback, useEffect, use } from "react";
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
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const agentEventsRef = useRef<AgentEvent[]>([]);

  const { data: conv, loading: convLoading } = useChat(convId ?? undefined);
  const messages = (conv?.messages ?? []).filter((m: any) => m.role !== "tool");
  const hasStreaming = sending && (streamContent || streamBlocks.length > 0);

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
        try { localStorage.setItem("truthseekers_floating_conv", id!); } catch {}
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
    }
  }

  function handleNewChat() {
    setConvId(null);
    setInput("");
    setStreamContent("");
    setStreamBlocks([]);
    setAgentEvents([]);
    router.push("/chat/new");
  }

  const followUps = lastAssistantIndex >= 0 ? ["Tell me more", "Give me sources", "Summarize this"] : [];
  const isNew = id === "new" && !convId;

  return (
    <div className="h-full flex min-h-0">
      <ChatSidebar />
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
            {isNew ? "New Chat" : conv?.title ?? "Chat"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleNewChat} className="btn-ghost text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ color: "var(--accent)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {loading || convLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
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
