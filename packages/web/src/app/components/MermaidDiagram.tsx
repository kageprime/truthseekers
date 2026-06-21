"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidInit = false;
function ensureMermaid() {
  if (!mermaidInit) {
    mermaid.initialize({ startOnLoad: false, theme: "neutral" });
    mermaidInit = true;
  }
}

export default function MermaidDiagram({ code, caption }: { code?: string; caption?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "rendered" | "error" | "edit">("loading");
  const [editCode, setEditCode] = useState(code?.trim() || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [zoomed, setZoomed] = useState(false);

  async function render(codeStr?: string) {
    ensureMermaid();
    const trimmed = (codeStr || "").trim();
    if (!containerRef.current || !trimmed) {
      setState("error");
      setErrorMsg("No diagram code provided");
      return;
    }

    setState("loading");
    setErrorMsg("");

    try {
      const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
      const { svg } = await mermaid.render(id, trimmed);
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        setState("rendered");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to render diagram");
      setState("error");
    }
  }

  useEffect(() => {
    render(code || "");
  }, [code]);

  function handleEditSubmit() {
    render(editCode);
  }

  return (
    <div className="glass-card-static p-4 my-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#888]">DIAGRAM</span>
        <div className="flex gap-1">
          {state === "error" && (
            <button
              onClick={() => { setState("edit"); setEditCode((code || "").trim()); }}
              className="text-xs border border-black px-1 py-1 min-h-[44px] sm:min-h-0 cursor-pointer bg-white"
            >
              EDIT
            </button>
          )}
          {state === "rendered" && (
            <button
              onClick={() => setZoomed(!zoomed)}
              className="text-xs border border-black px-1 py-1 min-h-[44px] sm:min-h-0 cursor-pointer bg-white"
            >
              {zoomed ? "−" : "+"}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm font-medium mb-3">{caption}</p>

      {state === "loading" && (
        <div className="flex items-center justify-center h-32 border-2 border-dashed border-black/20 bg-white/50">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-3 border-[var(--border)] border-t-[#1c1917] rounded-full"
              style={{ animation: "spin 0.8s linear infinite" }} />
            <p className="text-xs text-[#888] mt-2">Rendering diagram...</p>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="p-3 text-sm" style={{ background: "#fef2f2", border: "1px solid #dc2626", color: "#dc2626" }}>
          <p className="font-bold mb-1">Invalid diagram</p>
          <p className="text-xs mb-2">{errorMsg}</p>
          <details className="mt-1">
            <summary className="text-xs cursor-pointer font-medium">View raw code</summary>
            <pre className="mt-1 p-2 bg-white text-xs overflow-auto max-h-32 border border-[#ccc]">{code}</pre>
          </details>
        </div>
      )}

      {state === "edit" && (
        <div className="space-y-2">
          <textarea
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            className="w-full h-40 text-xs font-mono p-3 border-2 border-black bg-white resize-y"
            style={{ outline: "none" }}
          />
          <div className="flex gap-2">
            <button onClick={handleEditSubmit} className="text-xs font-medium bg-[var(--accent)] text-white px-3 py-3 sm:py-1 min-h-[44px] border border-black">
              RENDER
            </button>
            <button onClick={() => setState("error")} className="text-xs font-medium border border-black px-3 py-3 sm:py-1 min-h-[44px] bg-white">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {state === "rendered" && (
        <div
          ref={containerRef}
          className="flex justify-center p-3 bg-white overflow-auto"
          style={{
            minHeight: 60,
            maxHeight: zoomed ? "none" : "min(400px, 60vh)",
            transition: "max-height 0.3s",
            border: "1px solid #eee",
          }}
        />
      )}
    </div>
  );
}
