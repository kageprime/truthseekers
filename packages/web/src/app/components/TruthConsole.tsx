"use client";

import { useRef, useEffect, useState } from "react";
import Spinner from "./Spinner";
import { IconChat, IconX } from "./Icons";
import SegmentPills from "./truth-console/SegmentPills";
import {
  toolIcon, toolLabel, toolColor, formatTime, argsDisplay, parseRichResult,
} from "./truth-console/registry";
import { LIVE_SEGMENT_ID, type AgentEvent, type TraceSegment } from "./truth-console/types";

// Re-export for any external consumers that imported AgentEvent from here.
export type { AgentEvent };

// ─── Rich result renderers ─────────────────────────────────────────

function SearchResults({ items }: { items: { title: string; snippet: string; url: string }[] }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="text-[10px] leading-relaxed px-2.5 py-2 rounded-lg cursor-pointer hover:bg-accent-bg/20 transition-colors" style={{ background: "color-mix(in srgb, var(--surface-elevated) 40%, transparent)" }}>
          <div className="flex items-start gap-1.5">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--subtle)", marginTop: 3, flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div className="min-w-0">
              <div className="font-medium text-ink truncate">{item.title}</div>
              <div className="text-muted line-clamp-2 mt-0.5">{item.snippet}</div>
              {item.url && <div className="text-[8px] text-subtle truncate mt-0.5 font-mono">{item.url}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageResult({ url, alt, prompt }: { url: string; alt: string; prompt?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg overflow-hidden border border-border bg-surface-elevated/30">
        <div className="aspect-video relative flex items-center justify-center bg-surface-elevated/50">
          {!loaded && <Spinner size={20} />}
          <img
            src={url}
            alt={alt}
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>
        {prompt && <div className="px-2 py-1.5 text-[9px] text-muted truncate border-t border-border">{prompt}</div>}
      </div>
    </div>
  );
}

function VerdictResult({ verdict, confidence }: { verdict: { label: string; supported: boolean; partial?: boolean }; confidence: number }) {
  const color = verdict.supported ? "var(--forest)" : verdict.partial ? "var(--gold)" : "var(--oxblood)";
  const bgColor = verdict.supported ? "var(--forest)" : verdict.partial ? "var(--gold)" : "var(--oxblood)";
  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, " + bgColor + " 10%, transparent)" }}>
        <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, " + bgColor + " 20%, transparent)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {verdict.supported ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
            {verdict.partial && <line x1="12" y1="6" x2="12" y2="18" />}
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color }}>{verdict.label}</span>
            <span className="text-[9px] text-muted">{Math.round(confidence * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, " + bgColor + " 15%, transparent)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${confidence * 100}%`, background: bgColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleResult({ title, slug, blockCount }: { title: string; slug?: string; blockCount?: number }) {
  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--gold-bg) 30%, transparent)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-ink truncate">{title}</div>
          {blockCount !== undefined && <div className="text-[9px] text-muted">{blockCount} blocks</div>}
        </div>
        {slug && <span className="text-[9px] text-accent shrink-0">Open →</span>}
      </div>
    </div>
  );
}

function FetchResult({ url, content }: { url?: string; content?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-3 pb-3">
      {url && <div className="text-[9px] font-mono text-subtle truncate mb-1.5">{url}</div>}
      {content && (
        <>
          <div className={`text-[10px] text-muted leading-relaxed whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}>
            {content}
          </div>
          <button onClick={() => setExpanded((o) => !o)} className="text-[9px] text-accent hover:underline mt-1">
            {expanded ? "Show less" : "Read full page"}
          </button>
        </>
      )}
    </div>
  );
}

function GenericResult({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="px-3 pb-3">
      <div className="text-[10px] text-muted leading-relaxed">{text}</div>
    </div>
  );
}

// ─── Event entry ───────────────────────────────────────────────────

