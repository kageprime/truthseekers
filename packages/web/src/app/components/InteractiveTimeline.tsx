"use client";

import { useState } from "react";

interface TimelineEvent {
  id?: string;
  year: number;
  event: string;
  description: string;
  image?: string;
  causes?: string[];
}

export default function InteractiveTimeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => a.year - b.year);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [scrubX, setScrubX] = useState(0);

  if (sorted.length === 0) return null;

  const minYear = sorted[0].year;
  const maxYear = sorted[sorted.length - 1].year;
  const range = maxYear - minYear || 1;

  function yearToX(year: number): number {
    return ((year - minYear) / range) * 100;
  }

  // Build causality edges for active event
  const activeEvent = activeIdx !== null ? sorted[activeIdx] : null;
  const causeEdges: { from: number; to: number; fromIdx: number; toIdx: number }[] = [];
  if (activeEvent?.causes) {
    for (const causeId of activeEvent.causes) {
      const causeIdx = sorted.findIndex((e) => e.id === causeId || e.event === causeId);
      if (causeIdx >= 0) {
        causeEdges.push({
          from: yearToX(sorted[causeIdx].year),
          to: yearToX(activeEvent.year),
          fromIdx: causeIdx,
          toIdx: activeIdx!,
        });
      }
    }
  }

  return (
    <div className="pixel-card p-6 my-4" style={{ background: "var(--ice)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">⏳</span>
        <div>
          <h3 className="pixel text-sm" style={{ color: "var(--ink)" }}>TIMELINE</h3>
          <div className="h-1 w-12 mt-1" style={{ background: "var(--blue)" }} />
        </div>
        <span className="ml-auto text-xs text-[#888]">
          {minYear} – {maxYear}
        </span>
      </div>

      {/* Scrubber bar + SVG causality overlay */}
      <div
        className="relative h-14 cursor-pointer select-none mb-3"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          setScrubX(Math.max(0, Math.min(100, x)));
          const year = minYear + (x / 100) * range;
          let closest = 0;
          let minDist = Infinity;
          sorted.forEach((ev, i) => {
            const dist = Math.abs(ev.year - year);
            if (dist < minDist) { minDist = dist; closest = i; }
          });
          if (minDist < range * 0.15) {
            setActiveIdx(closest);
          } else {
            setActiveIdx(null);
          }
        }}
        onMouseLeave={() => { setActiveIdx(null); setScrubX(0); }}
        onClick={() => {
          if (activeIdx !== null) {
            const next = (activeIdx + 1) % sorted.length;
            setActiveIdx(next);
          }
        }}
      >
        {/* SVG causality arrows */}
        {causeEdges.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {causeEdges.map((edge, i) => (
              <line
                key={i}
                x1={`${edge.from}%`}
                y1="50%"
                x2={`${edge.to}%`}
                y2="50%"
                stroke="var(--orange)"
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd="url(#arrowhead)"
              />
            ))}
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="var(--orange)" />
              </marker>
            </defs>
          </svg>
        )}

        {/* Track line */}
        <div
          className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 border-2 border-black"
          style={{ background: "var(--blue)", opacity: 0.15 }}
        />

        {/* Filled portion */}
        <div
          className="absolute top-1/2 left-0 h-2 -translate-y-1/2 transition-all duration-150"
          style={{ width: `${scrubX}%`, background: "var(--blue)", opacity: 0.4 }}
        />

        {/* Scrub handle */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 border-2 border-black bg-white shadow-[2px_2px_0_#1c1917] transition-all duration-100 pointer-events-none"
          style={{ left: `${scrubX}%` }}
        />

        {/* Event dots — same-year events get a joint indicator */}
        {(() => {
          const yearGroups = new Map<number, number[]>();
          sorted.forEach((ev, i) => {
            const arr = yearGroups.get(ev.year) || [];
            arr.push(i);
            yearGroups.set(ev.year, arr);
          });

          return sorted
            .filter((_, i) => {
              const group = yearGroups.get(sorted[i].year)!;
              return group[0] === i;
            })
            .map((ev) => {
              const group = yearGroups.get(ev.year)!;
              const groupCount = group.length;
              const x = yearToX(ev.year);
              const isActive = activeIdx !== null && group.includes(activeIdx);

              return (
                <div
                  key={ev.year}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-black rounded-full cursor-pointer transition-all duration-150 z-10"
                  style={{
                    left: `${x}%`,
                    width: groupCount > 1 ? 18 : 12,
                    height: groupCount > 1 ? 18 : 12,
                    background: isActive ? "var(--orange)" : "white",
                    boxShadow: isActive ? "2px 2px 0 #1c1917" : "none",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActive) {
                      const currentInGroup = activeIdx !== null ? group.indexOf(activeIdx) : -1;
                      const nextInGroup = (currentInGroup + 1) % groupCount;
                      setActiveIdx(group[nextInGroup]);
                    } else {
                      setActiveIdx(group[0]);
                    }
                  }}
                  title={groupCount > 1 ? `${groupCount} events in ${ev.year}` : String(ev.year)}
                >
                  {groupCount > 1 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold" style={{ color: "var(--ink)" }}>
                      {groupCount}
                    </span>
                  )}
                </div>
              );
            });
        })()}
      </div>

      {/* Year labels */}
      <div className="relative mb-2" style={{ height: 32 }}>
        {(() => {
          const seen: number[] = [];
          const MIN_GAP_PCT = 8;

          return sorted.map((ev, i) => {
            const x = yearToX(ev.year);
            const overlaps = seen.some((sx) => Math.abs(x - sx) < MIN_GAP_PCT);
            if (!overlaps || activeIdx === i) seen.push(x);
            const hidden = overlaps && activeIdx !== i;

            return (
              <div
                key={i}
                className="absolute pixel text-[8px] transition-all duration-150"
                style={{
                  left: `${x}%`,
                  transform: "translateX(-50%)",
                  top: hidden ? "8px" : (i % 2 === 0 ? "0px" : "16px"),
                  color: activeIdx === i ? "var(--ink)" : hidden ? "transparent" : "#aaa",
                  fontWeight: activeIdx === i ? 700 : 400,
                  opacity: hidden ? 0 : 1,
                  pointerEvents: hidden ? "none" : "auto",
                }}
              >
                {ev.year}
              </div>
            );
          });
        })()}
      </div>

      {/* Active event detail */}
      {activeIdx !== null && (
        <div
          className="mt-4 p-4 border-3 border-black bg-white transition-all duration-200"
          style={{ boxShadow: "4px 4px 0 var(--blue)" }}
        >
          <div className="flex items-start gap-3 mb-2">
            <span className="pixel text-lg font-bold shrink-0" style={{ color: "var(--blue)" }}>
              {sorted[activeIdx].year}
            </span>
            <div>
              <strong className="text-lg">{sorted[activeIdx].event}</strong>
              {sorted[activeIdx].description && (
                <p className="text-sm text-[#555] leading-relaxed mt-1">
                  {sorted[activeIdx].description}
                </p>
              )}
            </div>
          </div>

          {/* Event image */}
          {sorted[activeIdx].image && (
            <div className="mt-3">
              <img
                src={sorted[activeIdx].image}
                alt={sorted[activeIdx].event}
                className="max-w-full max-h-48 object-contain border-2 border-black"
                loading="lazy"
              />
            </div>
          )}

          {/* Causality indicator */}
          {sorted[activeIdx].causes && sorted[activeIdx].causes.length > 0 && (
            <div className="mt-3 pt-3 border-t-2 border-dashed border-[#e0e0e0]">
              <p className="text-xs text-[#888] mb-1">
                Connected to: {sorted[activeIdx].causes!.map((cid) => {
                  const linked = sorted.find((e) => e.id === cid || e.event === cid);
                  return linked ? `${linked.event} (${linked.year})` : cid;
                }).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
