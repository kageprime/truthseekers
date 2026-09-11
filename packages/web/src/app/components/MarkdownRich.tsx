"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePrism from "rehype-prism-plus";
import "katex/dist/katex.min.css";
import { markdownComponents } from "./markdownComponents";

// Full-fidelity renderer: math + syntax highlighting. Lives in its own
// chunk behind content detection in MarkdownRenderer — KaTeX, Prism and
// Refractor never join the initial bundle.
export default function MarkdownRich({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
      rehypePlugins={[rehypeKatex, rehypePrism]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
