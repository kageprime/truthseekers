"use client";

import { useState, useRef, useCallback } from "react";
import { safeSrc } from "@/lib/safe-url";
import { articleBus } from "@/lib/articleBus";

export interface PanoramicHotspot {
  id: string;
  xPercent: number; // 0-100% horizontal position
  yPercent: number; // 0-100% vertical position
  title: string;
  description?: string;
  claimId?: string;
}

export interface PanoramicMapBlockData {
  title?: string;
  src: string;
  compareSrc?: string;
  eraPrimary?: string;
  eraSecondary?: string;
  caption?: string;
  source?: string;
  hotspots?: PanoramicHotspot[];
}

export default function PanoramicMapViewer({
  data,
  height = "420px",
}: {
  data: PanoramicMapBlockData;
  height?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [compareSplit, setCompareSplit] = useState(50);
  const [showCompare, setShowCompare] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<PanoramicHotspot | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const imgSrc = safeSrc(data.src);
  const compareImgSrc = data.compareSrc ? safeSrc(data.compareSrc) : null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.4, 3.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.4, 1));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleHotspotClick = useCallback((h: PanoramicHotspot) => {
    setActiveHotspot(h);
    if (h.claimId) {
      articleBus.emit({ type: "CLAIM_CLICKED", payload: { claimId: h.claimId, text: h.title } });
    }
  }, []);

  return (
    <figure className="my-6 block overflow-hidden rounded-[var(--radius-sharp)] border border-[var(--rule)] bg-[var(--surface-elevated)] shadow-sm">
      {/* Map Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--rule)] bg-[var(--gold-bg)] text-[12px]">
        <div className="flex items-center gap-2 font-display font-semibold text-[var(--gold)]">
          <span className="text-base" aria-hidden>🗺️</span>
          <span>{data.title || "Panoramic Topographical Map"}</span>
          {data.eraPrimary && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--rule)]">
              {data.eraPrimary}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {compareImgSrc && (
            <button
              onClick={() => setShowCompare(!showCompare)}
              className={`text-[10px] font-bold px-2 py-0.5 border rounded cursor-pointer transition-colors ${
                showCompare
                  ? "bg-[var(--gold)] text-black border-transparent"
                  : "bg-transparent text-[var(--ink)] border-[var(--rule)] hover:bg-[var(--surface)]"
              }`}
            >
              {showCompare ? "Single View" : "Time Comparison"}
            </button>
          )}

          <button
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center text-xs font-bold border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--gold-bg)] rounded"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center text-xs font-bold border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--gold-bg)] rounded"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={handleReset}
            className="text-[10px] font-bold px-1.5 py-0.5 border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--gold-bg)] rounded"
            title="Reset View"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Panoramic Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{ height: isFullscreen ? "80vh" : height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="w-full h-full relative transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={data.title || "Panoramic Map View"}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#181512] text-[#e0d6c3] p-6 text-center">
              <span className="text-4xl mb-2" aria-hidden>🗺️</span>
              <p className="font-display font-semibold text-lg">{data.title || "Historical Cartography View"}</p>
              <p className="text-xs text-[#a09580] mt-1 max-w-md">
                Interactive panoramic map projection. Drag to pan across terrain, scroll or click zoom controls to inspect localized cartographic detail.
              </p>
            </div>
          )}

          {/* Time Comparison Overlay Slider */}
          {showCompare && compareImgSrc && (
            <div
              className="absolute inset-0 overflow-hidden border-r-2 border-[var(--gold)]"
              style={{ width: `${compareSplit}%` }}
            >
              <img
                src={compareImgSrc}
                alt="Comparison Map Layer"
                className="w-full h-full object-cover pointer-events-none"
              />
              {data.eraSecondary && (
                <div className="absolute top-3 left-3 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur">
                  {data.eraSecondary}
                </div>
              )}
            </div>
          )}

          {/* Hotspots */}
          {data.hotspots &&
            data.hotspots.map((h) => (
              <button
                key={h.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleHotspotClick(h);
                }}
                className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ left: `${h.xPercent}%`, top: `${h.yPercent}%` }}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--gold)] text-black text-[10px] font-bold shadow-md ring-2 ring-black/40 group-hover:scale-125 transition-transform">
                  📍
                </span>
                <span className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {h.title}
                </span>
              </button>
            ))}
        </div>

        {/* Compare Slider Control */}
        {showCompare && compareImgSrc && (
          <input
            type="range"
            min="0"
            max="100"
            value={compareSplit}
            onChange={(e) => setCompareSplit(Number(e.target.value))}
            className="absolute inset-x-4 bottom-3 z-30 cursor-pointer accent-[var(--gold)]"
          />
        )}
      </div>

      {/* Active Hotspot Info Drawer */}
      {activeHotspot && (
        <div className="p-3 border-t border-[var(--rule)] bg-[var(--surface-elevated)] flex items-start justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-[var(--gold)]">📍 {activeHotspot.title}</span>
            {activeHotspot.description && (
              <p className="text-[var(--ink-secondary)] mt-0.5 leading-snug">{activeHotspot.description}</p>
            )}
          </div>
          <button
            onClick={() => setActiveHotspot(null)}
            className="text-[10px] text-[var(--subtle)] hover:text-[var(--ink)] font-bold px-1.5 py-0.5 border border-[var(--rule)] rounded"
          >
            Close
          </button>
        </div>
      )}

      {/* Caption & Source Footer */}
      {(data.caption || data.source) && (
        <figcaption className="p-2.5 border-t border-[var(--rule)] bg-[var(--surface)] text-[11px] text-[var(--ink-secondary)] flex items-center justify-between">
          <span>{data.caption}</span>
          {data.source && (
            <span className="font-mono text-[9px] text-[var(--subtle)] uppercase tracking-wider">
              Source: {data.source}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
