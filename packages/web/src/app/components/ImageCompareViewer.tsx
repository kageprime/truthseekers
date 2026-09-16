"use client";

import { useState, useRef, useCallback } from "react";
import { MediaLightbox } from "./MediaImage";

export default function ImageCompareViewer({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before / Historical",
  afterLabel = "After / Modern",
  caption,
  source,
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  caption?: string;
  source?: string;
}) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = (x / rect.width) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    setSliderPos(percentage);
  }, []);

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  return (
    <figure className="my-6 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 overflow-hidden">
      <div
        ref={containerRef}
        className="relative h-80 sm:h-96 w-full select-none overflow-hidden rounded cursor-ew-resize"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
      >
        {/* After Image (Background) */}
        <img
          src={afterSrc}
          alt={afterLabel}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute top-3 right-3 rounded bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
          {afterLabel}
        </div>

        {/* Before Image (Clipped overlay) */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={beforeSrc}
            alt={beforeLabel}
            className="h-full w-full max-w-none object-cover"
            style={{ width: containerRef.current ? containerRef.current.clientWidth : "100%" }}
          />
          <div className="absolute top-3 left-3 rounded bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
            {beforeLabel}
          </div>
        </div>

        {/* Divider Bar */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-ew-resize"
          style={{ left: `calc(${sliderPos}% - 2px)` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-md text-xs font-bold">
            ↔
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--subtle)] px-1">
        {caption && <span>{caption}</span>}
        {source && (
          <span className="ml-auto inline-flex items-center gap-1 rounded bg-[var(--surface-elevated)] px-2 py-0.5 border border-[var(--border)] font-mono text-[11px]">
            Source: {source}
          </span>
        )}
      </div>

      {lightboxSrc && (
        <MediaLightbox src={lightboxSrc} caption={caption ?? "Comparison"} onClose={() => setLightboxSrc(null)} />
      )}
    </figure>
  );
}
