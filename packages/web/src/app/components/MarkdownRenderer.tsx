"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents, markdownInlineComponents } from "./markdownComponents";

// Fences, display math, and \(...\) / \[...\] — single dollars are plain
// text (singleDollarTextMath is off), so prices never trigger the rich chunk.
const RICH_RE = /```|\$\$|\\\(|\\\[/;

function MarkdownLite({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

// Inline fragment renderer for anchored sentences: same GFM handling, but
// block elements collapse so text and citation markers share one line.
export function MarkdownInline({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownInlineComponents}>
      {content}
    </ReactMarkdown>
  );
}

// Rich renderer (KaTeX + Prism + Refractor) prefetches on need and swaps in
// over the lite render — text is visible instantly and upgrades in place.
// The import() split point keeps the heavy deps out of the initial bundle.
export default function MarkdownRenderer({ content }: { content: string }) {
  const needsRich = RICH_RE.test(content);
  const [Rich, setRich] = useState<React.ComponentType<{ content: string }> | null>(null);

  useEffect(() => {
    if (!needsRich) return;
    let live = true;
    import("./MarkdownRich").then((mod) => {
      if (live) setRich(() => mod.default);
    });
    return () => {
      live = false;
    };
  }, [needsRich]);

  if (needsRich && Rich) {
    return <Rich content={content} />;
  }
  return <MarkdownLite content={content} />;
}
