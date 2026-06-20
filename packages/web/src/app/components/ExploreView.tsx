"use client";

import { useEffect, useRef } from "react";
import { useArticleView } from "../ArticleViewContext";
import BlockRenderer from "./BlockRenderer";
import Fleuron from "./editorial/Fleuron";
import ViewSwitcher from "./ViewSwitcher";
import type { Block } from "@encarta/core";

export default function ExploreView() {
  const { article, mode, close } = useArticleView();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [article]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (article) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [article, close]);

  if (!article || mode !== "explore") return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col animate-fade-in" style={{ background: "var(--surface)" }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>
        <button
          onClick={close}
          className="inline-flex items-center gap-1.5 text-xs font-medium dateline hover:underline"
          style={{ color: "var(--gold)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Chat
        </button>
        <ViewSwitcher />
      </div>

      {/* Journal content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <article className="max-w-[42rem] mx-auto px-6 py-12 sm:py-16">
          {/* Title */}
          <h1 className="t-display text-3xl sm:text-4xl leading-tight mb-6" style={{ color: "var(--ink)" }}>
            {article.title}
          </h1>
          <div className="mb-8" style={{ height: 2, width: "3.5rem", background: "var(--gold)" }} />

          {/* Blocks with full editorial rendering */}
          <div className="drop-cap">
            <BlockRenderer blocks={article.blocks} />
          </div>

          <div className="mt-12"><Fleuron /></div>
        </article>
      </div>
    </div>
  );
}
