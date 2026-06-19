"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { IconSearch, IconGlobe, IconBook, IconMap, IconImage, IconCheck, IconLink, IconPlus, IconDatabase, IconLightning, IconChat, IconX, IconUser } from "./Icons";
import type { AgentEvent } from "./ProcessViewer";
import { formatTimestamp } from "./ProcessViewer";

const TOOL_ICONS: Record<string, (size?: number) => React.ReactNode> = {
  web_search: (s) => <IconSearch size={s ?? 14} />,
  websearch: (s) => <IconSearch size={s ?? 14} />,
  tavilySearch: (s) => <IconSearch size={s ?? 14} />,
  firecrawl_search: (s) => <IconSearch size={s ?? 14} />,
  webfetch: (s) => <IconGlobe size={s ?? 14} />,
  get_article: (s) => <IconBook size={s ?? 14} />,
  article_search: (s) => <IconBook size={s ?? 14} />,
  get_map: (s) => <IconMap size={s ?? 14} />,
  generate_image: (s) => <IconImage size={s ?? 14} />,
  verify_citation: (s) => <IconCheck size={s ?? 14} />,
  suggest_related: (s) => <IconLink size={s ?? 14} />,
  render_blocks: (s) => (
    <svg width={s ?? 14} height={s ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  create_article: (s) => <IconPlus size={s ?? 14} />,
  task: (s) => <IconLightning size={s ?? 14} />,
  mem_store: (s) => <IconDatabase size={s ?? 14} />,
  mem_recall: (s) => <IconDatabase size={s ?? 14} />,
  think: (s) => <IconChat size={s ?? 14} />,
};

const TOOL_LABELS: Record<string, string> = {
  firecrawl_search: "Web Search",
  tavilySearch: "Web Search",
  glob: "File Search",
  grep: "Code Search",
  read: "Read File",
  write: "Write File",
  edit: "Edit File",
  bash: "Shell",
  web_search: "Web Search",
  websearch: "Web Search",
  webfetch: "Fetch URL",
  get_article: "Lookup Article",
  article_search: "Search Articles",
  get_map: "Lookup Map",
  generate_image: "Generate Image",
  verify_citation: "Verify Citation",
  suggest_related: "Related Articles",
  render_blocks: "Render Content",
  create_article: "Generate Article",
  task: "Sub-agent",
  mem_store: "Remember",
  mem_recall: "Recall",
  think: "Thinking",
};

function toolIcon(name: string, size?: number): React.ReactNode {
  return TOOL_ICONS[name]?.(size) ?? <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

function argsSummary(name: string, args: Record<string, unknown>): string {
  if (name === "web_search" || name === "websearch" || name === "tavilySearch" || name === "firecrawl_search") return String(args.query ?? "");
  if (name === "get_article" || name === "get_map" || name === "suggest_related" || name === "create_article") return String(args.slug ?? "");
  if (name === "webfetch") return String(args.url ?? "");
  if (name === "render_blocks") return `${(Array.isArray(args.blocks) ? args.blocks.length : 0)} blocks`;
  if (name === "article_search") return String(args.query ?? "");
  if (name === "generate_image") return String(args.prompt ?? "").slice(0, 80);
  if (name === "verify_citation") return String(args.claim ?? "").slice(0, 80);
  if (name === "task") return String(args.objective ?? args.task ?? "").slice(0, 80);
  if (name === "mem_store") return `${args.key} = ${String(args.value ?? "").slice(0, 40)}`;
  if (name === "mem_recall") return String(args.key ?? "");
  return JSON.stringify(args).slice(0, 100);
}

function ToolUseMini({ data }: { data: Record<string, unknown> }) {
  const name = (data.name as string) ?? "";
  const args = (data.args as Record<string, unknown>) ?? {};
  return (
    <div className="flex items-start gap-2 py-1.5 px-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent-bg) 60%, transparent)" }}>
      <span className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }}>{toolIcon(name)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--ink)" }}>{toolLabel(name)}</span>
          <span className="text-[10px] truncate" style={{ color: "var(--muted)" }}>{argsSummary(name, args)}</span>
        </div>
      </div>
    </div>
  );
}

function ToolResultMini({ data }: { data: Record<string, unknown> }) {
  const content = (data.result ?? data.content ?? "") as string;
  let display = "";
  if (typeof content === "string") {
    if (content.startsWith("[") || content.startsWith("{")) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) display = `${parsed.length} results`;
        else if (parsed.blockCount !== undefined) display = `${parsed.blockCount} blocks rendered`;
        else if (parsed.queued) display = `Queued: ${parsed.slug}`;
        else display = content.slice(0, 200);
      } catch { display = content.slice(0, 200); }
    } else {
      display = content.slice(0, 200);
    }
  } else {
    display = JSON.stringify(content).slice(0, 200);
  }
  if (!display) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 px-3 ml-5 rounded-lg border-l" style={{ borderColor: "color-mix(in srgb, var(--border) 40%, transparent)", background: "color-mix(in srgb, var(--surface) 50%, transparent)" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" style={{ color: "var(--subtle)" }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>{display}</span>
    </div>
  );
}

