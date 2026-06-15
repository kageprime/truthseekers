"use client";

import { useState, useEffect, useRef } from "react";

interface TimelineEvent {
  id?: string;
  year: number;
  event: string;
  description: string;
  image?: string;
  causes?: string[];
  category?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  war: "#dc2626",
  discovery: "#22c55e",
  politics: "#0c4a6e",
  culture: "#a21caf",
  science: "#0284c7",
  disaster: "#f59e0b",
  technology: "#ea580c",
  biography: "#ec4899",
};

const CATEGORY_LABELS: Record<string, string> = {
  war: "War",
  discovery: "Discovery",
  politics: "Politics",
  culture: "Culture",
  science: "Science",
  disaster: "Disaster",
  technology: "Technology",
  biography: "Biography",
};

function catColor(cat?: string): string {
  return cat ? CATEGORY_COLORS[cat] ?? "var(--subtle)" : "var(--subtle)";
}

export default function InteractiveTimeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => a.year - b.year);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [scrubX, setScrubX] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const uid = useRef(`tl-${Math.random().toString(36).slice(2, 8)}`).current;

  if (sorted.length === 0) {
    return (
      <div className="pixel-card-sm p-6 my-4 text-center bg-white">
        <div className="text-3xl mb-2">📅</div>
        <p className="pixel text-[9px]" style={{ color: "var(--subtle)" }}>No timeline data available</p>
      </div>
    );
  }

  const minYear = sorted[0].year;
  const maxYear = sorted[sorted.length - 1].year;
  const range = maxYear - minYear || 1;

  function yearToX(year: number): number {
    return ((year - minYear) / range) * 100;
  }

  const yearGroups = new Map<number, number[]>();
  sorted.forEach((ev, i) => {
    const arr = yearGroups.get(ev.year) || [];
    arr.push(i);
    yearGroups.set(ev.year, arr);
  });

  function findClosest(year: number): number | null {
    let closest = 0;
    let minDist = Infinity;
    sorted.forEach((ev, i) => {
      const dist = Math.abs(ev.year - year);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    return minDist < range * 0.15 ? closest : null;
  }

  function scrubFrom(clientX: number, rect: DOMRect) {
    const x = ((clientX - rect.left) / rect.width) * 100;
    setScrubX(Math.max(0, Math.min(100, x)));
    const year = minYear + (x / 100) * range;
    setActiveIdx(findClosest(year));
  }

  // Auto-advance
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % sorted.length;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [playing, sorted.length]);

  // Sync scrub handle position when playing
  useEffect(() => {
    if (playing && activeIdx !== null) {
      setScrubX(yearToX(sorted[activeIdx].year));
    }
  }, [activeIdx, playing, sorted]);

  // Scroll list to active event
  useEffect(() => {
    if (activeIdx === null || !listRef.current) return;
    const child = listRef.current.children[activeIdx] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIdx]);

  // Causality edges
  const activeEvent = activeIdx !== null ? sorted[activeIdx] : null;
  const causeEdges: { from: number; to: number }[] = [];
  if (activeEvent?.causes) {
    for (const causeId of activeEvent.causes) {
      const causeIdx = sorted.findIndex((e) => e.id === causeId || e.event === causeId);
      if (causeIdx >= 0) {
        causeEdges.push({ from: yearToX(sorted[causeIdx].year), to: yearToX(activeEvent.year) });
      }
    }
  }

  const usedCats = [...new Set(sorted.map((e) => e.category).filter(Boolean))] as string[];

  function togglePlay() {
    setPlaying((p) => !p);
    if (!playing && activeIdx === null) {
      setActiveIdx(0);
      setScrubX(0);
    }
  }

  function selectIdx(i: number) {
    setActiveIdx(i);
    setScrubX(yearToX(sorted[i].year));
    setPlaying(false);
  }

  const trackTop = (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-3xl">⏳</span>
        <div>
          <h3 className="pixel text-sm" style={{ color: "var(--ink)" }}>TIMELINE</h3>
          <div className="h-1 w-12 mt-1" style={{ background: "var(--blue)" }} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] active:shadow-[1px_1px_0_#1c1917] transition-all text-xs"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>
            )}
          </button>
          <button
            onClick={() => setFullscreen((f) => !f)}
            className="w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] active:shadow-[1px_1px_0_#1c1917] transition-all text-xs"
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              {fullscreen
                ? <><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></>
                : <><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></>}
            </svg>
          </button>
          <span className="text-xs ml-1 whitespace-nowrap" style={{ color: "var(--subtle)" }}>{minYear} – {maxYear}</span>
        </div>
      </div>

      {/* Category legend */}
      {usedCats.length > 1 && (
        <div className="flex flex-wrap gap-3 mb-3 text-xs sm:text-[10px]">
          {usedCats.map((cat) => (
            <span key={cat} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 border-2 border-black" style={{ background: catColor(cat) }} />
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
          ))}
        </div>
      )}

      {/* Scrubber */}
      <div
        className="relative h-14 cursor-pointer select-none mb-3"
        onMouseMove={(e) => { if (!playing) scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect()); }}
        onMouseLeave={() => { if (!playing) { setActiveIdx(null); setScrubX(0); } }}
        onClick={(e) => { if (!playing) scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect()); }}
      >
        {/* Causality arrows */}
        {causeEdges.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {causeEdges.map((edge, i) => (
              <line key={i} x1={`${edge.from}%`} y1="50%" x2={`${edge.to}%`} y2="50%"
                stroke="var(--orange)" strokeWidth="2" strokeDasharray="4 2"
                markerEnd={`url(#arrow-${uid})`} />
            ))}
            <defs>
              <marker id={`arrow-${uid}`} markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="var(--orange)" />
              </marker>
            </defs>
          </svg>
        )}

        {/* Track line */}
        <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 border-2 border-black"
          style={{ background: "var(--blue)", opacity: 0.15 }} />
        <div className="absolute top-1/2 left-0 h-2 -translate-y-1/2 transition-all duration-150"
          style={{ width: `${scrubX}%`, background: "var(--blue)", opacity: 0.4 }} />

        {/* Scrub handle */}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 border-2 border-black shadow-[2px_2px_0_#1c1917] transition-all duration-100 pointer-events-none z-30 ${playing ? "animate-pulse" : ""}`}
          style={{ left: `${scrubX}%`, background: activeIdx !== null ? catColor(sorted[activeIdx]?.category) : "white" }}
        />

        {/* Event dots */}
        {sorted.filter((_, i) => { const g = yearGroups.get(sorted[i].year)!; return g[0] === i; }).map((ev) => {
          const g = yearGroups.get(ev.year)!;
          const n = g.length;
          const x = yearToX(ev.year);
          const isActive = activeIdx !== null && g.includes(activeIdx);
          return (
            <div key={ev.year}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-black cursor-pointer transition-all duration-150 z-10"
              style={{
                left: `${x}%`, width: n > 1 ? 18 : 12, height: n > 1 ? 18 : 12,
                background: isActive ? catColor(ev.category) : "white",
                boxShadow: isActive ? "2px 2px 0 #1c1917" : "none",
                borderColor: isActive ? catColor(ev.category) : "black",
              }}
              onClick={(e) => {
                e.stopPropagation(); setPlaying(false);
                if (isActive) {
                  const cur = activeIdx !== null ? g.indexOf(activeIdx) : -1;
                  setActiveIdx(g[(cur + 1) % n]);
                } else { setActiveIdx(g[0]); }
              }}
              title={n > 1 ? `${n} events in ${ev.year}` : String(ev.year)}>
              {n > 1 && <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold" style={{ color: "var(--ink)" }}>{n}</span>}
            </div>
          );
        })}
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
              <div key={i}
                className="absolute pixel text-xs sm:text-[8px] transition-all duration-150"
                style={{
                  left: `${x}%`, transform: "translateX(-50%)",
                  top: hidden ? "8px" : (i % 2 === 0 ? "0px" : "16px"),
                  color: activeIdx === i ? "var(--ink)" : hidden ? "transparent" : "var(--subtle)",
                  fontWeight: activeIdx === i ? 700 : 400,
                  opacity: hidden ? 0 : 1,
                  pointerEvents: hidden ? "none" : "auto",
                }}>
                {ev.year}
              </div>
            );
          });
        })()}
      </div>
    </>
  );

  const trackList = (
    <div ref={listRef} className="space-y-1" style={{ scrollBehavior: "smooth" }}>
      {sorted.map((ev, i) => {
        const isActive = activeIdx === i;
        return (
          <div key={i} onClick={() => selectIdx(i)}
            className={`flex items-start gap-3 p-3 border-2 border-black cursor-pointer transition-all duration-100 ${
              isActive ? "bg-white shadow-[3px_3px_0_#1c1917]" : "bg-white/70 hover:bg-white hover:shadow-[2px_2px_0_#1c1917]"
            }`}
            style={{ borderLeftColor: catColor(ev.category), borderLeftWidth: 4 }}>
            <span className="pixel text-xs font-bold shrink-0 mt-0.5 whitespace-nowrap" style={{ color: catColor(ev.category) }}>
              {ev.year}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm leading-snug">{ev.event}</strong>
                {ev.category && (
                  <span className="text-xs sm:text-[9px] px-1.5 py-0.5 border-2 border-black font-medium shrink-0"
                    style={{ background: `${catColor(ev.category)}20`, color: catColor(ev.category) }}>
                    {CATEGORY_LABELS[ev.category] ?? ev.category}
                  </span>
                )}
              </div>
              {ev.description && (
                <p className={`text-xs leading-relaxed mt-0.5 ${isActive ? "" : "line-clamp-2"}`} style={{ color: "var(--muted)" }}>
                  {ev.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-2 md:p-6">
        <div className="pixel-card p-5 md:p-6 w-full max-w-4xl max-h-[95vh] flex flex-col bg-white overflow-hidden">
          <div className="shrink-0">
            {trackTop}
          </div>
          <hr className="border-t-2 border-dashed my-2" style={{ borderColor: "var(--border)" }} />
          <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollBehavior: "smooth" }}>
            {trackList}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pixel-card p-3 sm:p-6 my-4" style={{ background: "var(--ice)" }}>
      {trackTop}
      <div className="max-h-64 sm:max-h-48 overflow-y-auto" style={{ scrollBehavior: "smooth" }}>
        {trackList}
      </div>
    </div>
  );
}
