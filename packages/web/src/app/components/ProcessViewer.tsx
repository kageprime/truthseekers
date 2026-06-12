"use client";

import { useRef, useEffect, useState } from "react";

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

interface ProcessViewerProps {
  events: AgentEvent[];
  maxVisible?: number;
}

const MAX_VISIBLE_TOOL_ARGS = 150;

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" });
}

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    firecrawl_search: "🔍 Web Search",
    glob: "📁 File Search",
    grep: "🔎 Code Search",
    read: "📖 Read File",
    write: "✍️ Write File",
    edit: "📝 Edit File",
    bash: "💻 Shell",
    websearch: "🔍 Web Search",
    webfetch: "🌐 Fetch URL",
    task: "🤖 Sub-agent",
    think: "🧠 Thinking",
  };
  return labels[name] ?? `🔧 ${name}`;
}

function ToolUseCard({ data }: { data: ToolUseData }) {
  const argsStr = JSON.stringify(data.args ?? {});
  const truncated = argsStr.length > MAX_VISIBLE_TOOL_ARGS ? argsStr.slice(0, MAX_VISIBLE_TOOL_ARGS) + "..." : argsStr;

  return (
    <div className="flex items-start gap-2 text-xs py-1 px-2 rounded" style={{ background: "#f0f7ff" }}>
      <span className="shrink-0 mt-0.5">{toolLabel(data.name ?? "")}</span>
      <code className="text-[10px] leading-relaxed break-all" style={{ color: "#5f6368" }}>
        {truncated}
      </code>
    </div>
  );
}

function ToolResultCard({ data }: { data: ToolResultData }) {
  const content = data.result ?? data.content ?? "";
  const str = typeof content === "string" ? content : JSON.stringify(content).slice(0, 200);
  const truncated = str.length > 200 ? str.slice(0, 200) + "..." : str;

  return (
    <div className="flex items-start gap-2 text-xs py-1 px-2 rounded" style={{ background: "#f6f8fa" }}>
      <span className="shrink-0 mt-0.5">📋</span>
      <code className="text-[10px] leading-relaxed break-all whitespace-pre-wrap" style={{ color: "#3c4043" }}>
        {truncated}
      </code>
    </div>
  );
}

function TextDeltaCard({ data }: { data: TextDelta }) {
  const text = data.text ?? data.delta ?? "";
  const truncated = text.length > 300 ? text.slice(0, 300) + "..." : text;
  if (!truncated) return null;

  return (
    <div className="flex items-start gap-2 text-xs py-1 px-2 rounded" style={{ background: "#fff8e1" }}>
      <span className="shrink-0 mt-0.5">💬</span>
      <span className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#3c4043" }}>
        {truncated}
      </span>
    </div>
  );
}

export default function ProcessViewer({ events, maxVisible = 50 }: ProcessViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const visible = events.slice(-maxVisible);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  return (
    <div className="mt-3 border-t border-dashed border-[#e0e0e0] pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="pixel text-[9px] font-semibold" style={{ color: "#5f6368" }}>
          AGENT ACTIVITY ({events.length})
        </span>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="btn-ghost"
          style={{ color: autoScroll ? "var(--blue)" : "#aaa", fontWeight: autoScroll ? 600 : 400, fontSize: "10px" }}
        >
          {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto space-y-1 rounded border p-2"
        style={{ background: "#fafafa", borderColor: "#e0e0e0" }}
        onScroll={() => {
          if (scrollRef.current) {
            const el = scrollRef.current;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
            if (atBottom !== autoScroll) setAutoScroll(atBottom);
          }
        }}
      >
        {visible.length === 0 ? (
          <div className="text-[10px] text-center py-4" style={{ color: "#9aa0a6" }}>
            Waiting for agent activity...
          </div>
        ) : (
          visible.map((event, i) => (
            <div key={`${event.timestamp}-${i}`} className="group">
              <div className="flex items-center gap-1 text-[9px] mb-0.5" style={{ color: "#9aa0a6" }}>
                <span>{formatTimestamp(event.timestamp)}</span>
                <span className="font-semibold uppercase">{event.type}</span>
              </div>
              {event.type === "tool_use" && <ToolUseCard data={event.data as ToolUseData} />}
              {event.type === "tool_result" && <ToolResultCard data={event.data as ToolResultData} />}
              {event.type === "text" && <TextDeltaCard data={event.data as TextDelta} />}
              {event.type === "status" && (
                <div className="text-[10px] font-semibold py-0.5" style={{ color: "var(--green)" }}>
                  ⚡ {String(event.data)}
                </div>
              )}
              {event.type === "error" && (
                <div className="text-[10px] font-semibold py-0.5" style={{ color: "var(--red)" }}>
                  ❌ {String(event.data)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
