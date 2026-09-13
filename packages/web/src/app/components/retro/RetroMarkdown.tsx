"use client";
import MarkdownRenderer from "../MarkdownRenderer";

// ponytail: one markdown skin — GFM tables, KaTeX, prism code all inherit retro paper.
export default function RetroMarkdown({ content }: { content: string }) {
  return (
    <div className="r-md">
      <MarkdownRenderer content={content} />
    </div>
  );
}
