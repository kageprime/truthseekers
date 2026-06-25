"use client";

import type { TraceSegment } from "./types";
import { LIVE_SEGMENT_ID } from "./types";

interface Props {
  segments: TraceSegment[];
  activeSegmentId: string | null;
  onSelect: (id: string) => void;
}

/**
 * A horizontally-scrollable strip of segment pills — one per assistant
 * response. The live one pulses with a gold ring + LIVE micro-tag.
 */
export default function SegmentPills({ segments, activeSegmentId, onSelect }: Props) {
  if (segments.length === 0) return null;
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 border-b border-border/60 tc-scroll-x">
      {segments.map((seg) => {
        const isActive = seg.id === activeSegmentId;
        const isLive = seg.id === LIVE_SEGMENT_ID;
        return (
          <button
            key={seg.id}
            onClick={() => onSelect(seg.id)}
            className={`group relative inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap transition-colors shrink-0 ${
              isActive ? "bg-accent-bg text-accent" : "text-subtle hover:text-ink hover:bg-accent-bg/30"
            }`}
            style={isActive ? { boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)" } : undefined}
            title={seg.label}
          >
            {isLive && (
              <span className="relative flex items-center justify-center w-1.5 h-1.5 shrink-0">
                <span className="absolute inline-flex w-full h-full rounded-full animate-pulse-ring" style={{ background: "var(--accent)" }} />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              </span>
            )}
            <span className="max-w-[90px] truncate">{seg.label}</span>
            {isLive ? (
              <span className="text-[7px] font-bold tracking-wider px-1 py-px rounded uppercase" style={{ background: "color-mix(in srgb, var(--accent) 22%, transparent)", color: "var(--accent)" }}>Live</span>
            ) : (
              <span className="text-[8px] text-subtle/80 tabular-nums">{seg.events.length}</span>
            )}
          </button>
        );
      })}
      <style>{`.tc-scroll-x::-webkit-scrollbar { height: 0; } .tc-scroll-x { scrollbar-width: none; }`}</style>
    </div>
  );
}
