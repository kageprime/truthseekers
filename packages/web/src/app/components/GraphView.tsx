"use client";

import { useEffect, useState, useCallback } from "react";
import { useArticleView } from "../ArticleViewContext";
import { fetchArticleGraph } from "@/lib/api";
import ClaimGraph from "./ClaimGraph";
import ViewSwitcher from "./ViewSwitcher";
import type { GraphNode, GraphLink } from "@/lib/api";

export default function GraphView() {
  const { article, mode, close } = useArticleView();
  const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!article || mode !== "graph") { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    // derive slug from title
    const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    fetchArticleGraph(slug).then((res) => {
      if (cancelled) return;
      if (res) setData(res);
      else setError("No graph data available");
    }).catch((e) => {
      if (!cancelled) setError(e.message ?? "Failed to load graph");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [article, mode]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (article && mode === "graph") window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [article, mode, close]);

  if (!article || mode !== "graph") return null;

  return (
    <div className="fixed inset-0 flex flex-col bg-surface" style={{ zIndex: "var(--z-explore-press)" }}>
      <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-rule bg-surface">
        <button onClick={close} className="inline-flex items-center gap-1.5 text-xs font-medium dateline hover:underline text-gold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Chat
        </button>
        <div className="flex items-center gap-2">
          <a
            href={`https://github.com/kageprime/veritas/issues/new?title=Graph%20feedback%20-%20${article.title}&body=Article:%20${article.title}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-subtle hover:text-gold transition-colors"
          >
            Report issue
          </a>
          <ViewSwitcher />
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-10">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center h-full text-subtle text-xs">{error}</div>
        )}
        {data && <ClaimGraph nodes={data.nodes} links={data.links} />}
      </div>
    </div>
  );
}
