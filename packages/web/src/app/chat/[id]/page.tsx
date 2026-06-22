"use client";

import { useState, useRef, useCallback, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "../../hooks";
import { useChatStream } from "../../hooks/useChatStream";
import type { AgentEvent } from "../../components/ProcessViewer";
import ChatMessage from "../../components/ChatMessage";
import EmptyChatState from "../../components/EmptyChatState";
import HistorySheet from "../../components/HistorySheet";
import TruthConsole from "../../components/TruthConsole";
import { useTheme } from "../../components/ThemeProvider";
import { BASE } from "@/lib/constants";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { send: streamSend, stop: streamStop } = useChatStream();
  const { resolved, toggle } = useTheme();

  const [input, setInput] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamSteps, setStreamSteps] = useState<string[]>([]);
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(id !== "new" ? id : null);
  const [loading, setLoading] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const finalizedRef = useRef(false);
  const lastUserMsgRef = useRef<string>("");

  const { data: conv, loading: convLoading } = useChat(convId ?? undefined);
  const messages = useMemo(() => (conv?.messages ?? []).filter((m: any) => m.role !== "tool"), [conv?.messages]);
  const hasStreaming = sending;

  const lastAssistantIdx = [...messages].reverse().findIndex((m: any) => m.role === "assistant");
  const lastAssistantIndex = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent, streamSteps]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const doSend = useCallback(
    async (msg: string) => {
      if (!msg.trim() || sending) return;
      setError(null);

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
      setAgentEvents([]);
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
          // Accumulate as plain text (no dash prefix) — renders via MarkdownRenderer.
          setStreamContent(text);
        },
        onToolEvent: (event) => {
          setAgentEvents((prev) => {
            const next = [...prev, event];
            agentEventsRef.current = next;
            return next;
          });
          // When a tool event fires, save the current streaming text as a completed
          // step, then reset the streaming buffer for the next paragraph.
          setStreamContent((cur) => {
            if (cur.trim()) {
              setStreamSteps((steps) => [...steps, cur.trim()]);
            }
            return "";
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
          queryClient.cancelQueries({ queryKey: ["chat", cid] });
          queryClient.setQueryData(["chat", cid], (prev: any) => {
            if (!prev) return prev;
            if (prev.messages.some((m: any) => m.role === "assistant" && !m.id.startsWith("temp-")))
              return prev;
            const real = prev.messages.map((m: any) =>
              m.id.startsWith("temp-") ? { ...m, id: `${Date.now()}-${Math.random()}`, conversationId: cid } : m,
            );
            return {
              ...prev,
              messages: [
                ...real,
                {
                  id: event.msgId ?? `msg-${Date.now()}-${Math.random()}`,
                  conversationId: cid,
                  role: "assistant" as const,
                  content: finalBlocks.length > 0 ? "" : event.content || "",
                  blocks: finalBlocks,
                  agentEvents: savedEvents,
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          });
        },
        onError: (errMsg) => {
          setError(errMsg || "Something went wrong. Please try again.");
        },
      });

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
    setAgentEvents([]);
    setError(null);
    setHistoryOpen(false);
    router.push("/chat/new");
  }

  const isNew = id === "new" && !convId;
  const showEmpty = messages.length === 0 && !sending && isNew;

  return (
    <div className="h-full flex flex-row min-h-0">
      {/* History sidebar */}
      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <div className="flex-1 flex flex-col min-h-0">
      {/* Slim header */}
      <div className="shrink-0 flex items-center justify-between px-4 h-9 border-b border-border bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setHistoryOpen(true)}
            className="btn-ghost p-1.5"
            aria-label="Open history"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-sm font-medium truncate text-ink">
            {isNew ? "New Chat" : conv?.title ?? "Chat"}
          </h1>
        </div>
        <button onClick={toggle} className="btn-ghost p-1.5" aria-label="Toggle theme">
          {resolved === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading || convLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 rounded-full border-2 animate-spin border-border border-t-gold" />
          </div>
        ) : showEmpty ? (
          <div className="flex-1 overflow-y-auto">
            <EmptyChatState onSetInput={doSend} />
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-3xl mx-auto w-full">
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

                {/* Error message */}
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

                {/* Streaming message */}
                {hasStreaming && (
                  <div className="px-3 sm:px-6 py-4 bg-accent-bg/5">
                    {/* Completed steps shown as subtle bullets */}
                    {streamSteps.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {streamSteps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted">
                            <span className="mt-1 w-1 h-1 rounded-full bg-accent shrink-0" />
                            <span className="line-clamp-2">{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <ChatMessage role="assistant" content={streamContent} streaming />
                  </div>
                )}
              </div>
            </div>

            {/* Collapsible console drawer */}
            {(agentEvents.length > 0 || sending) && (
              <div className="shrink-0 border-t border-border">
                <button
                  onClick={() => setConsoleOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-subtle hover:text-ink transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${consoleOpen ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    Agent Console
                    {agentEvents.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-accent-bg text-accent text-[10px]">
                        {agentEvents.length}
                      </span>
                    )}
                  </span>
                  {sending && (
                    <span className="flex items-center gap-1 text-[10px] text-accent">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      working...
                    </span>
                  )}
                </button>
                <div className={`console-drawer ${consoleOpen ? "open" : ""}`}>
                  <div className="console-drawer-inner">
                    <div className="max-h-[300px] overflow-y-auto">
                      <TruthConsole
                        events={agentEvents}
                        loading={sending && agentEvents.length === 0}
                        variant="terminal"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Input — hidden on empty state (it has its own) */}
        {!showEmpty && (
          <div className="shrink-0 px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto w-full">
              <div className="flex items-end gap-2 rounded-2xl p-1.5 bg-surface-elevated border border-border focus-within:border-accent transition-colors">
                <div className="flex-1 min-w-0">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={sending ? "Waiting for response..." : "Ask about any topic..."}
                    disabled={sending}
                    rows={1}
                    className="w-full resize-none bg-transparent border-none textarea-ring px-3 py-2.5 text-sm min-h-[40px] max-h-[200px] text-ink outline-none"
                  />
                </div>
                {sending ? (
                  <button
                    onClick={streamStop}
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
        )}
      </div>
    </div>
    </div>
  );
}
