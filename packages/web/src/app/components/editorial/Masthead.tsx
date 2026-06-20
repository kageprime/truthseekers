import Link from "next/link";
import { CATEGORIES } from "./CategoryIcon";

/**
 * Masthead — the encyclopedia header brand block.
 * Wordmark (Playfair) + dateline + hairline rule + category rail.
 */
export default function Masthead() {
  const now = new Date();
  const month = now.toLocaleDateString("en-US", { month: "long" });
  const year = now.getFullYear();

  return (
    <div className="masthead">
      <div className="flex items-end justify-between px-4 pt-3 pb-1 max-w-[1440px] mx-auto">
        <span className="dateline hidden sm:block" style={{ fontSize: "0.7rem" }}>
          Vol. I · {month} {year} · Living Edition
        </span>
        <Link href="/" className="no-underline">
          <span className="masthead-wordmark text-2xl sm:text-[28px] leading-none" style={{ color: "var(--ink)" }}>
            Truthseekers
          </span>
        </Link>
        <span className="dateline hidden sm:block" style={{ fontSize: "0.7rem" }}>
          Established 2026
        </span>
      </div>
      <div className="masthead-rule-double mx-4" />
    </div>
  );
}

/**
 * CategoryRail — the 13-category browse nav. Renders as a horizontal
 * scroll of understated serif links. Each links to the filtered
 * articles view (route degrades safely until /categories exists).
 */
export function CategoryRail({ counts = {}, compact }: { counts?: Record<string, number>; compact?: boolean }) {
  return (
    <nav className="category-rail overflow-x-auto max-w-[1440px] mx-auto" style={{ scrollbarWidth: "none", padding: compact ? "4px 16px 6px" : "8px 16px" }}>
      <ul className="flex items-center gap-4 justify-center flex-nowrap" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {CATEGORIES.map((cat) => (
          <li key={cat.slug} className="flex-shrink-0">
            <Link
              href={`/articles?cat=${encodeURIComponent(cat.slug)}`}
              className="font-serif text-sm no-underline relative category-link"
              style={{ color: "var(--ink-secondary)" }}
            >
              {cat.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
