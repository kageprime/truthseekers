/**
 * CategoryIcon — a single source of truth for the 13 encyclopedia
 * category glyphs. Used by the header rail, home browser, and
 * article metadata badges.
 *
 * Slugs align with the roadmap Sprint 2 taxonomy.
 */

export const CATEGORIES = [
  { slug: "history-society", label: "History & Society" },
  { slug: "science", label: "Science" },
  { slug: "technology", label: "Technology" },
  { slug: "biographies", label: "Biographies" },
  { slug: "animals", label: "Animals" },
  { slug: "nature", label: "Nature" },
  { slug: "geography", label: "Geography" },
  { slug: "travel", label: "Travel" },
  { slug: "arts", label: "Arts" },
  { slug: "culture", label: "Culture" },
  { slug: "procon", label: "Pro / Con" },
  { slug: "money", label: "Money" },
  { slug: "games", label: "Games" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function labelForCategory(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/-/g, " ");
}

const ICONS: Record<string, React.ReactNode> = {
  "history-society": <g><path d="M4 20h16M6 20V8l6-4 6 4v12M10 20v-6h4v6" /></g>,
  science: <g><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="10" ry="4.5" /><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)" /></g>,
  technology: <g><rect x="6" y="6" width="12" height="12" rx="1" /><path d="M9 9h6v6H9z" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /></g>,
  biographies: <g><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></g>,
  animals: <g><circle cx="6" cy="8" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" /><path d="M8 14c0 3 2 5 4 5s4-2 4-5-2-4-4-4-4 1-4 4z" /></g>,
  nature: <g><path d="M12 22V12" /><path d="M12 12C8 12 5 9 5 5c4 0 7 3 7 7zM12 12c4 0 7-3 7-7-4 0-7 3-7 7z" /></g>,
  geography: <g><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" /></g>,
  travel: <g><path d="M22 16l-10 4-10-4 10-4 10 4z" /><path d="M22 16V8l-10 4-10-4v8" /></g>,
  arts: <g><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2a10 10 0 1 0 0 20 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h2a4 4 0 0 0 4-4 10 10 0 0 0-10-8z" /></g>,
  culture: <g><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /><path d="M4 21h16" /></g>,
  procon: <g><path d="M12 3v18M6 8h-3l3 5-3 5h3M18 8h3l-3 5 3 5h-3" /></g>,
  money: <g><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5 1-2.5 2s1 1.5 2.5 2 2.5 1 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v11" /></g>,
  games: <g><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.2" /><circle cx="16" cy="8" r="1.2" /><circle cx="8" cy="16" r="1.2" /><circle cx="16" cy="16" r="1.2" /><circle cx="12" cy="12" r="1.2" /></g>,
};

export default function CategoryIcon({
  slug,
  size = 24,
  className = "",
  strokeWidth = 1.5,
}: {
  slug: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[slug] ?? <g><circle cx="12" cy="12" r="9" /></g>}
    </svg>
  );
}
