"use client";

import { BASE } from "@/lib/api";
import { IconImage } from "./Icons";

export function SkeletonImage({ caption }: { caption?: string }) {
  return (
    <div className="glass-card-static p-3 my-2" style={{ background: "var(--border-light)" }}>
      <span className="text-xs font-medium text-[#888]">IMAGE</span>
      <div
        className="h-40 flex items-center justify-center my-2 border-2 border-dashed border-black/20 relative overflow-hidden"
        style={{ background: "white" }}
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
      {caption && <p className="text-sm text-[#666]">{caption}</p>}
      <p className="text-xs sm:text-[10px] text-[#aaa] mt-1">Image resolving...</p>
    </div>
  );
}

export function BlankSlateImage({ caption, prompt }: { caption?: string; prompt?: string }) {
  return (
    <div className="glass-card-static p-3 my-2" style={{ background: "var(--cream)", borderStyle: "dashed" }}>
      <span className="text-xs font-medium text-[#888]">IMAGE</span>
      <div className="h-32 flex items-center justify-center text-3xl opacity-50 my-2 border-2 border-dashed border-black/20 bg-white/50">
        <IconImage size={16} />
      </div>
      {caption && <p className="text-sm font-medium">{caption}</p>}
      {prompt && (
        <details className="mt-1">
          <summary className="text-xs sm:text-[10px] cursor-pointer text-[#888]">Search prompt</summary>
          <p className="text-xs mt-1 p-2 bg-white border">{prompt}</p>
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
      <p className="text-xs sm:text-[10px] text-[#aaa] text-center mt-1">Media suggestions pending</p>
    </div>
  );
}

export function MediaImage({ src, caption, prompt }: { src?: string; caption?: string; prompt?: string }) {
  if (src) {
    return <FigureImage src={src} caption={caption || "Image"} />;
  }
  if (prompt) {
    return <SkeletonImage caption={caption} />;
  }
  return <BlankSlateImage caption={caption} prompt={prompt} />;
}

export function FigureImage({ src, caption, source }: { src: string; caption: string; source?: string }) {
  const resolvedSrc = src.startsWith("/") ? `${BASE}${src}` : src;
  return (
    <figure className="glass-card-static p-3 my-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#888]">IMAGE</span>
        {source && <span className="text-[9px] text-[#888]">via {source}</span>}
      </div>
      <div className="flex justify-center my-2 bg-white/50">
        <img src={resolvedSrc} alt={caption} className="max-w-full max-h-96 object-contain" loading="lazy" />
      </div>
      <figcaption className="text-sm text-[#555] mt-2">{caption}</figcaption>
    </figure>
  );
}
