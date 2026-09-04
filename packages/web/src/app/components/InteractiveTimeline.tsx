"use client";

import { useState, useEffect, useRef } from "react";
import { IconClock } from "./Icons";

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
  war: "var(--event-war)",
  discovery: "var(--event-discovery)",
  politics: "var(--event-politics)",
  culture: "var(--event-culture)",
  science: "var(--event-science)",
  disaster: "var(--event-disaster)",
  technology: "var(--event-technology)",
  biography: "var(--event-biography)",
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
      <div className="glass-card-static p-6 my-4 text-center">
        <IconClock size={24} />
        <p className="text-xs font-medium mt-2" style={{ color: "var(--subtle)" }}>No timeline data available</p>
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

  useEffect(() => {
    if (playing && activeIdx !== null) {
      setScrubX(yearToX(sorted[activeIdx].year));
    }
  }, [activeIdx, playing, sorted]);

  useEffect(() => {
    if (activeIdx === null || !listRef.current) return;
    const child = listRef.current.children[activeIdx] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIdx]);

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
      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <IconClock size={15} style={{ color: "var(--accent-dark)" }} />
            <span className="small-caps text-[10px] tracking-[0.24em]" style={{ color: "var(--accent-dark)" }}>Chronicle</span>
          </div>
          <h3 className="font-display text-2xl leading-none" style={{ color: "var(--ink)", fontWeight: 600 }}>Timeline</h3>
          <div className="h-px w-12 mt-3 rounded-full" style={{ background: "linear-gradient(90deg, var(--gold), transparent)" }} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-8 h-9 flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer active:scale-95"
            style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent-dark)", border: "1px solid color-mix(in srgb, var(--gold) 32%, transparent)" }}
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
            className="w-8 h-9 flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer active:scale-95"
            style={{ background: "color-mix(in srgb, var(--surface-glass) 80%, transparent)", color: "var(--subtle)", border: "1px solid var(--border)" }}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              {fullscreen
                ? <><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></>
                : <><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></>}
            </svg>
          </button>
          <span className="small-caps text-[10px] tracking-[0.18em] whitespace-nowrap tabular-nums" style={{ color: "var(--subtle)" }}>{minYear} – {maxYear}</span>
        </div>
      </div>

      {usedCats.length > 1 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
          {usedCats.map((cat) => (
            <span key={cat} className="flex items-center gap-2 small-caps text-[10px] tracking-[0.16em]"
              style={{ color: "var(--muted)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: catColor(cat) }} />
              {CATEGORY_LABELS[cat] ?? cat}
            </span>
          ))}
        </div>
      )}

      <div
        className="relative h-12 cursor-pointer select-none mb-3 rounded-lg"
        style={{ background: "var(--surface-glass)" }}
        onMouseMove={(e) => { if (!playing) scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect()); }}
        onMouseLeave={() => { if (!playing) { setActiveIdx(null); setScrubX(0); } }}
        onClick={(e) => { if (!playing) scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect()); }}
      >
        {causeEdges.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {causeEdges.map((edge, i) => (
              <line key={i} x1={`${edge.from}%`} y1="50%" x2={`${edge.to}%`} y2="50%"
                stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 2"
                markerEnd={`url(#arrow-${uid})`} />
            ))}
            <defs>
              <marker id={`arrow-${uid}`} markerWidth="5" markerHeight="3" refX="5" refY="1.5" orient="auto">
                <polygon points="0 0, 5 1.5, 0 3" fill="var(--accent)" />
              </marker>
            </defs>
          </svg>
        )}

        <div className="absolute left-3 right-3 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{ background: "color-mix(in srgb, var(--rule) 55%, transparent)" }} />
        <div className="absolute left-3 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{
            width: `calc(3px + ${scrubX}% * (100% - 18px) / 100)`,
            background: "linear-gradient(90deg, var(--gold), var(--gold-soft))",
            boxShadow: "0 0 8px color-mix(in srgb, var(--gold) 40%, transparent)",
          }} />
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 ${playing ? "animate-pulse" : ""}`}
          style={{ left: `${scrubX}%` }}
        >
          <span className="block w-[13px] h-[13px] rounded-full border-2 transition-transform duration-200"
            style={{
              background: activeIdx !== null ? catColor(sorted[activeIdx]?.category) : "var(--surface)",
              borderColor: "var(--gold)",
              boxShadow: "0 0 0 4px color-mix(in srgb, var(--gold) 12%, transparent)",
            }} />
        </div>

        {sorted.filter((_, i) => { const g = yearGroups.get(sorted[i].year)!; return g[0] === i; }).map((ev) => {
          const g = yearGroups.get(ev.year)!;
          const n = g.length;
          const x = yearToX(ev.year);
          const isActive = activeIdx !== null && g.includes(activeIdx);
          return (
            <div key={ev.year}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border cursor-pointer transition-all duration-200 z-10 hover:scale-110"
              style={{
                left: `${x}%`, width: n > 1 ? 17 : 11, height: n > 1 ? 17 : 11,
                background: isActive ? catColor(ev.category) : "var(--surface)",
                borderColor: isActive ? catColor(ev.category) : "var(--gold-soft)",
                borderWidth: isActive ? 2 : 1.5,
                boxShadow: isActive ? "0 0 0 3px color-mix(in srgb, var(--gold) 14%, transparent)" : "none",
              }}
              onClick={(e) => {
                e.stopPropagation(); setPlaying(false);
                if (isActive) {
                  const cur = activeIdx !== null ? g.indexOf(activeIdx) : -1;
                  setActiveIdx(g[(cur + 1) % n]);
                } else { setActiveIdx(g[0]); }
              }}
              title={n > 1 ? `${n} events in ${ev.year}` : String(ev.year)}>
              {n > 1 && <span className="absolute inset-0 flex items-center justify-center text-[6px] font-bold" style={{ color: "var(--ink)" }}>{n}</span>}
            </div>
          );
        })}
      </div>

      <div className="relative mb-3" style={{ height: 30 }}>
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
                className="absolute small-caps tabular-nums transition-all duration-200"
                style={{
                  left: `${x}%`, transform: "translateX(-50%)", fontSize: "0.72rem",
                  top: hidden ? "8px" : (i % 2 === 0 ? "0px" : "16px"),
                  letterSpacing: "0.08em",
                  color: activeIdx === i ? "var(--accent-dark)" : hidden ? "transparent" : "var(--subtle)",
                  fontWeight: activeIdx === i ? 600 : 400,
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
    <div ref={listRef} className="divide-y" style={{ scrollBehavior: "smooth", borderTop: "1px solid var(--rule)" }}>
      {sorted.map((ev, i) => {
        const isActive = activeIdx === i;
        return (
          <div key={i}
            onClick={() => selectIdx(i)}
            role="option"
            aria-selected={isActive}
            className="group relative flex items-start gap-4 py-3.5 pl-2 pr-2 cursor-pointer transition-colors duration-300"
            style={{
              background: isActive ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "transparent",
            }}
          >
            {/* Gold active rail */}
            <div aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full transition-all duration-300"
              style={{
                width: 3, height: isActive ? "64%" : "38%", opacity: isActive ? 1 : 0,
                background: catColor(ev.category),
                transform: `translateY(-50%) scaleY(${isActive ? 1 : 0.6})`,
              }} />
            <span className="font-display text-lg leading-none shrink-0 mt-0.5 tabular-nums"
              style={{ color: isActive ? catColor(ev.category) : "var(--subtle)", width: 56, fontWeight: 600 }}>
              {ev.year}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-sm leading-snug transition-colors duration-300"
                  style={{ color: isActive ? "var(--ink)" : "var(--muted)", fontFamily: "var(--font-display)" }}>
                  {ev.event}
                </strong>
                {ev.category && (
                  <span className="small-caps text-[9px] tracking-[0.14em] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: `${catColor(ev.category)}12`, color: catColor(ev.category) }}>
                    {CATEGORY_LABELS[ev.category] ?? ev.category}
                  </span>
                )}
              </div>
              {ev.description && (
                <p className={`text-xs leading-relaxed mt-1 ${isActive ? "" : "line-clamp-2"}`}
                  style={{ color: "var(--muted)", fontStyle: isActive ? "normal" : "italic" }}>
                  {ev.description}
                </p>
              )}
            </div>
            <span className="mt-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ color: "var(--subtle)" }}>↗</span>
          </div>
        );
      })}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 md:p-6">
        <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden rounded-[1.4rem]"
          style={{ background: "var(--background)", border: "1px solid var(--border)", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--gold) 35%, var(--gold) 65%, transparent)" }} />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 50% at 50% 0%, color-mix(in srgb, var(--gold) 6%, transparent), transparent 55%)" }} />
          <div className="relative">
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-4 right-4 z-40 w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-transform duration-300"
              style={{ background: "color-mix(in srgb, var(--surface-glass) 80%, transparent)", border: "1px solid var(--border)", color: "var(--subtle)" }}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="px-6 md:px-8 pt-6">
              {trackTop}
            </div>
          </div>
          <hr className="border-t mx-8" style={{ borderColor: "var(--rule)" }} />
          <div className="flex-1 overflow-y-auto min-h-0 px-6 md:px-8 pb-6" style={{ scrollBehavior: "smooth", scrollbarWidth: "thin" }}>
            {trackList}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative my-5 rounded-[1.4rem] overflow-hidden" style={{ background: "var(--surface-glass)", border: "1px solid var(--border)" }}>
      {/* Top hairline + soft paper wash */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--gold) 30%, var(--gold) 70%, transparent)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--gold) 5%, transparent), transparent 60%)" }} />
      <div className="relative p-5 sm:p-7">
        {trackTop}
        <div className="max-h-72 sm:max-h-56 overflow-y-auto pr-1" style={{ scrollBehavior: "smooth", scrollbarWidth: "thin" }}>
          {trackList}
        </div>
      </div>
    </div>
  );
}
