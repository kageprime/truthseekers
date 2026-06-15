"use client";

import { useRef, useEffect, useState } from "react";
import { IconChat, IconLightning, IconX } from "./Icons";

export interface AgentEvent {
  type: string;
  data: unknown;
  timestamp: number;
  label?: string;
}

interface ToolUseData {
  name?: string;
  args?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ToolResultData {
  result?: string;
  content?: string;
  [key: string]: unknown;
}

interface TextDelta {
  delta?: string;
  text?: string;
  [key: string]: unknown;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" });
}

export function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    firecrawl_search: "🔍 Web Search",
    tavilySearch: "🔍 Web Search",
    glob: "📁 File Search",
    grep: "🔎 Code Search",
    read: "📖 Read File",
    write: "✍️ Write File",
    edit: "📝 Edit File",
    bash: "💻 Shell",
    web_search: "🔍 Web Search",
    websearch: "🔍 Web Search",
    webfetch: "🌐 Fetch URL",
    get_article: "📖 Lookup Article",
    article_search: "📚 Search Articles",
    get_map: "🗺️ Lookup Map",
    generate_image: "🎨 Generate Image",
    verify_citation: "✅ Verify Citation",
    suggest_related: "🔗 Related Articles",
    render_blocks: "🎨 Render Content",
    create_article: "✨ Generate Article",
    task: "🤖 Sub-agent",
    mem_store: "💾 Remember",
    mem_recall: "🔍 Recall",
    think: "🧠 Thinking",
  };
  return labels[name] ?? `🔧 ${name}`;
}

function toolUseSummary(name: string, args: Record<string, unknown>): string {
  if (name === "web_search" || name === "websearch" || name === "tavilySearch" || name === "firecrawl_search") {
    return `"${args.query || ""}"`;
  }
  if (name === "get_article") {
    return `"${args.slug || ""}"`;
  }
  if (name === "render_blocks") {
    const count = args.blocks ? (Array.isArray(args.blocks) ? args.blocks.length : 0) : 0;
    return `${count} blocks`;
  }
  if (name === "create_article") {
    return `"${args.slug || ""}"`;
  }
  if (name === "article_search") {
    return `"${args.query || ""}"`;
  }
  if (name === "get_map") {
    return `"${args.slug || ""}"`;
  }
  if (name === "generate_image") {
    return `"${String(args.prompt || "").slice(0, 80)}"`;
  }
  if (name === "verify_citation") {
    return `"${String(args.claim || "").slice(0, 80)}"`;
  }
  if (name === "suggest_related") {
    return `"${args.slug || ""}"`;
  }
  if (name === "task") {
    return `"${String(args.objective || "").slice(0, 80)}"`;
  }
  if (name === "mem_store") {
    return `${args.key} = ${String(args.value || "").slice(0, 40)}`;
  }
  if (name === "mem_recall") {
    return `"${args.key || ""}"`;
  }
  const str = JSON.stringify(args);
  return str.length > 100 ? str.slice(0, 100) + "..." : str;
}

export function ToolUseCard({ data }: { data: ToolUseData }) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2.5 border-l-2 border-[#7dd3fc] rounded-r" style={{ background: "#f0f7ff" }}>
      <span className="text-xs shrink-0 mt-0.5">{toolLabel(data.name ?? "")}</span>
      <span className="text-[10px] leading-relaxed" style={{ color: "var(--muted)" }}>
        {toolUseSummary(data.name ?? "", data.args ?? {})}
      </span>
    </div>
  );
}

export function ToolResultCard({ data }: { data: ToolResultData }) {
  const content = data.result ?? data.content ?? "";
  let display = "";
  if (typeof content === "string" && (content.startsWith("[") || content.startsWith("{"))) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        display = `${parsed.length} results`;
      } else if (parsed.blockCount !== undefined) {
        display = `${parsed.blockCount} blocks rendered`;
      } else if (parsed.queued) {
        display = `Queued: ${parsed.slug}`;
      } else {
        display = content.length > 200 ? content.slice(0, 200) + "..." : content;
      }
    } catch {
      display = content.length > 200 ? content.slice(0, 200) + "..." : content;
    }
  } else {
    const str = typeof content === "string" ? content : JSON.stringify(content).slice(0, 200);
    display = str.length > 200 ? str.slice(0, 200) + "..." : str;
  }
  if (!display) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 px-2.5 border-l-2 border-[#d0d5dd] rounded-r" style={{ background: "#f6f8fa" }}>
      <span className="text-[10px] shrink-0 mt-0.5">📋</span>
      <span className="text-[10px] leading-relaxed" style={{ color: "#3c4043" }}>{display}</span>
    </div>
  );
}

