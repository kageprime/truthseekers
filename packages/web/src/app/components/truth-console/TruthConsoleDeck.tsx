"use client";

import { useMemo } from "react";
import type { TraceSegment } from "./types";
import { LIVE_SEGMENT_ID } from "./types";
import { toolIcon, toolLabel, toolColor, argsDisplay } from "./registry";

interface Props {
  segments: TraceSegment[];
  liveSegmentId: string | null;
  unreadTotal: number;
  onClick: () => void;
  variant: "footer" | "tab";
}

function formatCount(n: number): string {
  return n > 99 ? "99+" : String(n);
}

/**
 * The minimized "truth console" trigger. In the footer variant it renders an
 * Android-style stacked notification deck — the live segment's last few
 * tool-call chips peek behind a live count badge that pulses while streaming.
 * The tab variant is a compact inline control for the FloatingChatWidget.
 */
export default function TruthConsoleDeck({ segments, liveSegmentId, unreadTotal, onClick, variant }: Props) {
  // Events that drive the peek stack: the live segment's tool_uses if streaming,
  // else the most recent segment's tool_uses (so the deck always shows the latest).
  const stackEvents = useMemo(() => {
    const live = segments.find((s) => s.id === liveSegmentId);
    const source = live ?? segments[segments.length - 1];
    if (!source) return [];
    return source.events
      .filter((e) => e.type === "tool_use")
      .slice(-3) // last 3 chips, latest on top
      .reverse();
  }, [segments, liveSegmentId]);

  const totalEvents = useMemo(
    () => segments.reduce((sum, s) => sum + s.events.length, 0),
    [segments],
  );
  const isLive = liveSegmentId === LIVE_SEGMENT_ID;
  const showCount = isLive ? liveEventsCount(segments) : totalEvents;

  if (variant === "tab") {
    // Compact inline for FloatingChatWidget — icon stack + count, no peek deck.
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-accent-bg/30 transition-colors text-muted cursor-pointer"
        aria-label="Open console"
      >
        <DeckIcon size={14} />
        <span>Console</span>
        {totalEvents > 0 && (
          <span
            className={`text-[9px] px-1 py-0.5 rounded-full ${isLive ? "animate-pulse-ring" : ""}`}
            style={{ background: isLive ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "color-mix(in srgb, var(--border) 40%, transparent)", color: isLive ? "var(--accent)" : "var(--subtle)" }}
          >
            {formatCount(totalEvents)}
          </span>
        )}
      </button>
    );
  }

  // ── Footer variant: stacked notification deck ──
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors cursor-pointer text-subtle hover:text-ink"
      aria-label="Open agent console"
    >
      {/* Peek stack — absolutely positioned chips fanned behind the badge.
          Newest on top (index 0), each one beneath is offset down + faded. */}
      {stackEvents.length > 0 && (
        <span className="relative hidden sm:flex items-center pointer-events-none" aria-hidden>
          {stackEvents.map((e, i) => {
            const name = ((e.data as any)?.name as string) || "";
            const args = ((e.data as any)?.args as Record<string, unknown>) || {};
            const color = toolColor(name);
            return (
              <span
                key={`${e.timestamp}-${i}`}
                className="absolute right-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md border bg-surface-elevated transition-all duration-200 group-hover:translate-y-0"
                style={{
                  transform: `translateY(${i * 5}px)`,
                  opacity: [1, 0.72, 0.45][i] ?? 0.4,
                  zIndex: 10 - i,
                  borderColor: "color-mix(in srgb, " + color + " 35%, transparent)",
                  boxShadow: i === 0 ? "0 1px 3px rgba(0,0,0,0.12)" : undefined,
                }}
              >
                <span className="shrink-0 flex items-center justify-center" style={{ color }}>{toolIcon(name, 9)}</span>
                <span className="text-[7px] font-medium text-ink truncate max-w-[56px]">{toolLabel(name)}</span>
              </span>
            );
          })}
        </span>
      )}

      {/* Anchor chip + badge — occupies real layout space. */}
      <span className="relative flex items-center gap-1">
        <DeckIcon size={10} />
        <span>Agent</span>
        {(showCount > 0 || isLive) && (
          <span
            className={`text-[8px] px-1 py-0.5 rounded-full tabular-nums ${isLive ? "animate-pulse-ring" : ""}`}
            style={{
              background: isLive ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "var(--accent-bg)",
              color: "var(--accent)",
            }}
          >
            {formatCount(showCount)}
          </span>
        )}
        {/* Unread dot — events accrued while the console was viewing history. */}
        {!isLive && unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        )}
      </span>
    </button>
  );
}

function liveEventsCount(segments: TraceSegment[]): number {
  return segments.find((s) => s.id === LIVE_SEGMENT_ID)?.events.length ?? 0;
}

function DeckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
