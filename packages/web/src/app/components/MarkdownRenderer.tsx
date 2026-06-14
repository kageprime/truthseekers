"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-1 right-1 px-2 py-0.5 text-[10px] font-sans rounded opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ background: "#333", color: "#ccc" }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        table({ children }) {
          return (
            <div style={{ overflowX: "auto", margin: "1rem 0" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "3px solid #1c1917",
                  boxShadow: "4px 4px 0 rgba(28,25,23,0.1)",
                }}
              >
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th
              style={{
                padding: "0.5rem 0.75rem",
                border: "2px solid #1c1917",
                background: "#fef3c7",
                textAlign: "left",
                fontFamily: "'Press Start 2P',monospace",
                fontSize: "0.65rem",
              }}
            >
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td
              style={{
                padding: "0.4rem 0.75rem",
                border: "1.5px solid #ddd",
                fontSize: "0.9rem",
              }}
            >
              {children}
            </td>
          );
        },
        code({ className, children, ...props }) {
          const isInline = !className;
          if (isInline) {
          return (
            <code
              style={{
                background: "#f0f0f0",
                padding: "0.15rem 0.4rem",
                fontSize: "0.9em",
                border: "1px solid #ddd",
              }}
                {...props}
              >
                {children}
              </code>
            );
          }
          const codeText = String(children).replace(/\n$/, "");
          return (
            <div className="relative group">
              <CopyButton text={codeText} />
              <pre
                style={{
                  background: "#1a1a2e",
                  color: "#e0e0e0",
                  padding: "1rem",
                  overflowX: "auto",
                  fontSize: "0.85rem",
                  lineHeight: "1.4",
                  margin: "0.75rem 0",
                }}
              >
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#2563eb", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              {children}
            </a>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote
              style={{
                padding: "0.75rem 1rem",
                margin: "1rem 0",
                background: "var(--cream)",
                fontStyle: "italic",
                border: "2px solid var(--ink)",
              }}
            >
              {children}
            </blockquote>
          );
        },
        h1({ children }) {
          return (
            <h1
              style={{
                fontWeight: 800,
                fontSize: "1.5rem",
                marginTop: "1.5rem",
                marginBottom: "0.5rem",
              }}
            >
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2
              style={{
                fontWeight: 800,
                fontSize: "1.3rem",
                marginTop: "1.5rem",
                marginBottom: "0.5rem",
                borderBottom: "2px solid #e0e0e0",
                paddingBottom: "0.25rem",
              }}
            >
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3
              style={{
                fontWeight: 700,
                fontSize: "1.1rem",
                marginTop: "1.25rem",
                marginBottom: "0.5rem",
              }}
            >
              {children}
            </h3>
          );
        },
        hr() {
          return (
            <hr
              style={{
                border: "none",
                borderTop: "2px solid var(--ink)",
                margin: "1.5rem 0",
              }}
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
