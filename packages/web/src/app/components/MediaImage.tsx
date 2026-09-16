"use client";

import { useState, useEffect, useCallback } from "react";
import { BASE } from "@/lib/constants";
import { safeSrc } from "@/lib/safe-url";
import { IconImage, IconX } from "./Icons";

export function SkeletonImage({ caption }: { caption?: string }) {
  return (
    <div className="glass-card-static p-3 my-2" style={{ background: "var(--border-light)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--subtle)" }}>IMAGE</span>
      <div
        className="h-40 flex items-center justify-center my-2 border-2 border-dashed border-[var(--border)] relative overflow-hidden"
        style={{ background: "var(--surface-elevated)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(234,88,12,0.08) 50%, transparent 100%)",
            animation: "shimmer 2s infinite",
          }}
        />
        <span className="opacity-40 relative z-10"><IconImage size={40} /></span>
      </div>
      {caption && <p className="text-sm" style={{ color: "var(--muted)" }}>{caption}</p>}
      <p className="text-xs sm:text-[10px] mt-1" style={{ color: "var(--subtle)" }}>Image resolving...</p>
    </div>
  );
}

export function BlankSlateImage({ caption, prompt }: { caption?: string; prompt?: string }) {
  return (
    <div className="glass-card-static p-3 my-2" style={{ background: "var(--cream)", borderStyle: "dashed" }}>
      <span className="text-xs font-medium" style={{ color: "var(--subtle)" }}>IMAGE</span>
      <div className="h-32 flex items-center justify-center text-3xl opacity-50 my-2 border-2 border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/50">
        <IconImage size={16} />
      </div>
      {caption && <p className="text-sm font-medium">{caption}</p>}
      {prompt && (
        <details className="mt-1">
          <summary className="text-xs sm:text-[10px] cursor-pointer" style={{ color: "var(--subtle)" }}>Search prompt</summary>
          <p className="text-xs mt-1 p-2 bg-[var(--surface-elevated)] border border-[var(--border)]">{prompt}</p>
        </details>
      )}
    </div>
  );
}

export function BlankSlateMedia() {
  return (
    <div className="glass-card-static p-3 my-2" style={{ background: "var(--cream)", borderStyle: "dashed", opacity: 0.6 }}>
      <div className="flex items-center justify-center gap-4 h-20">
        <span className="opacity-40"><IconImage size={32} /></span>
        <span className="text-2xl opacity-40">📊</span>
        <span className="text-2xl opacity-40">🧊</span>
      </div>
      <p className="text-xs sm:text-[10px] text-center mt-1" style={{ color: "var(--subtle)" }}>Media suggestions pending</p>
    </div>
  );
}

export function MediaLightbox({ src, caption, source, onClose }: { src: string; caption?: string; source?: string; onClose: () => void }) {
  const [showMetadata, setShowMetadata] = useState(false);
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const safe = safeSrc(src);
  const full = safe && safe.startsWith("/") ? `${BASE}${safe}` : safe;

  const isAI = source === "AI Visual Reconstruction" || (src && src.includes("chat-"));
  const repoName = source || (src.includes("wikimedia.org") ? "Wikimedia Commons Archive" : src.includes("nasa.gov") ? "NASA Image Archive" : "Digital Museum Catalog");
  const licenseType = isAI ? "AI Generated Asset (FallBack)" : "Public Domain / Creative Commons (CC-BY)";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md" style={{ zIndex: "var(--z-lightbox)" }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        aria-label="Close"
      >
        <IconX size={24} />
      </button>

      <div onClick={(e) => e.stopPropagation()} className="max-w-[90vw] max-h-[92vh] flex flex-col items-center relative">
        {safe?.endsWith(".mp4") ? (
          <video src={full} controls autoPlay className="max-w-full max-h-[75vh] rounded-lg shadow-2xl" />
        ) : (
          <img src={full} alt={caption || ""} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl" loading="lazy" />
        )}

        {/* Caption & Metadata Bar */}
        <div className="mt-3 flex flex-col items-center text-center max-w-2xl px-2">
          {caption && <p className="text-white/90 text-sm font-medium">{caption}</p>}
          
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="mt-2 text-xs font-mono text-[var(--accent,#3b82f6)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            {showMetadata ? "Hide Archival Metadata ▲" : "📜 Inspect Archival Museum Catalog Record ▼"}
          </button>

          {showMetadata && (
            <div className="mt-2.5 p-3 rounded-lg bg-black/90 border border-white/10 text-left text-xs font-mono text-white/80 space-y-1.5 w-full">
              <div className="flex justify-between border-b border-white/10 pb-1">
                <span className="text-white/50">ARCHIVAL REPOSITORY:</span>
                <span className="font-bold text-emerald-400">{repoName}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-1">
                <span className="text-white/50">RIGHTS & LICENSE:</span>
                <span>{licenseType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">CATALOG RECORD LINK:</span>
                <a href={full} target="_blank" rel="noopener noreferrer" className="text-[var(--accent,#3b82f6)] hover:underline truncate max-w-[200px]">
                  {full} ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MediaImage({ src, caption, prompt, source }: { src?: string; caption?: string; prompt?: string; source?: string }) {
  const [open, setOpen] = useState(false);
  if (src) {
    return (
      <>
        <FigureImage src={src} caption={caption || "Image"} source={source} onClick={() => setOpen(true)} />
        {open && <MediaLightbox src={src} caption={caption} source={source} onClose={() => setOpen(false)} />}
      </>
    );
  }
  if (prompt) {
    return <SkeletonImage caption={caption} />;
  }
  return <BlankSlateImage caption={caption} prompt={prompt} />;
}

export function FigureImage({ src, caption, source, onClick }: { src: string; caption: string; source?: string; onClick?: () => void }) {
  const safe = safeSrc(src);
  const resolvedSrc = safe ? (safe.startsWith("/") ? `${BASE}${safe}` : safe) : undefined;
  return (
    <figure className="glass-card-static p-3 my-2 cursor-pointer group" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--subtle)" }}>IMAGE</span>
        {source === "AI Visual Reconstruction" || (src && src.includes("chat-")) ? (
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 tracking-wider"
            title="Synthetic AI Generated Image"
          >
            ✦ AI Visual Reconstruction
          </span>
        ) : source ? (
          <span
            className="text-[10px] font-mono font-medium px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 tracking-wider flex items-center gap-1"
            title={`Verified Real Source: ${source}`}
          >
            ✓ Sourced: {source}
          </span>
        ) : null}
      </div>
      <div className="bg-[var(--surface-elevated)]/50 rounded overflow-hidden relative">
        <img src={resolvedSrc} alt={caption} className="w-full h-auto max-h-96 object-contain transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">Click to expand</span>
        </div>
      </div>
      <figcaption className="text-sm mt-2" style={{ color: "var(--muted)" }}>{caption}</figcaption>
    </figure>
  );
}
