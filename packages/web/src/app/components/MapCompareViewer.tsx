"use client";

import { useState, useRef, useCallback } from "react";
import type { MapCompareBlockData } from "@encarta/core";

export default function MapCompareViewer({
  historicalImageSrc = "https://images.nasa.gov/details-PIA01907",
  modernImageSrc,
  historicalTitle = "Historical Cartography Layer (1850)",
  modernTitle = "Modern Satellite / OpenStreetMap",
  caption,
  source,
}: MapCompareBlockData) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultHistorical = historicalImageSrc || "https://upload.wikimedia.org/wikipedia/commons/e/e0/Plan_of_Ancient_Rome.jpg";
  const defaultModern = modernImageSrc || "https://upload.wikimedia.org/wikipedia/commons/4/4b/Rome_satellite_map.jpg";

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPos(percentage);
  }, []);

  return (
    <figure className="my-6 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--accent,#3b82f6)]/10 text-[var(--accent,#3b82f6)] border border-[var(--accent,#3b82f6)]/20">
          🗺️ TIME MACHINE MAP COMPARISON
        </span>
        {source && <span className="text-[11px] font-mono text-[var(--subtle)]">Source: {source}</span>}
      </div>

      <div
        ref={containerRef}
        className="relative h-80 sm:h-96 w-full select-none overflow-hidden rounded cursor-ew-resize border border-[var(--border)]"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={(e) => {
          if (isDragging) handleMove(e.clientX);
        }}
        onTouchMove={(e) => {
          if (e.touches.length > 0) handleMove(e.touches[0].clientX);
        }}
      >
        {/* Modern Layer (Background) */}
        <img src={defaultModern} alt={modernTitle} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute top-3 right-3 rounded bg-black/80 px-2.5 py-1 text-xs text-white font-mono backdrop-blur-sm z-10">
          {modernTitle}
        </div>

        {/* Historical Layer (Clipped Overlay) */}
        <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <img
            src={defaultHistorical}
            alt={historicalTitle}
            className="h-full w-full max-w-none object-cover"
            style={{ width: containerRef.current ? containerRef.current.clientWidth : "100%" }}
          />
          <div className="absolute top-3 left-3 rounded bg-black/80 px-2.5 py-1 text-xs text-white font-mono backdrop-blur-sm z-10">
            {historicalTitle}
          </div>
        </div>

        {/* Divider Handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)] cursor-ew-resize z-20"
          style={{ left: `calc(${sliderPos}% - 2px)` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg text-xs font-bold">
            ↔
          </div>
        </div>
      </div>

      {caption && <figcaption className="mt-2.5 text-xs text-[var(--subtle)] italic">{caption}</figcaption>}
    </figure>
  );
}
