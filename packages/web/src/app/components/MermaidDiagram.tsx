"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    mermaid: {
      initialize: (config: Record<string, unknown>) => void;
      render: (id: string, code: string) => Promise<{ svg: string }>;
    };
  }
}

let mermaidLoaded = false;
let mermaidLoading: Promise<void> | null = null;

function loadMermaid(): Promise<void> {
  if (mermaidLoaded) return Promise.resolve();
  if (mermaidLoading) return mermaidLoading;

  mermaidLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = () => {
      window.mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      mermaidLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Mermaid"));
    document.head.appendChild(script);
  });

  return mermaidLoading;
}

export default function MermaidDiagram({ code, caption }: { code: string; caption: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return;

    let cancelled = false;

    async function render() {
      try {
        await loadMermaid();

        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
        if (cancelled || !containerRef.current) return;

        const { svg } = await window.mermaid.render(id, code.trim());
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;

        const svgEl = containerRef.current.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "100%";
          svgEl.style.maxHeight = zoomed ? "none" : "400px";
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code, zoomed]);

  return (
    <div className="pixel-card-sm p-4 my-3" style={{ background: "white" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="pixel text-[9px] text-[#888]">DIAGRAM</span>
        <button
          onClick={() => setZoomed(!zoomed)}
          className="pixel text-[8px] border border-black px-1 cursor-pointer bg-white"
        >
          {zoomed ? "−" : "+"}
        </button>
      </div>
      <p className="text-sm font-medium mb-3">{caption}</p>
      {error ? (
        <div className="p-3 text-sm" style={{ background: "#fef2f2", border: "1px solid #dc2626", color: "#dc2626" }}>
          Failed to render: {error}
          <details className="mt-1">
            <summary className="text-xs cursor-pointer">View source</summary>
            <pre className="mt-1 p-2 bg-white text-xs overflow-auto max-h-32"
              style={{ border: "1px solid #ccc" }}>
              {code}
            </pre>
          </details>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex justify-center p-3 bg-white overflow-auto"
          style={{
            minHeight: 60,
            maxHeight: zoomed ? "none" : 400,
            transition: "max-height 0.3s",
            border: "1px solid #eee",
          }}
        />
      )}
    </div>
  );
}
