"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PhaseTimeline from "./PhaseTimeline";
import type { AgentEvent } from "./ProcessViewer";
import { IconLightning, IconClipboard, IconChat, IconX, IconCheckCircle, IconAlert } from "./Icons";

export interface GeneratingEntry {
  slug: string;
  title: string;
  phase: string;
  error?: string;
  agentEvents?: AgentEvent[];
}

import type { FC, SVGProps } from "react";

interface Activity {
  id: number;
  timestamp: number;
  type: string;
  content: string;
  icon: string | FC<SVGProps<SVGSVGElement> & { size?: number }>;
  metadata?: string;
}

function eventToActivity(event: AgentEvent, id: number): Activity {
  const base = { id, timestamp: event.timestamp };
  switch (event.type) {
    case "status":
      return { ...base, type: "status", content: String(event.data), icon: IconLightning };
    case "tool_use": {
      const d = event.data as Record<string, unknown> | undefined;
      const name = (d?.name as string) ?? "unknown";
      const args = d?.args as Record<string, unknown> | undefined;
      return { ...base, type: "tool_use", content: toolLabel(name), icon: toolIcon(name), metadata: args ? JSON.stringify(args).slice(0, 120) : undefined };
    }
    case "tool_result": {
      const d = event.data as Record<string, unknown> | undefined;
      const result = (d?.result ?? d?.content ?? "") as string;
      const snippet = typeof result === "string" ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200);
      return { ...base, type: "tool_result", content: snippet || "Done", icon: IconClipboard };
    }
    case "text": {
      const d = event.data as Record<string, unknown> | undefined;
      const text = (d?.text ?? d?.delta ?? "") as string;
      return { ...base, type: "text", content: text.slice(0, 300), icon: IconChat };
    }
    case "error":
      return { ...base, type: "error", content: String(event.data), icon: IconX };
    default:
      return { ...base, type: event.type, content: String(event.data), icon: "•" };
  }
}

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    firecrawl_search: "Searching the web", websearch: "Searching the web", webfetch: "Fetching a page",
    read: "Reading a file", write: "Writing content", edit: "Editing content",
    glob: "Searching files", grep: "Searching code", bash: "Running a command",
    web_search: "Searching the web", article_search: "Searching articles",
    get_article: "Looking up article", get_map: "Looking up map",
    generate_image: "Generating image", verify_citation: "Verifying citation",
    suggest_related: "Finding related", render_blocks: "Rendering content",
    create_article: "Generating article", task: "Spawning sub-agent",
    mem_store: "Remembering", mem_recall: "Recalling",
    think: "Thinking",
  };
  return labels[name] ?? `Using ${name}`;
}

function toolIcon(name: string): string {
  const icons: Record<string, string> = {
    firecrawl_search: "🔍", websearch: "🔍", webfetch: "🌐", read: "📖",
    write: "✍️", edit: "📝", glob: "📁", grep: "🔎", bash: "💻",
    web_search: "🔍", article_search: "📚",
    get_article: "📖", get_map: "🗺️",
    generate_image: "🎨", verify_citation: "✅",
    suggest_related: "🔗", render_blocks: "🎨",
    create_article: "✨", task: "🤖",
    mem_store: "💾", mem_recall: "🔍",
    think: "🧠",
  };
  return icons[name] ?? "•";
}

const PHASE_CHECKPOINTS: Record<string, number> = {
  queued: 5, starting: 5, research: 20, researching: 20, outline: 40,
  write: 60, writing: 60, verify: 75, verifying: 75, correcting: 80,
  "generate-media": 90, media: 90, "generating-images": 93, store: 95, storing: 95,
  complete: 100, done: 100, error: 0,
};

function phasePercent(phase: string): number {
  return PHASE_CHECKPOINTS[phase] ?? 10;
}

function phaseLabel(phase: string): string {
  const m: Record<string, string> = {
    queued: "QUEUED", researching: "RESEARCHING", outline: "OUTLINING",
    write: "WRITING", verifying: "VERIFYING", correcting: "CORRECTING",
    media: "GENERATING MEDIA", storing: "STORING", complete: "DONE", done: "DONE", error: "ERROR",
  };
  return m[phase] ?? phase.toUpperCase();
}

function nextCheckpoint(current: string): number {
  const order = ["queued", "researching", "outline", "write", "verifying", "media", "storing"];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return 99;
  return PHASE_CHECKPOINTS[order[idx + 1]];
}

export { phasePercent, phaseLabel };

