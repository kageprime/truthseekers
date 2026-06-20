import { type ReactNode } from "react";

/**
 * PullQuote — Playfair italic, oversized, gold left rule.
 * Use to lift a striking line out of the body.
 */
export default function PullQuote({ children, cite, className = "" }: { children: ReactNode; cite?: string; className?: string }) {
  return (
    <blockquote className={`pull-quote ${className}`}>
      {children}
      {cite && <footer className="dateline" style={{ marginTop: "0.75rem", fontSize: "0.7rem" }}>— {cite}</footer>}
    </blockquote>
  );
}
