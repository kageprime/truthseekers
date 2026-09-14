"use client";

import { useState } from "react";
import Link from "next/link";
import { useAllGaps, useUpvoteGap, useSubmitGapEvidence } from "../hooks";

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
  const gaps = (res?.gaps as Gap[] | undefined) ?? [];
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
    const res = await submitGapEvidence({ gapId, url: submitUrl, note: submitNote });
    if (res) {
      setSubmitMsg("Evidence submitted for review. Thank you!");
      setSubmitUrl(""); setSubmitNote("");
    } else { setSubmitMsg("Submission failed. Please try again."); }
    setSubmitting(null);
    setTimeout(() => setSubmitMsg(null), 4000);
  };

  const filteredGaps = filter === "all" ? gaps : gaps.filter((g) => g.verification_status === filter);

  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--r-border)] pb-3">
        <div className="text-[10px] text-[var(--r-muted)] font-bold tracking-widest uppercase">Living Encyclopedia • Research Wanted</div>
        <h1 className="r-h1 mt-1 text-[26px] sm:text-[32px]">Open Research Gaps</h1>
        <p className="text-[12px] text-[var(--r-muted)] mt-1">
          Claims missing expected verification. Upvote to prioritize investigations or submit missing sources.
        </p>
      </div>

      {gaps.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap bg-[var(--r-surface-elevated)] p-3 rounded-[var(--r-radius)] border border-[var(--r-border)]">
          {["all", "unverified_gap", "verified_gap", "false_positive_risk"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`r-btn px-3 py-1 ${filter === f ? "bg-[var(--r-accent)] text-white font-bold" : ""}`}
            >
              {f === "all" ? "All Gaps" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="text-[12px] py-12 text-center text-[var(--r-muted)]">Searching the evidence archives…</div>}
      {!loading && filteredGaps.length === 0 && (
        <div className="text-[12px] py-12 text-center border border-[var(--r-border)] bg-[var(--r-surface-elevated)] rounded-[var(--r-radius)]">
          No open gaps match this filter.
        </div>
      )}

      {filteredGaps.length > 0 && (
        <div className="space-y-2.5">
          {filteredGaps.map((g) => (
            <div key={g.id} className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] p-3.5 rounded-[var(--r-radius)] shadow-sm space-y-2">
              {g.claim_text && (
                <div className="text-[14px] leading-relaxed text-[var(--r-ink)]" style={{ fontFamily: "Georgia, serif" }}>
                  &ldquo;{g.claim_text}&rdquo;
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/article/${g.article_slug}`} className="text-[11px] font-bold text-[var(--r-accent)] hover:underline truncate block">
                    Article: {g.article_slug}
                  </Link>
                  <div className="flex flex-wrap gap-2 mt-2 items-center text-[10px]">
                    <span className="font-bold px-1.5 py-0.5 rounded-sm bg-amber-700 text-white">
                      {g.gap_type}
                    </span>
                    <span className="font-bold px-1.5 py-0.5 rounded-sm bg-stone-700 text-white">
                      {g.verification_status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[var(--r-muted)]">{g.expected_artifact}</span>
                    {g.cause_label && <span className="text-[var(--r-muted)]">· {g.cause_label}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleUpvote(g.id)}
                  aria-label={`Upvote gap, ${g.upvotes} votes`}
                  className="r-btn shrink-0 flex flex-col items-center justify-center px-3 py-1.5 min-h-[44px] min-w-[48px]"
                >
                  <span className="text-xs" aria-hidden>▲</span>
                  <span className="text-[11px] font-bold tabular-nums">{g.upvotes}</span>
                </button>
              </div>

              {/* Submit Evidence Form */}
              <div className="mt-3 pt-2.5 border-t border-[var(--r-border)]">
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="url"
                    placeholder="https://evidence-source-url.com"
                    aria-label="Evidence URL"
                    value={submitting === g.id ? submitUrl : ""}
                    onChange={(e) => { setSubmitting(g.id); setSubmitUrl(e.target.value); }}
                    onFocus={() => setSubmitting(g.id)}
                    className="flex-1 min-w-[200px] text-[12px] px-2.5 py-1.5 bg-[var(--r-surface)] text-[var(--r-ink)] border border-[var(--r-border)] rounded-[var(--r-radius)] outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Citation note (optional)"
                    aria-label="Evidence note"
                    value={submitting === g.id ? submitNote : ""}
                    onChange={(e) => { setSubmitting(g.id); setSubmitNote(e.target.value); }}
                    onFocus={() => setSubmitting(g.id)}
                    className="w-44 text-[12px] px-2.5 py-1.5 bg-[var(--r-surface)] text-[var(--r-ink)] border border-[var(--r-border)] rounded-[var(--r-radius)] outline-none"
                  />
                  <button
                    onClick={() => handleSubmit(g.id)}
                    disabled={submitting === g.id && !submitUrl.trim()}
                    className="r-btn text-[11px] font-bold px-3 py-1.5 bg-[var(--r-accent)] text-white disabled:opacity-40"
                  >
                    Submit Evidence
                  </button>
                </div>
                {submitting === g.id && submitMsg && (
                  <div className="text-[11px] mt-2 bg-[var(--r-surface)] border border-[var(--r-border)] p-2 text-[var(--r-ink)] rounded-sm">
                    {submitMsg}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
