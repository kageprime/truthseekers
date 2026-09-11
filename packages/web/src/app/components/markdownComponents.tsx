"use client";

import { useState } from "react";
import { safeUrl } from "@/lib/safe-url";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-sans rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ background: "var(--background)", color: "var(--subtle)", border: "1px solid var(--border)" }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Shared element overrides for both markdown variants (lite + rich) so the
// two renderers never drift apart visually.
export const markdownComponents = {
  p({ children }: any) {
    return <p style={{ margin: "0.5rem 0", lineHeight: "1.7", color: "var(--ink)" }}>{children}</p>;
  },
  table({ children }: any) {
    return (
      <div style={{ overflowX: "auto", margin: "1rem 0", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          {children}
        </table>
      </div>
    );
  },
  th({ children }: any) {
    return (
      <th
        style={{
          padding: "0.5rem 0.75rem",
          borderBottom: "2px solid var(--border)",
          background: "var(--surface-glass)",
          textAlign: "left",
          fontWeight: 600,
          fontSize: "0.8rem",
          color: "var(--ink)",
        }}
      >
        {children}
      </th>
    );
  },
  td({ children }: any) {
    return (
      <td
        style={{
          padding: "0.4rem 0.75rem",
          borderBottom: "1px solid var(--border)",
          fontSize: "0.85rem",
          color: "var(--ink)",
        }}
      >
        {children}
      </td>
    );
  },
  code({ className, children, ...props }: any) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          style={{
            background: "var(--surface-glass)",
            padding: "0.15rem 0.4rem",
            fontSize: "0.85em",
            borderRadius: "0.25rem",
            border: "1px solid var(--border)",
            color: "var(--ink)",
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
            background: "var(--surface-glass)",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            padding: "1rem",
            overflowX: "auto",
            fontSize: "0.85rem",
            lineHeight: "1.5",
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
  a({ href, children }: any) {
    return (
      <a
        href={safeUrl(href)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "2px", textDecorationColor: "var(--border)" }}
      >
        {children}
      </a>
    );
  },
  blockquote({ children }: any) {
    return (
      <blockquote
        style={{
          padding: "0.75rem 1rem",
          margin: "1rem 0",
          borderLeft: "3px solid var(--accent)",
          background: "var(--surface-glass)",
          borderRadius: "0.5rem",
          color: "var(--muted)",
          fontStyle: "italic",
        }}
      >
        {children}
      </blockquote>
    );
  },
  h1({ children }: any) {
    return (
      <h1
        style={{
          fontWeight: 700,
          fontSize: "1.4rem",
          marginTop: "1.5rem",
          marginBottom: "0.5rem",
          color: "var(--ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {children}
      </h1>
    );
  },
  h2({ children }: any) {
    return (
      <h2
        style={{
          fontWeight: 600,
          fontSize: "1.2rem",
          marginTop: "1.5rem",
          marginBottom: "0.5rem",
          color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </h2>
    );
  },
  h3({ children }: any) {
    return (
      <h3
        style={{
          fontWeight: 600,
          fontSize: "1.05rem",
          marginTop: "1.25rem",
          marginBottom: "0.5rem",
          color: "var(--ink)",
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
          borderTop: "1px solid var(--border)",
          margin: "1.5rem 0",
        }}
      />
    );
  },
  ul({ children }: any) {
    return <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", lineHeight: "1.7", color: "var(--ink)" }}>{children}</ul>;
  },
  ol({ children }: any) {
    return <ol style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", lineHeight: "1.7", color: "var(--ink)" }}>{children}</ol>;
  },
  li({ children }: any) {
    return <li style={{ margin: "0.15rem 0" }}>{children}</li>;
  },
  strong({ children }: any) {
    return <strong style={{ fontWeight: 600 }}>{children}</strong>;
  },
  em({ children }: any) {
    return <em style={{ fontStyle: "italic" }}>{children}</em>;
  },
};
