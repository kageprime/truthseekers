"use client";

import { useEffect, useState } from "react";
import { fetchRefreshDiff } from "@/lib/api";

interface Props {
  slug: string;
}

export default function RefreshDiffBanner({ slug }: Props) {
  const [diff, setDiff] = useState<any | null>(null);

  useEffect(() => {
    fetchRefreshDiff(slug).then((res) => {
      if (res && res.total_claims > 0) setDiff(res);
    });
  }, [slug]);

  if (!diff) return null;
  if (diff.upgraded === 0 && diff.downgraded === 0 && diff.status_changed === 0) return null;

  const parts: string[] = [];
  if (diff.upgraded > 0) parts.push(`${diff.upgraded} claim${diff.upgraded > 1 ? "s" : ""} upgraded`);
  if (diff.downgraded > 0) parts.push(`${diff.downgraded} claim${diff.downgraded > 1 ? "s" : ""} downgraded`);
  if (diff.status_changed > 0) parts.push(`${diff.status_changed} claim${diff.status_changed > 1 ? "s" : ""} status changed`);

  return (
    <div
      className="mb-4 px-4 py-2 rounded-lg border text-xs"
      style={{
        background: "color-mix(in srgb, var(--accent) 6%, transparent)",
        borderColor: "var(--border-light, #e5e5e5)",
        color: "var(--ink)",
      }}
    >
      <span style={{ color: "var(--accent)", fontWeight: 600 }}>Last refresh: </span>
      {parts.join(" · ")}
    </div>
  );
}