export function TextDeltaCard({ data }: { data: TextDelta }) {
  const text = data.text ?? data.delta ?? "";
  const truncated = text.length > 300 ? text.slice(0, 300) + "..." : text;
  if (!truncated) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 px-2.5 border-l-2 border-[#fde68a] rounded-r" style={{ background: "#fff8e1" }}>
      <span className="shrink-0 mt-0.5"><IconChat size={12} /></span>
      <span className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#3c4043" }}>{truncated}</span>
    </div>
  );
}

function AgentActivityFeed({ events, compact }: { events: AgentEvent[]; compact?: boolean }) {
  if (events.length === 0) {
    return (
      <div className="text-[10px] text-center py-6" style={{ color: "var(--subtle)" }}>
        Waiting for agent activity...
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <div key={`${event.timestamp}-${i}`}>
          {!compact && (
            <div className="flex items-center gap-1.5 text-[9px] mb-1" style={{ color: "var(--subtle)" }}>
              <span>{formatTimestamp(event.timestamp)}</span>
              <span className="font-semibold uppercase text-[8px] px-1 border rounded" style={{ borderColor: "var(--border)" }}>{event.type}</span>
            </div>
          )}
          {event.type === "tool_use" && <ToolUseCard data={event.data as ToolUseData} />}
          {event.type === "tool_result" && <ToolResultCard data={event.data as ToolResultData} />}
          {event.type === "text" && <TextDeltaCard data={event.data as TextDelta} />}
          {event.type === "status" && (
            <div className="text-[10px] font-semibold py-1 px-2.5 rounded border-l-2 border-[var(--green)]" style={{ background: "#f0fdf4" }}>
              <IconLightning size={10} /> {String(event.data)}
            </div>
          )}
          {event.type === "error" && (
            <div className="text-[10px] font-semibold py-1 px-2.5 rounded border-l-2 border-[var(--red)]" style={{ background: "#fef2f2" }}>
              <IconX size={10} /> {String(event.data)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AgentActivityFullscreen({ open, onClose, events, scrollToIndex }: { open: boolean; onClose: () => void; events: AgentEvent[]; scrollToIndex?: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, events.length);
  }, [events.length]);

  useEffect(() => {
    if (scrollToIndex !== undefined && scrollRef.current && itemRefs.current[scrollToIndex]) {
      itemRefs.current[scrollToIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setAutoScroll(false);
    }
  }, [scrollToIndex, open]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-2 md:p-6" onClick={onClose}>
      <div
        className="glass-card-static p-4 md:p-5 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h3 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>AGENT ACTIVITY</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--subtle)" }}>
              {events.length} events
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] active:shadow-[1px_1px_0_#1c1917] transition-all text-xs"
            aria-label="Close fullscreen"
          >
            ✕
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0 border-2 border-black p-3 space-y-2"
          style={{ background: "#fafafa" }}
        >
          <div className="space-y-2">
            {events.map((event, i) => (
              <div key={`${event.timestamp}-${i}`} ref={(el) => { itemRefs.current[i] = el; }}>
                <div className="flex items-center gap-1.5 text-[9px] mb-1" style={{ color: "var(--subtle)" }}>
                  <span>{formatTimestamp(event.timestamp)}</span>
                  <span className="font-semibold uppercase text-[8px] px-1 border rounded" style={{ borderColor: "var(--border)" }}>{event.type}</span>
                </div>
                {event.type === "tool_use" && <ToolUseCard data={event.data as ToolUseData} />}
                {event.type === "tool_result" && <ToolResultCard data={event.data as ToolResultData} />}
                {event.type === "text" && <TextDeltaCard data={event.data as TextDelta} />}
                {event.type === "status" && (
                  <div className="text-[10px] font-semibold py-1 px-2.5 rounded border-l-2 border-[var(--green)]" style={{ background: "#f0fdf4" }}>
                    <IconLightning size={10} /> {String(event.data)}
                  </div>
                )}
                {event.type === "error" && (
                  <div className="text-[10px] font-semibold py-1 px-2.5 rounded border-l-2 border-[var(--red)]" style={{ background: "#fef2f2" }}>
                    <IconX size={10} /> {String(event.data)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 shrink-0">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="btn btn-secondary"
            style={{ fontSize: "8px", padding: "0.3rem 0.6rem", minHeight: "auto" }}
          >
            {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          </button>
          <span className="text-[9px]" style={{ color: "var(--subtle)" }}>
            {events.length} event{events.length !== 1 ? "s" : ""} · last {formatTimestamp(events[events.length - 1]?.timestamp ?? Date.now())}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Old inline ProcessViewer (kept as default export for backward compat, but collapses by default) ── */
interface ProcessViewerProps {
  events: AgentEvent[];
  maxVisible?: number;
}

export default function ProcessViewer({ events, maxVisible = 50 }: ProcessViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const visible = events.slice(-maxVisible);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  return (
    <>
      {fullscreen && (
        <AgentActivityFullscreen open={fullscreen} onClose={() => setFullscreen(false)} events={events} />
      )}
      <div className="border-2 border-black px-3 py-2.5" style={{ background: "white" }}>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[9px] font-semibold flex items-center gap-1.5 px-1 py-0.5 hover:bg-[var(--hover)] rounded transition-colors"
            style={{ color: "var(--muted)" }}
          >
            <span className="inline-block w-2 text-[8px]">{collapsed ? "▶" : "▼"}</span>
            Agent Activity
            <span className="text-[8px] ml-0.5 px-1.5 py-0.5 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--subtle)" }}>
              {events.length}
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="text-[9px] px-1.5 py-0.5 rounded hover:bg-[var(--hover)] transition-colors"
              style={{ color: autoScroll ? "var(--blue)" : "#aaa", fontWeight: autoScroll ? 600 : 400 }}
            >
              {autoScroll ? "Auto" : "Manual"}
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--hover)] transition-colors text-xs"
              style={{ color: "var(--subtle)" }}
              aria-label="Fullscreen agent activity"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              </svg>
            </button>
          </div>
        </div>
        {!collapsed && (
          <div
            ref={scrollRef}
            className="overflow-y-auto space-y-1"
            style={{ maxHeight: "240px" }}
            onScroll={() => {
              if (scrollRef.current) {
                const el = scrollRef.current;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
                if (atBottom !== autoScroll) setAutoScroll(atBottom);
              }
            }}
          >
            {visible.length === 0 ? (
              <div className="text-[10px] text-center py-6" style={{ color: "var(--subtle)" }}>
                Waiting for agent activity...
              </div>
            ) : (
              visible.map((event, i) => (
                <div key={`${event.timestamp}-${i}`}>
                  <div className="flex items-center gap-1.5 text-[9px] mb-0.5" style={{ color: "var(--subtle)" }}>
                    <span>{formatTimestamp(event.timestamp)}</span>
                    <span className="font-semibold uppercase text-[8px] px-1 border" style={{ borderColor: "var(--border)" }}>{event.type}</span>
                  </div>
                  {event.type === "tool_use" && <ToolUseCard data={event.data as ToolUseData} />}
                  {event.type === "tool_result" && <ToolResultCard data={event.data as ToolResultData} />}
                  {event.type === "text" && <TextDeltaCard data={event.data as TextDelta} />}
                  {event.type === "status" && (
                    <div className="text-[10px] font-semibold py-0.5" style={{ color: "var(--green)" }}>
                      <IconLightning size={10} /> {String(event.data)}
                    </div>
                  )}
                  {event.type === "error" && (
                    <div className="text-[10px] font-semibold py-0.5" style={{ color: "var(--red)" }}>
                      <IconX size={10} /> {String(event.data)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
