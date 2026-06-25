"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import HTMLFlipBook from "react-pageflip";
import { useArticleView } from "../ArticleViewContext";
import BlockRenderer from "./BlockRenderer";
import Fleuron from "./editorial/Fleuron";
import ViewSwitcher from "./ViewSwitcher";
import type { Block } from "@encarta/core";

interface PageData {
  blocks: Block[];
  label: string;
}

function splitIntoPages(blocks: Block[]): [string, PageData[]] {
  if (!blocks.length) return ["Untitled", []];
  const title = blocks.find((b) => b.type === "heading")?.data as Record<string, unknown> | undefined;
  const titleText = (title?.text as string) ?? "Article";
  const pages: PageData[] = [];
  let current: Block[] = [];
  let headingIdx = 0;

  for (const b of blocks) {
    if (b.type === "heading" && current.length > 0 && headingIdx > 0) {
      pages.push({ blocks: current, label: `Page ${pages.length + 1}` });
      current = [];
    }
    if (b.type === "heading") headingIdx++;
    current.push(b);
  }
  if (current.length) pages.push({ blocks: current, label: `Page ${pages.length + 1}` });

  if (pages.length === 1 && pages[0].blocks.length > 4) {
    const flat = pages[0].blocks;
    const mid = Math.ceil(flat.length / 2);
    pages[0] = { blocks: flat.slice(0, mid), label: "Page 1" };
    pages.splice(1, 0, { blocks: flat.slice(mid), label: "Page 2" });
  }

  return [titleText, pages];
}

const PAGE_BG = "#f5efe6";
const PAGE_BG_ALT = "#efe8dc";

export default function PressView() {
  const { article, mode, close } = useArticleView();
  const bookRef = useRef<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [titleText, pages] = useMemo(() => splitIntoPages(article?.blocks ?? []), [article?.blocks]);
  const totalPages = pages.length;

  useEffect(() => {
    setCurrentIdx(0);
  }, [article]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") bookRef.current?.pageFlip()?.flipNext?.();
      if (e.key === "ArrowLeft") bookRef.current?.pageFlip()?.flipPrev?.();
    }
    if (article && mode === "press") window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [article, mode, close]);

  const onFlip = useCallback((e: any) => {
    setCurrentIdx(e.data ?? 0);
  }, []);

  if (!article || mode !== "press" || !pages.length) return null;

  return (
    <div className="fixed inset-0 flex flex-col bg-surface" style={{ zIndex: "var(--z-explore-press)" }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 h-12 bg-surface border-b border-rule">
        <button onClick={close} className="inline-flex items-center gap-1.5 text-xs font-medium dateline hover:underline text-gold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Chat
        </button>
        <div className="flex items-center gap-3">
          <ViewSwitcher />
          <span className="text-[10px] text-subtle">
            {currentIdx + 1} / {totalPages}
          </span>
        </div>
      </div>

      {/* Book area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden select-none">
        {/* Left arrow */}
        <button
          onClick={() => bookRef.current?.pageFlip()?.flipPrev?.()}
          disabled={currentIdx === 0}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full transition-opacity z-10 text-gold"
          style={{ opacity: currentIdx === 0 ? 0.2 : 0.6 }}
          aria-label="Previous page"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Book */}
        <div className="relative flex-1" style={{ maxWidth: "900px", height: "100%" }}>
          <HTMLFlipBook
            ref={bookRef}
            width={550}
            height={750}
            size="stretch"
            minWidth={300}
            maxWidth={900}
            minHeight={400}
            maxHeight={1000}
            startPage={0}
            drawShadow
            flippingTime={800}
            usePortrait={false}
            showCover={false}
            mobileScrollSupport
            clickEventForward
            useMouseEvents
            showPageCorners
            swipeDistance={30}
            disableFlipByClick={false}
            startZIndex={0}
            autoSize
            maxShadowOpacity={0.5}
            onFlip={onFlip}
            className=""
            style={{}}
          >
            {pages.map((page, i) => (
              <div key={i} className="press-page-inner" style={{ background: i % 2 === 0 ? PAGE_BG : PAGE_BG_ALT, padding: "2rem 1.75rem", height: "100%", boxSizing: "border-box" }}>
                <div className="h-full overflow-y-auto">
                  <div className={`newspaper-columns ${i === 0 ? "front-page" : ""}`}>
                    {i === 0 && (
                      <>
                        <h1 className="press-headline font-serif text-2xl sm:text-3xl leading-tight mb-4 text-center text-ink">
                          {titleText}
                        </h1>
                        <div className="mx-auto mb-5 h-[2px] w-14 bg-gold" />
                      </>
                    )}
                    <BlockRenderer blocks={page.blocks} />
                    <div className="mt-6 text-center"><Fleuron /></div>
                  </div>
                </div>
              </div>
            ))}
          </HTMLFlipBook>
        </div>

        {/* Right arrow */}
        <button
          onClick={() => bookRef.current?.pageFlip()?.flipNext?.()}
          disabled={currentIdx === totalPages - 1}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full transition-opacity z-10 text-gold"
          style={{ opacity: currentIdx === totalPages - 1 ? 0.2 : 0.6 }}
          aria-label="Next page"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}