function EventEntry({ event, nextEvent }: { event: AgentEvent; nextEvent?: AgentEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isToolUse = event.type === "tool_use";
  const isToolResult = event.type === "tool_result";

  // Collapse tool_result into preceding tool_use
  if (isToolResult) return null;

  const data = event.data as Record<string, unknown>;

  if (isToolUse) {
    const name = (data.name as string) || "";
    const args = (data.args as Record<string, unknown>) || {};
    const hasResult = nextEvent?.type === "tool_result";
    const resultData = hasResult ? (nextEvent!.data as Record<string, unknown>) : null;
    const rawResult = resultData ? (resultData.result ?? resultData.content ?? "") : null;
    const rich = rawResult ? parseRichResult(name, rawResult) : null;

    return (
      <div className="border-b" style={{ borderColor: "var(--border)" }}>
        {/* Header row */}
        <button
          onClick={() => rich && setExpanded((o) => !o)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${rich ? "hover:bg-accent-bg/10 cursor-pointer" : "cursor-default"}`}
        >
          <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: toolColor(name) + "18", color: toolColor(name) }}>
            {toolIcon(name, 14)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-ink">{toolLabel(name)}</span>
              {!hasResult && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">{argsDisplay(name, args)}</div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[9px] text-subtle">{formatTime(event.timestamp)}</span>
            {rich && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-subtle transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </div>
        </button>

        {/* Result area */}
        {rich && expanded && (
          <div className="border-t" style={{ borderColor: "color-mix(in srgb, var(--border) 40%, transparent)" }}>
            {rich.kind === "search" && <SearchResults items={rich.items!} />}
            {rich.kind === "image" && <ImageResult url={rich.imageUrl!} alt={rich.imageAlt!} prompt={argsDisplay("generate_image", args)} />}
            {rich.kind === "verdict" && <VerdictResult verdict={rich.verdict!} confidence={rich.confidence!} />}
            {rich.kind === "article" && <ArticleResult title={rich.articleTitle!} slug={rich.articleSlug} blockCount={rich.blockCount} />}
            {rich.kind === "fetch" && <FetchResult url={rich.url} content={rich.contentPreview} />}
            {rich.kind === "generic" && <GenericResult text={rich.text} />}
          </div>
        )}
      </div>
    );
  }

  // Text / thinking
  if (event.type === "text") {
    const text = ((data.text ?? data.delta ?? "") as string);
    if (!text) return null;
    return (
      <div className="flex items-start gap-2 px-3 py-1.5">
        <span className="shrink-0 mt-0.5" style={{ color: "var(--muted)" }}><IconChat size={9} /></span>
        <span className="text-[10px] text-muted leading-relaxed">{text}</span>
      </div>
    );
  }

  // Status
  if (event.type === "status") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />
        <span className="text-[10px] font-medium text-ink">{String(event.data)}</span>
      </div>
    );
  }

  // Error
  if (event.type === "error") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--oxblood) 10%, transparent)" }}>
        <IconX size={10} style={{ color: "var(--oxblood)", flexShrink: 0 }} />
        <span className="text-[10px]" style={{ color: "var(--oxblood)" }}>{String(event.data)}</span>
      </div>
    );
  }

  return null;
}

// ─── Main component ──────────────────────────────────────────────

export interface TruthConsoleProps {
  segments: TraceSegment[];
  activeSegmentId: string | null;
  liveSegmentId: string | null;
  unreadCount: number;
  activeEvents: AgentEvent[];
  onSelectSegment: (id: string) => void;
  onJumpToLive: () => void;
  onClose?: () => void;
  loading?: boolean;
}

export default function TruthConsole({
  segments, activeSegmentId, liveSegmentId, unreadCount, activeEvents,
  onSelectSegment, onJumpToLive, onClose, loading,
}: TruthConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const isOnLive = activeSegmentId === LIVE_SEGMENT_ID;
  const showJumpToLive = liveSegmentId && !isOnLive;

  // Autoscroll pins to bottom ONLY while viewing the live segment.
  useEffect(() => {
    if (isOnLive && autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeEvents.length, isOnLive, autoScroll]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <style>{`.tc-scroll::-webkit-scrollbar { width: 4px; } .tc-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--border) 40%, transparent); border-radius: 2px; } .tc-scroll::-webkit-scrollbar-track { background: transparent; }`}</style>

      {/* Title row */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <span className="text-xs font-medium text-ink">Agent</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full text-subtle" style={{ background: "color-mix(in srgb, var(--border) 40%, transparent)" }}>{activeEvents.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {showJumpToLive ? (
            <button
              onClick={onJumpToLive}
              className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors"
              style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }}
              title="Jump to the live response"
            >
              <span className="relative flex items-center justify-center w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full animate-pulse-ring" style={{ background: "var(--accent)" }} />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              </span>
              Jump to Live{unreadCount > 0 && <span className="ml-0.5">({unreadCount})</span>}
            </button>
          ) : (
            <button onClick={() => setAutoScroll(!autoScroll)} className="text-[9px] px-1.5 py-0.5 rounded transition-colors" style={{ color: autoScroll ? "var(--accent)" : "var(--subtle)" }}>Auto</button>
          )}
          {onClose && <button onClick={onClose} className="btn-ghost p-1" aria-label="Close"><IconX size={12} /></button>}
        </div>
      </div>

      {/* Segment pills */}
      <SegmentPills segments={segments} activeSegmentId={activeSegmentId} onSelect={onSelectSegment} />

      {/* Event feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 py-1 space-y-1 tc-scroll">
        {!loading && activeEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--subtle)", opacity: 0.4 }}>
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p className="text-[10px] text-subtle mt-2">Idle</p>
            <p className="text-[9px] text-subtle opacity-50 mt-0.5">Tool calls appear while the agent works</p>
          </div>
        )}
        {activeEvents.map((event, i) => (
          <EventEntry key={`${event.timestamp}-${i}`} event={event} nextEvent={activeEvents[i + 1]} />
        ))}
        {loading && activeEvents.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Spinner size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
