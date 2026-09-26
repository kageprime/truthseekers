"use client";

import { useState } from "react";
import Link from "next/link";
import { useAllGaps, useUpvoteGap, useSubmitGapEvidence } from "../hooks";
import { useUiMode } from "../context/UiModeContext";
import PlateHead from "../components/PlateHead";

interface Gap {
  id: string;
  claim_id: string;
  claim_text: string;
  gap_type: string;
  expected_artifact: string;
  verification_status: string;
  cause_label: string;
  article_slug: string;
  detected_at: string;
  upvotes: number;
}

export default function GapsPage() {
  const { data: res, loading } = useAllGaps();
  const { mutate: upvoteGap } = useUpvoteGap();
  const { mutate: submitGapEvidence } = useSubmitGapEvidence();
  const { containerClass } = useUiMode();

  const gaps = ((res as any)?.gaps as Gap[] | undefined) ?? [];
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const handleUpvote = async (gapId: string) => {
    await upvoteGap(gapId);
  };

  const handleSubmit = async (gapId: string) => {
    if (!submitUrl.trim()) return;
    setSubmitting(gapId);
    setSubmitMsg(null);
    const result = await submitGapEvidence({ gapId, url: submitUrl, note: submitNote });
    if (result) {
      setSubmitMsg("Evidence submitted for review. Thank you!");
      setSubmitUrl("");
      setSubmitNote("");
    } else {
      setSubmitMsg("Submission failed. Please try again.");
    }
    setSubmitting(null);
    setTimeout(() => setSubmitMsg(null), 4000);
  };

  const filteredGaps =
    filter === "all" ? gaps : gaps.filter((g) => g.verification_status === filter);

  const displayGaps = filteredGaps;

  return (
    <div className="py-10 px-6 sm:px-10 w-full">
      <div className={`${containerClass("standard")} transition-all duration-300`}>
        <PlateHead
          folioLeft={`${gaps.length} open`}
          folioRight={`Filter · ${filter}`}
          title="Open evidence gaps"
          deck="Propositions lacking primary verification or independent replication. Upvote to prioritize agent research runs, or contribute evidence."
        />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap py-4 text-xs">
          <span className="font-mono uppercase tracking-[0.14em] text-subtle">Filter</span>
          {["all", "unverified_gap", "verified_gap", "false_positive_risk"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`cursor-pointer transition-colors ${
                filter === f
                  ? "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4"
                  : "text-subtle hover:text-ink"
              }`}
            >
              {f === "all" ? "All gaps" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Gaps List */}
        {loading ? (
          <p className="font-serif italic text-muted py-16 text-center">Loading evidence gaps…</p>
        ) : displayGaps.length === 0 ? (
          <p className="font-serif italic text-muted py-16 text-center">
            No open evidence gaps. Generate articles to surface research needs.
          </p>
        ) : (
        <div className="ledger">
          {displayGaps.map((g, idx) => (
            <div
              key={g.id || idx}
              className="p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold font-medium">
                      {g.gap_type.replace(/_/g, " ")}
                    </span>
                    <Link
                      href={`/article/${g.article_slug}`}
                      className="category-link no-underline text-xs font-medium"
                    >
                      {g.article_slug.replace(/-/g, " ")}
                    </Link>
                  </div>

                  <p className="font-serif text-xl text-ink leading-snug pt-1">
                    &ldquo;{g.claim_text}&rdquo;
                  </p>
                </div>

                {/* Upvote Button */}
                <button
                  onClick={() => handleUpvote(g.id)}
                  className="px-3 py-2 border border-rule rounded-sharp text-ink flex flex-col items-center gap-0.5 cursor-pointer shrink-0 transition-colors hover:border-gold"
                  title="Upvote to prioritize investigation"
                >
                  <span className="text-gold text-xs">▲</span>
                  <span className="font-mono text-xs tabular-nums">{g.upvotes ?? 0}</span>
                </button>
              </div>

              {/* Submission Box */}
              <div className="pt-3 border-t border-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted">
                <span>
                  Expected: <strong className="text-ink font-medium">{g.expected_artifact}</strong>
                </span>
                <button
                  onClick={() => setSubmitting(submitting === g.id ? null : g.id)}
                  className="category-link no-underline text-xs font-semibold self-start sm:self-auto cursor-pointer"
                >
                  {submitting === g.id ? "Close" : "+ Submit evidence source"}
                </button>
              </div>

              {submitting === g.id && (
                <div className="p-4 bg-surface border border-rule rounded-sharp space-y-3">
                  <div className="text-[13px] font-semibold text-ink">
                    Submit primary artifact or dataset URL
                  </div>
                  <input
                    type="url"
                    required
                    placeholder="https://doi.org/... or https://arxiv.org/..."
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    className="w-full text-xs p-2 rounded-sharp border border-rule bg-surface-elevated text-ink"
                  />
                  <textarea
                    rows={2}
                    placeholder="Context / methodology note…"
                    value={submitNote}
                    onChange={(e) => setSubmitNote(e.target.value)}
                    className="w-full text-xs p-2 rounded-sharp border border-rule bg-surface-elevated text-ink"
                  />
                  {submitMsg && <p className="text-xs text-forest font-medium">{submitMsg}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSubmitting(null)}
                      className="px-3 py-1 text-xs text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit(g.id)}
                      className="px-3.5 py-1.5 bg-ink hover:bg-gold hover:text-ink text-surface font-semibold text-xs rounded-sharp transition-colors"
                    >
                      Submit for verification
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
