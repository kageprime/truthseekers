"use client";

import { useState } from "react";
import BlockRenderer from "./BlockRenderer";
import { useArticleView } from "../ArticleViewContext";
import type { Block } from "@encarta/core";

interface ArticleBlockProps {
  blocks: Block[];
}

export default function ArticleBlock({ blocks }: ArticleBlockProps) {
  const { open } = useArticleView();
  const [expanded, setExpanded] = useState(false);

  const title = extractTitle(blocks);
  const image = extractImage(blocks);
  const abstract = extractAbstract(blocks);

  return (
    <div className="plate overflow-hidden" style={{ marginTop: "0.75rem" }}>
      {/* Thumbnail */}
      {image && (
        <div className="w-full aspect-[2/1] overflow-hidden" style={{ background: "var(--surface)" }}>
          <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="p-5 space-y-3">
        {/* Title */}
        {title && (
          <h3 className="t-title text-lg leading-tight" style={{ color: "var(--ink)" }}>
            {title}
          </h3>
        )}

        {/* Abstract */}
        {abstract && (
          <p className="font-serif text-sm leading-relaxed line-clamp-3" style={{ color: "var(--ink-secondary)" }}>
            {abstract}
          </p>
        )}

        {/* Gold rule */}
        <div style={{ height: 1, background: "var(--gold)", opacity: 0.4 }} />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((o) => !o)}
            className="btn btn-sm btn-secondary"
          >
            {expanded ? "Collapse" : "Read in chat"}
          </button>
          <button
            onClick={() => open(title ?? "Article", blocks)}
            className="btn btn-sm btn-secondary"
            style={{ color: "var(--gold)", borderColor: "var(--gold)" }}
          >
            Explore
          </button>
          <button
            onClick={() => open(title ?? "Article", blocks, "press")}
            className="btn btn-sm btn-secondary"
            style={{ color: "var(--ink-secondary)" }}
          >
            Newspaper
          </button>
        </div>

        {/* Expanded blocks */}
        {expanded && (
          <div className="pt-2 border-t" style={{ borderColor: "var(--rule)" }}>
            <BlockRenderer blocks={blocks} compact />
          </div>
        )}
      </div>
    </div>
  );
}

function extractTitle(blocks: Block[]): string | null {
  for (const b of blocks) {
    if (b.type === "heading") {
      const d = b.data as Record<string, unknown>;
      return (d.text as string) ?? null;
    }
  }
  return null;
}

function extractImage(blocks: Block[]): string | null {
  for (const b of blocks) {
    if (b.type === "image") {
      const d = b.data as Record<string, unknown>;
      return (d.src as string) ?? null;
    }
  }
  return null;
}

function extractAbstract(blocks: Block[]): string | null {
  for (const b of blocks) {
    if (b.type === "text") {
      const d = b.data as Record<string, unknown>;
      const content = (d.content as string) ?? "";
      const cleaned = content.replace(/<[^>]*>/g, "").trim();
      if (cleaned.length > 0) return cleaned;
    }
  }
  return null;
}
