"use client";

import { useState, useRef, useCallback, useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "../hooks";
import { useChatStream } from "../hooks/useChatStream";
import { useChatContext } from "../chat/ChatContext";
import { useFloatingChat } from "../FloatingChatContext";
import type { AgentEvent } from "./ProcessViewer";
import ChatMessage from "./ChatMessage";
import TruthConsole from "./TruthConsole";
import { BASE } from "@/lib/constants";

const CONV_STORAGE_KEY = "truthseekers_floating_conv";

export default function FloatingChatWidget() {
  const queryClient = useQueryClient();
  const { close, activeConversationId, setActiveConversationId } = useFloatingChat();
  const { agentEvents, setAgentEvents, setConsoleOpen, consoleOpen } = useChatContext();
  const { send: streamSend, stop: streamStop } = useChatStream();

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "console">("chat");
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          if (Array.isArray(blocks)) {
            setStreamBlocks(blocks);
          }
        }
      },
      onDone: (event) => {
        const savedEvents = agentEventsRef.current;
        const finalBlocks = event.blocks ?? [];
        setStreamContent("");
        setStreamBlocks(finalBlocks);

        queryClient.setQueryData(["chat", cid], (prev: any) => {
          if (!prev) return prev;
          const real = prev.messages.map((m: any) =>
            m.id.startsWith("temp-") ? { ...m, id: `user-${Date.now()}`, conversationId: cid } : m
          );
          return {
            ...prev,
            messages: [
              ...real,
              {
                id: event.msgId ?? `msg-${Date.now()}`,
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
  }, [convId, sending, streamSend, queryClient, setAgentEvents, setActiveConversationId]);

  const messages = conv?.messages ?? [];
  const hasStreaming = sending && (streamContent || streamBlocks.length > 0);

  return (
    <div className="h-full flex flex-col max-md:max-h-[85vh]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("chat")}
            className={`text-xs font-medium px-2 py-1 rounded ${view === "chat" ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--subtle)]"}`}
          >
            Chat
          </button>
          <button
            onClick={() => setView("console")}
            className={`text-xs font-medium px-2 py-1 rounded ${view === "console" ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--subtle)]"}`}
          >
            Console {agentEvents.length > 0 && `(${agentEvents.length})`}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={close} className="btn-ghost text-xs" aria-label="Close chat">
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      {view === "chat" ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          {loading || convLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
            </div>
          ) : messages.length === 0 && !sending ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-sm font-medium mb-2" style={{ color: "var(--muted)" }}>Ask me anything</p>
              <p className="text-xs" style={{ color: "var(--subtle)" }}>
                I can search the web, look up articles, generate content, and more.
              </p>
            </div>
          ) : (
            <div>
              {messages.map((msg: any, i: number) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  blocks={msg.blocks}
                  createdAt={msg.createdAt}
                />
              ))}
              {hasStreaming && (
                <ChatMessage
                  role="assistant"
                  content={streamContent}
                  blocks={streamBlocks}
                  streaming
                />
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
      <div className="shrink-0 border-t px-3 py-3" style={{ borderColor: "var(--border)" }}>
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
            className="btn btn-primary btn-sm shrink-0"
            style={{ minHeight: 38 }}
          >
            {sending ? "■" : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}