function TextDeltaMini({ data }: { data: Record<string, unknown> }) {
  const text = (data.text ?? data.delta ?? "") as string;
  if (!text) return null;
  const truncated = text.length > 120 ? text.slice(0, 120) + "..." : text;
  return (
    <div className="flex items-start gap-2 py-1.5 px-3 ml-5 rounded-lg border-l" style={{ borderColor: "color-mix(in srgb, var(--yellow) 40%, transparent)", background: "color-mix(in srgb, #fffef5 50%, transparent)" }}>
      <span className="shrink-0 mt-0.5" style={{ color: "var(--muted)" }}><IconChat size={12} /></span>
      <span className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{truncated}</span>
    </div>
  );
}

export default function TruthConsole({ events, onClose, loading }: { events: AgentEvent[]; onClose?: () => void; loading?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  return (
    <div className="flex flex-col min-h-0 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:max-h-[85vh] max-md:rounded-t-2xl max-md:overflow-hidden max-md:shadow-2xl"
      style={{ background: "var(--surface)", borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}>
      <div className="max-md:bg-black/30 max-md:absolute max-md:inset-0 max-md:-top-[100vh]" onClick={onClose ? () => onClose() : undefined} />
      <div className="flex flex-col min-h-0 max-md:relative">
      <style>{`.tc-scroll::-webkit-scrollbar { width: 4px; } .tc-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--border) 40%, transparent); border-radius: 2px; } .tc-scroll::-webkit-scrollbar-track { background: transparent; }`}</style>

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b max-md:pt-4" style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}>
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs font-medium" style={{ color: "var(--ink)" }}>Console</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--border) 30%, transparent)", color: "var(--subtle)" }}>
            {events.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ color: autoScroll ? "var(--accent)" : "var(--subtle)" }}
          >
            Auto
          </button>
          <Link href="/settings" className="btn-icon btn-ghost max-md:hidden" aria-label="Settings" style={{ width: 26, height: 26, minHeight: 26 }}>
            <IconUser size={13} />
          </Link>
          {onClose && <button onClick={onClose} className="btn-icon btn-ghost" aria-label="Close console" style={{ width: 26, height: 26, minHeight: 26 }}>
            <IconX size={13} />
          </button>}
        </div>
      </div>

      {/* Event feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-2 py-2 space-y-1 tc-scroll">
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--subtle)", opacity: 0.3 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-xs mt-2" style={{ color: "var(--subtle)" }}>No agent activity yet</p>
            <p className="text-[10px]" style={{ color: "var(--subtle)", opacity: 0.5 }}>Events appear while the agent works</p>
          </div>
        )}
        {events.map((event, i) => (
          <div key={`${event.timestamp}-${i}`}>
            <div className="flex items-center gap-1.5 text-[9px] mb-0.5 px-1" style={{ color: "var(--subtle)" }}>
              <span>{formatTimestamp(event.timestamp)}</span>
              <span className="font-semibold uppercase text-[7px] px-1 rounded" style={{ background: "color-mix(in srgb, var(--accent-bg) 40%, transparent)", color: "var(--muted)" }}>{event.type}</span>
            </div>
            {event.type === "tool_use" && <ToolUseMini data={event.data as Record<string, unknown>} />}
            {event.type === "tool_result" && <ToolResultMini data={event.data as Record<string, unknown>} />}
            {event.type === "text" && <TextDeltaMini data={event.data as Record<string, unknown>} />}
            {event.type === "status" && (
              <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: "color-mix(in srgb, #f0fdf4 50%, transparent)" }}>
                <IconLightning size={12} style={{ color: "var(--green)" }} />
                <span className="text-[11px] font-medium" style={{ color: "var(--ink)" }}>{String(event.data)}</span>
              </div>
            )}
            {event.type === "error" && (
              <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: "color-mix(in srgb, #fef2f2 50%, transparent)" }}>
                <IconX size={12} style={{ color: "var(--red)" }} />
                <span className="text-[11px] font-medium" style={{ color: "var(--red)" }}>{String(event.data)}</span>
              </div>
            )}
          </div>
        ))}
        {loading && events.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "color-mix(in srgb, var(--border) 40%, transparent)", borderTopColor: "var(--accent)" }} />
          </div>
        )}
      </div>

      {/* Footer */}
      {events.length > 0 && (
        <div className="shrink-0 border-t px-4 py-2 flex items-center justify-between" style={{ borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}>
          <span className="text-[9px]" style={{ color: "var(--subtle)" }}>
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[9px]" style={{ color: "var(--subtle)" }}>
            {formatTimestamp(events[events.length - 1]?.timestamp ?? Date.now())}
          </span>
        </div>
      )}
    </div>
    </div>
  );
}
