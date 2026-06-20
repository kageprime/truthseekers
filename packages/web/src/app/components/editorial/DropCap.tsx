import { type ReactNode } from "react";

/**
 * DropCap — wraps children so the first letter renders as a large
 * gold Playfair initial spanning ~3 lines.
 * Apply to a single <p> or the first paragraph of an article.
 */
export default function DropCap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`drop-cap ${className}`}>{children}</p>;
}
