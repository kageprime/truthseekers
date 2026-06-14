"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import Link from "next/link";
import { fetchChat } from "@/lib/api";
import type { ConversationDetail } from "@/lib/api";
import PageLayout from "../../components/PageLayout";
import MessageList from "../../components/MessageList";
import ChatInput from "../../components/ChatInput";
import type { AgentEvent } from "../../components/ProcessViewer";
import { useChatStream } from "../../hooks/useChatStream";

const SLASH_COMMANDS = [
  { id: "search", label: "Search the web", description: "/search <query>", icon: "🔍" },
  { id: "article", label: "Look up an article", description: "/article <slug>", icon: "📖" },
  { id: "map", label: "Show a map", description: "/map <location>", icon: "🗺️" },
  { id: "generate", label: "Generate an article", description: "/generate <topic>", icon: "✨" },
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

const chatCache = new Map<string, ConversationDetail>();

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ConversationDetail | null>(chatCache.get(id) ?? null);
  const [loading, setLoading] = useState(!chatCache.has(id));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<any[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [lastAgentEvents, setLastAgentEvents] = useState<AgentEvent[]>([]);
  const agentEventsRef = useRef<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [phaseLabel, setPhaseLabel] = useState("Thinking...");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const lastMessageRef = useRef("");
  const autoSentRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { send: streamSend, stop: streamStop } = useChatStream();

  useEffect(() => {
    setLoading(true);
    fetchChat(id).then((d) => {
      if (d) chatCache.set(id, d);
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

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
    setData((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, messages: [...prev.messages, { id: tempId, conversationId: id, role: "user" as const, content: msg, createdAt: new Date().toISOString() }] };
      chatCache.set(id, updated);
      return updated;
    });

    await streamSend(id, msg, {
      onText: (text) => setStreamContent(text),
      onToolEvent: (event) => {
        setAgentEvents((prev) => {
          const next = [...prev, event];
          agentEventsRef.current = next;
          return next;
        });
        // Extract blocks from render_blocks tool calls
        if (event.type === "tool_use") {
          const d = event.data as Record<string, unknown> | undefined;
          if (d?.name === "render_blocks") {
            const args = d.args as Record<string, unknown> | undefined;
            if (args?.blocks && Array.isArray(args.blocks)) {
              setStreamBlocks(args.blocks);
            }
          }
        }
      },
      onDone: (event) => {
        setLastAgentEvents(agentEventsRef.current);
        setStreamContent("");
        setStreamBlocks(event.blocks || []);
        setFollowUps(generateFollowUps(lastMessageRef.current));
        setData((prev) => {
          if (!prev) return prev;
          const real = prev.messages.filter((m) => !m.id.startsWith("temp-"));
          const updated = { ...prev, messages: [...real, { id: event.msgId!, conversationId: id, role: "assistant" as const, content: event.content || "", blocks: event.blocks, createdAt: new Date().toISOString() }] };
          chatCache.set(id, updated);
          return updated;
        });
      },
      onError: (errMsg) => setError(errMsg),
    });

    setSending(false);
  }, [id, streamSend]);

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
      setData({ ...data, messages: newMessages });
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
      <PageLayout sidebar sidebarDefaultOpen activeId={id} noFooter>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-8 h-8 rounded-full border-3 animate-spin" style={{ borderColor: "#e0e0e0", borderTopColor: "var(--orange)" }} />
          <p className="text-sm" style={{ color: "#9aa0a6" }}>Loading conversation...</p>
        </div>
      </PageLayout>
    );
  }

  if (!data) {
    return (
      <PageLayout sidebar sidebarDefaultOpen activeId={id} noFooter>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm mb-4" style={{ color: "#9aa0a6" }}>Conversation not found</p>
            <Link href="/chat" className="btn-primary btn-sm">Back to Chat</Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout sidebar sidebarDefaultOpen activeId={id} noFooter>
      <div className="flex-1 flex flex-col min-h-0 chat-enter">
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
            lastAgentEvents={lastAgentEvents}
            lastAssistantIndex={lastAssistantIndex}
          suggestedTopics={suggestedTopics}
          scrollRef={scrollRef}
          onScrollToBottom={scrollToBottom}
          onRegenerate={handleRegenerate}
          onEdit={handleEdit}
          onCopy={(content) => navigator.clipboard.writeText(content)}
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
        />
      </div>
    </PageLayout>
  );
}
