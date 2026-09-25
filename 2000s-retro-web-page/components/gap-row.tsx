"use client";

import { useState } from "react";
import { upvoteGap } from "@/lib/api";
import type { Gap } from "@/lib/types";

// ponytail: one gap row — optimistic upvote count, anon bounces to login via
// the shared authed() 401 handler. Used by the article shell and gaps page.
export function GapRow({ gap }: { gap: Gap }) {
  const [votes, setVotes] = useState(gap.upvotes ?? 0);
  const [voted, setVoted] = useState(false);
  const upvote = async () => {
    if (voted) return;
    setVoted(true);
    setVotes((v) => v + 1);
    const res = await upvoteGap(gap.id).catch(() => null);
    if (res && typeof res.upvotes === "number") setVotes(res.upvotes);
  };
  return (
    <div className="flex items-center justify-between gap-4 border border-ink/15 p-3">
      <p className="font-mono text-[10px] uppercase text-muted">
        Missing: {gap.expected_artifact}
        {gap.cause_label ? ` · ${gap.cause_label}` : ""}
      </p>
      <button
        onClick={upvote}
        disabled={voted}
        aria-label={`Upvote gap ${gap.expected_artifact}`}
        className="border border-ink/25 px-2 py-1 font-mono text-[10px] uppercase hover:border-coral hover:text-coral disabled:opacity-50"
      >
        ▲ {votes}
      </button>
    </div>
  );
}
