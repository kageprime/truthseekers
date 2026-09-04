"use client";

import { useArticleFreshness } from "../hooks";

interface Props {
  slug: string;
}

export default function FreshnessBadge({ slug }: Props) {
  const { data: res } = useArticleFreshness(slug);
  if (!res) return null;
  const { overall_score: score, claim_freshness: claimFreshness } = res;
  const claimCount = claimFreshness?.length || 0;

  // Color thresholds: green > 0.66, amber > 0.33, red otherwise
  const color =
    score > 0.66 ? "#4a8f5a" : score > 0.33 ? "#b87a2e" : "#b33c3c";
  const bg =
    score > 0.66
      ? "rgba(74,143,90,0.08)"
      : score > 0.33
      ? "rgba(184,122,46,0.08)"
      : "rgba(179,60,60,0.08)";
  const label =
    score > 0.66 ? "Fresh" : score > 0.33 ? "Aging" : "Stale";

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{ color, background: bg, borderColor: color + "40" }}
      title={`Freshness score: ${(score * 100).toFixed(0)}% across ${claimCount} claims`}
    >
      <span aria-hidden></span>
      {label}
      <span className="opacity-60">{(score * 100).toFixed(0)}%</span>
    </span>
  );
}
