"use client";

import { useState, useMemo } from "react";
import type { Block, HeadingBlockData } from "@encarta/core";
import { useIntersectionToc } from "../hooks/useIntersectionToc";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function ArticleTocDrawer({ blocks }: { blocks: Block[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeSections = useIntersectionToc();

  const headings = useMemo<TocItem[]>(() => {
    if (!blocks || !blocks.length) return [];
    const items: TocItem[] = [];

    blocks.forEach((block) => {
      if (block.type === "heading") {
        const data = block.data as unknown as HeadingBlockData;
        if (data && data.text) {
          const id = data.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          items.push({
            id,
            text: data.text,
            level: data.level ?? 3,
          });
        }
      }
    });

    return items;
  }, [blocks]);

  if (headings.length === 0) return null;

  const handleSelect = (id: string) => {
    setIsOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* Mobile Floating TOC Toggle Button — Left Side */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed left-4 top-[40%] z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-transform duration-200 active:scale-95"
        style={{
          background: "var(--surface-elevated, #fff)",
          borderColor: "var(--border, #d4c9ab)",
          color: "var(--accent, #a67c2f)",
        }}
        aria-label="Contents"
        title="Article Contents"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>

      {/* Drawer Overlay & Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Side Drawer */}
          <aside
            className="relative w-72 max-w-[80vw] h-full flex flex-col shadow-2xl transition-transform duration-300 animate-slide-in-left"
            style={{
              background: "var(--surface, #f5efe0)",
              borderRight: "1px solid var(--border, #d4c9ab)",
            }}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border-light, #e8dcc0)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
                  Contents
                </span>
                <span className="text-xs text-subtle font-mono">({headings.length})</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-black/5"
                style={{ color: "var(--muted)" }}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* List */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {headings.map((item) => {
                const isActive = activeSections.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full text-left py-2 px-3 rounded text-sm transition-colors flex items-center justify-between ${
                      item.level === 3 ? "pl-6 text-xs" : item.level === 1 ? "font-bold text-base" : "font-medium"
                    }`}
                    style={{
                      color: isActive ? "var(--accent)" : "var(--ink)",
                      background: isActive ? "var(--accent-bg)" : "transparent",
                    }}
                  >
                    <span className="truncate">{item.text}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