export default function GenerationBar({
  entry,
  onRetry,
  onDismiss,
  showWatchLive = true,
}: {
  entry: GeneratingEntry;
  onRetry: (slug: string) => void;
  onDismiss: (slug: string) => void;
  showWatchLive?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [smoothPct, setSmoothPct] = useState(5);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const targetPct = phasePercent(entry.phase);
  const label = phaseLabel(entry.phase);
  const isDone = entry.phase === "done" || entry.phase === "complete";
  const isError = entry.phase === "error";

  const activities = (entry.agentEvents ?? []).map((e, i) => eventToActivity(e, i));

  // Auto-expand when generation starts
  useEffect(() => {
    if (entry.phase !== "done" && entry.phase !== "error" && entry.phase !== "queued") {
      setExpanded(true);
    }
  }, [entry.phase]);

  // Smooth animation: creep toward target between checkpoints
  useEffect(() => {
    setSmoothPct((prev) => (targetPct > prev ? targetPct : prev));

    const creepTarget = nextCheckpoint(entry.phase);
    const startTime = Date.now();
    const startPct = targetPct;

    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const duration = 8000;
      const progress = Math.min(elapsed / duration, 1);
      const current = startPct + (creepTarget - startPct) * progress;
      setSmoothPct(Math.min(current, 99));
      if (progress < 1 && entry.phase !== "done" && entry.phase !== "error") {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [entry.phase, targetPct]);

  useEffect(() => { if (isDone) setSmoothPct(100); }, [isDone]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities.length, autoScroll]);

  const displayPct = isDone ? 100 : Math.round(smoothPct);
  const barColor = isDone ? "var(--green)" : isError ? "var(--red)" : "var(--accent)";
  const StatusIcon = isDone ? IconCheckCircle : isError ? IconAlert : IconLightning;

  return (
    <div className="glass-card-static" style={{ transition: "all 0.2s ease-out" }}>
      {/* Minimized header bar */}
      <div
        className="p-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="shrink-0">{typeof StatusIcon === "function" ? <StatusIcon size={20} /> : StatusIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm truncate">{entry.title}</span>
            <span className="text-xs font-semibold sm:text-[9px] shrink-0 ml-2" style={{ color: barColor }}>
              {isDone ? "DONE" : isError ? "ERROR" : `${label} ${displayPct}%`}
            </span>
          </div>
          <div className="w-full h-2 border border-black bg-white overflow-hidden">
            <div className="h-full" style={{ width: `${displayPct}%`, background: barColor, transition: "width 0.3s linear" }} />
          </div>
        </div>
        {isDone && (
          <Link href={`/article/${entry.slug}`} className="btn btn-primary btn btn-sm shrink-0" data-color="green" onClick={(e) => e.stopPropagation()}>VIEW</Link>
        )}
        {isError && (
          <button onClick={(e) => { e.stopPropagation(); onRetry(entry.slug); }} className="btn btn-primary btn btn-sm shrink-0" data-color="red">RETRY</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDismiss(entry.slug); }} className="btn-ghost shrink-0" style={{ minWidth: "44px", minHeight: "44px" }} title="Dismiss">✕</button>
      </div>

      {/* Expanded live view */}
      {expanded && (
        <div className="border-t-2" style={{ borderColor: "var(--border)" }}>
          {/* Phase Timeline */}
          <div className="px-4 pt-3 pb-2">
            <PhaseTimeline currentPhase={entry.phase} />
          </div>

          {/* Activity Feed */}
          {!isDone && !isError && (
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium font-semibold" style={{ color: "var(--muted)" }}>
                  LIVE ACTIVITY ({activities.length})
                </span>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="btn-ghost"
                  style={{ color: autoScroll ? "var(--blue)" : "#aaa", fontWeight: autoScroll ? 600 : 400, fontSize: "7px" }}
                >
                  {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                </button>
              </div>
              <div
                ref={scrollRef}
                className="activity-feed-inline"
                onScroll={() => {
                  if (!scrollRef.current) return;
                  const el = scrollRef.current;
                  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
                  if (atBottom !== autoScroll) setAutoScroll(atBottom);
                }}
              >
                {activities.length === 0 && (
                  <div className="activity-empty">
                    <div className="empty-pulse" />
                    <p>Waiting for agent activity...</p>
                  </div>
                )}
                {activities.map((a) => (
                  <div key={a.id} className={`activity-card ${a.type}`}>
                    <div className="activity-icon">{typeof a.icon === "function" ? <a.icon size={14} /> : a.icon}</div>
                    <div className="activity-body">
                      <div className="activity-content">{a.content}</div>
                      {a.metadata && <div className="activity-meta"><code>{a.metadata}</code></div>}
                    </div>
                    <div className="activity-time">
                      {new Date(a.timestamp).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error detail */}
          {isError && (
            <div className="px-4 pb-4 pt-2">
              <p className="text-xs text-[var(--red)] mb-2">{entry.error || "Unknown error"}</p>
              <button onClick={() => onRetry(entry.slug)} className="btn btn-primary btn btn-sm" data-color="red">RETRY GENERATION</button>
            </div>
          )}

          {/* Done celebration */}
          {isDone && (
            <div className="done-banner-inline">
              <div className="done-icon">🎉</div>
              <h2>Article Complete</h2>
              <p>The encyclopedia has a new entry on <strong>{entry.title}</strong>.</p>
              <div className="done-actions">
                <Link href={`/article/${entry.slug}`} className="btn btn-primary">Read Article</Link>
                <button onClick={() => onRetry(entry.slug)} className="btn btn-secondary">Regenerate</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
