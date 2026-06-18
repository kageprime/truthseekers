"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "../../hooks";
import type { ConversationDetail } from "../../hooks";
import { useAuth } from "../../hooks/useAuth";
import MessageList from "../../components/MessageList";
import ChatInput from "../../components/ChatInput";
import type { AgentEvent } from "../../components/ProcessViewer";
import { useChatStream } from "../../hooks/useChatStream";
import TruthConsole from "../../components/TruthConsole";
import { IconSearch, IconBook, IconMap, IconLightning } from "../../components/Icons";

const SLASH_COMMANDS = [
  { id: "search", label: "Search the web", description: "/search <query>", icon: IconSearch },
  { id: "article", label: "Look up an article", description: "/article <slug>", icon: IconBook },
  { id: "map", label: "Show a map", description: "/map <location>", icon: IconMap },
  { id: "generate", label: "Generate an article", description: "/generate <topic>", icon: IconLightning },
];

const suggestedTopics = [
  "Timeline of the Roman Empire",
  "Map of Ancient Greece",
  "The Science of Black Holes",
  "History of the Silk Road",
];

const PHASE_LABELS: Record<string, string> = {
  web_search: "Researching...",
  tavilySearch: "Searching web...",
  webfetch: "Fetching data...",
  get_article: "Looking up articles...",
  render_blocks: "Building response...",
  create_article: "Generating article...",
  task: "Delegating sub-agent...",
};

function getPhaseLabel(events: AgentEvent[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "tool_use") {
      const d = e.data as Record<string, unknown> | undefined;
      const name = d?.name as string | undefined;
      if (name && PHASE_LABELS[name]) return PHASE_LABELS[name];
    }
    if (e.type === "text") return "Writing...";
  }
  return "Thinking...";
}

