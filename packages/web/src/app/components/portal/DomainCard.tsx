"use client";

import Link from "next/link";

export interface DomainCardProps {
  slug: string;
  title: string;
  category?: string;
  abstract?: string;
  sourcesCount?: number;
  confidence?: number;
  gradient?: string;
}

export default function DomainCard({
  slug,
  title,
  category = "KNOWLEDGE",
  abstract = "Comprehensive multi-agent verified research entry with empirical citations and confidence vectors.",
  sourcesCount = 28,
  confidence = 0.95,
  gradient,
}: DomainCardProps) {
  // Derive gradient based on category if not explicitly provided
  const getGradient = (cat: string) => {
    if (gradient) return gradient;
    const c = cat.toLowerCase();
    if (c.includes("tech") || c.includes("comput") || c.includes("cyber")) {
      return "from-zinc-900 via-zinc-800 to-zinc-900";
    }
    if (c.includes("hist") || c.includes("cultur") || c.includes("empir")) {
      return "from-amber-900 via-yellow-900 to-stone-800";
    }
    if (c.includes("nat") || c.includes("bio") || c.includes("ecol") || c.includes("plant")) {
      return "from-emerald-900 via-green-800 to-lime-900";
    }
    if (c.includes("phys") || c.includes("space") || c.includes("astron")) {
      return "from-blue-900 via-indigo-900 to-slate-900";
    }
    return "from-zinc-900 via-zinc-800 to-zinc-900";
  };

  const confidencePct = Math.round(confidence * 100);

  return (
    <Link
      href={`/article/${slug}`}
      className="group rounded-2xl border border-zinc-200 bg-white overflow-hidden hover:border-zinc-400 hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between no-underline"
    >
      {/* Gradient Header Plate */}
      <div className={`h-24 bg-gradient-to-br ${getGradient(category)} p-4 text-white flex items-end relative`}>
        <span className="text-[10px] font-mono font-semibold tracking-wider uppercase opacity-90">
          {category}
        </span>
      </div>

      {/* Body Content */}
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-base text-zinc-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {title}
          </h3>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
            {abstract}
          </p>
        </div>

        {/* Footer Meta */}
        <div className="pt-3 border-t border-zinc-100 flex justify-between items-center text-xs text-zinc-500 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>{sourcesCount} Sources</span>
          </span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-mono text-[11px]">
            {confidencePct}% Conf
          </span>
        </div>
      </div>
    </Link>
  );
}
