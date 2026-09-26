"use client";

import { useMemo } from "react";
import type { Block, HeadingBlockData } from "@encarta/core";
import { headingSlug } from "@/lib/heading-id";
import { useActiveHeading } from "../../hooks/useActiveHeading";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function useTocItems(blocks: Block[]): TocItem[] {
  return useMemo(() => {
    const items: TocItem[] = [];
    for (const b of blocks ?? []) {
      if (b.type !== "heading") continue;
      const d = b.data as unknown as HeadingBlockData;
      if (!d?.text) continue;
      const level = d.level ?? 3;
      if (level < 2 || level > 3) continue;
      items.push({ id: headingSlug(d.text), text: d.text, level });
    }
    return items;
  }, [blocks]);
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

export default function ArticleContents({
  blocks,
  variant,
}: {
  blocks: Block[];
  variant: "rail" | "bar";
}) {
  const items = useTocItems(blocks);
  const active = useActiveHeading(items.map((i) => i.id));
  if (items.length < 2) return null;
  if (variant === "rail") {
    return (
      <nav aria-label="Table of contents" className="toc-rail hidden xl:block">
        <p className="claim-rail-title">Contents</p>
        <ol className="toc-list">
          {items.map((item, idx) => {
            const isActive = item.id === active;
            return (
              <li key={item.id}>
                <button
                  onClick={() => scrollTo(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`toc-item${isActive ? " toc-item-active" : ""}${item.level === 3 ? " toc-item-sub" : ""}`}
                >
                  <span className="toc-num">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="toc-label">{item.text}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
  return (
    <nav aria-label="Table of contents" className="toc-bar xl:hidden">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            aria-current={isActive ? "true" : undefined}
            className={`toc-chip${isActive ? " toc-chip-active" : ""}`}
          >
            {item.text}
          </button>
        );
      })}
    </nav>
  );
}