function generateFollowUps(userMsg: string): string[] {
  const topic = userMsg.length > 60 ? userMsg.slice(0, 60) + "..." : userMsg;
  return [
    `Tell me more about ${topic}`,
    "Summarize the key points",
    "Find related articles",
  ];
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: fetchedData, loading: chatLoading } = useChat(id);
  
  const data = fetchedData ?? null;
  const loading = chatLoading && !data;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const streamBlocksRef = useRef<any[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [phaseLabel, setPhaseLabel] = useState("Thinking...");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [model, setModel] = useState("deepseek-4-flash");
  const lastMessageRef = useRef("");
  const autoSentRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { send: streamSend, stop: streamStop } = useChatStream();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setPhaseLabel(getPhaseLabel(agentEvents));
  }, [agentEvents]);

  const doSend = useCallback(async (msg: string) => {
    setSending(true);
    setError(null);
    lastMessageRef.current = msg;
    setInput("");
    setStreamContent("");
    setStreamBlocks([]);
    setAgentEvents([]);
    setPhaseLabel("Thinking...");
    setFollowUps([]);

    const tempId = `temp-${Date.now()}`;
    const userMsg = {
      id: tempId,
      conversationId: id,
      role: "user" as const,
      content: msg,
      createdAt: new Date().toISOString()
    };

    // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
    await queryClient.cancelQueries({ queryKey: ["chat", id] });

    // Snapshot the previous value
    const previousChat = queryClient.getQueryData<ConversationDetail>(["chat", id]);

    // Optimistically update to the new value
    queryClient.setQueryData<ConversationDetail | null>(["chat", id], (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, userMsg],
      };
    });

    await streamSend(id, msg, {
      onText: (text) => setStreamContent(text),
      onToolEvent: (event) => {
        setAgentEvents((prev) => {
          const next = [...prev, event];
          agentEventsRef.current = next;
          return next;
        });
        // Extract blocks from render_blocks tool calls for live streaming preview
        const d = event.data as Record<string, unknown> | undefined;
        if (d?.name === "render_blocks") {
          const result = d.result as Record<string, unknown> | undefined;
          const blocks = result?.blocks ?? (d.args as Record<string, unknown> | undefined)?.blocks;
          if (Array.isArray(blocks)) {
            streamBlocksRef.current = blocks;
            setStreamBlocks(blocks);
          }
        }
      },
      onDone: (event) => {
        const savedEvents = agentEventsRef.current;
        const finalBlocks = event.blocks ?? streamBlocksRef.current;
        setStreamContent("");
        setStreamBlocks(finalBlocks);
        setFollowUps(generateFollowUps(lastMessageRef.current));
        
        queryClient.setQueryData<ConversationDetail | null>(["chat", id], (prev) => {
          if (!prev) return prev;
          const real = prev.messages.map((m) =>
            m.id.startsWith("temp-") ? { ...m, id: `user-${Date.now()}`, conversationId: id } : m
          );
          return {
            ...prev,
            messages: [
              ...real,
              {
                id: event.msgId ?? `msg-${Date.now()}`,
                conversationId: id,
                role: "assistant" as const,
                content: event.content || "",
                blocks: finalBlocks,
                agentEvents: savedEvents,
                createdAt: new Date().toISOString()
              }
            ]
          };
        });

        // Also invalidate chats so the message count in the sidebar updates
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      },
      onError: (errMsg) => {
        setError(errMsg);
        if (previousChat) {
          queryClient.setQueryData(["chat", id], previousChat);
        }
      },
    }, model);
  
    // Defer to next macrotask so React can commit the streaming preview
    // (with blocks) before sending becomes false.
    setTimeout(() => setSending(false), 0);
  }, [id, streamSend, model, queryClient]);

  useEffect(() => {
    if (!loading && data && data.messages.length === 0 && !autoSentRef.current) {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) {
        autoSentRef.current = true;
        lastMessageRef.current = q;
        setInput(q);
        setTimeout(() => doSend(q), 0);
      }
    }
  }, [loading, data, id, doSend]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.messages, streamContent, agentEvents.length]);

  useEffect(() => {
    if (!sending && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [sending]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollBtn(!atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function handleStop() {
    streamStop();
  }

  function handleRegenerate() {
    if (!data) return;
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (lastUser) doSend(lastUser.content);
  }

  function handleSend() {
    if (editingIndex !== null) {
      const msg = input.trim();
      if (!msg || !data) return;
      const newMessages = data.messages.slice(0, editingIndex);
      queryClient.setQueryData<ConversationDetail | null>(["chat", id], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: newMessages,
        };
      });
      setEditingIndex(null);
      doSend(msg);
      return;
    }
    const msg = input.trim() || lastMessageRef.current;
    if (!msg || sending) return;
    doSend(msg);
  }

  function handleEdit(index: number) {
    if (!data) return;
    setEditingIndex(index);
    setInput(data.messages[index].content);
    textareaRef.current?.focus();
  }

  function cancelEdit() {
    setEditingIndex(null);
    setInput("");
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  function handleSlashCommand(cmd: string) {
    setShowCommands(false);
    setInput(cmd + " ");
    textareaRef.current?.focus();
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (value === "/") {
      setShowCommands(true);
    } else if (showCommands && !value.startsWith("/")) {
      setShowCommands(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      if (showCommands) { setShowCommands(false); return; }
      if (editingIndex !== null) { cancelEdit(); return; }
    }
  }

  const messages = data?.messages ?? [];
  const lastAssistantIdx = messages.length > 0
    ? [...messages].reverse().findIndex((m) => m.role === "assistant")
    : -1;
  const lastAssistantIndex = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-8 h-8 rounded-full border-3 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        <p className="text-sm" style={{ color: "var(--subtle)" }}>Loading conversation...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm mb-4" style={{ color: error ? "var(--red)" : "var(--subtle)" }}>
            {error || "Conversation not found"}
          </p>
          <Link href="/" className="btn btn-primary btn-sm">New Chat</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-row min-h-0 chat-enter">
      <div className="flex-1 flex flex-col min-w-0">
        <MessageList
          messages={messages}
          streamContent={streamContent}
          streamBlocks={streamBlocks}
          sending={sending}
          error={error}
          followUps={followUps}
          showScrollBtn={showScrollBtn}
          phaseLabel={phaseLabel}
          agentEvents={agentEvents}
          lastAssistantIndex={lastAssistantIndex}
          suggestedTopics={suggestedTopics}
          scrollRef={scrollRef}
          onScrollToBottom={scrollToBottom}
          onRegenerate={handleRegenerate}
          onEdit={handleEdit}
          onCopy={(content) => navigator.clipboard?.writeText(content)?.catch(() => {})}
          onSend={doSend}
          onRetry={handleSend}
          onSetInput={setInput}
        />
        <ChatInput
          input={input}
          sending={sending}
          editingIndex={editingIndex}
          showCommands={showCommands}
          slashCommands={SLASH_COMMANDS}
          textareaRef={textareaRef}
          onChange={handleInputChange}
          onSend={handleSend}
          onStop={handleStop}
          onCancelEdit={cancelEdit}
          onSlashCommand={handleSlashCommand}
          onKeyDown={handleKeyDown}
          model={model}
          onModelChange={setModel}

        />
      </div>
      <TruthConsole events={agentEvents} loading={sending} />
    </div>
  );
}
