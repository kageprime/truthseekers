"use client";

import { useState } from "react";
import Link from "next/link";
import { useAllGaps, useUpvoteGap, useSubmitGapEvidence } from "../hooks";
import { useUiMode } from "../context/UiModeContext";

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
  const { widthMode } = useUiMode();

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

  // Fallback demo gaps if DB is empty
  const displayGaps =
    filteredGaps.length > 0
      ? filteredGaps
      : [
          {
            id: "gap-1",
            claim_id: "c-101",
            claim_text:
              "Original alloy ratios in 13th-century Benin bronzes derived from local smelting rather than European manillas.",
            gap_type: "missing_metallurgical_assay",
            expected_artifact: "Lead isotope spectroscopy publication",
            verification_status: "unverified_gap",
            cause_label: "Scarce archival data",
            article_slug: "kingdom-of-benin",
            detected_at: new Date().toISOString(),
            upvotes: 14,
          },
          {
            id: "gap-2",
            claim_id: "c-102",
            claim_text:
              "Fluxonium qubit coherence time scaling at sub-10mK temperatures in high-vacuum cryostats.",
            gap_type: "unreplicated_experimental_run",
            expected_artifact: "Independent lab replication dataset",
            verification_status: "unverified_gap",
            cause_label: "Recent preprint",
            article_slug: "quantum-computing",
            detected_at: new Date().toISOString(),
            upvotes: 27,
          },
        ];

  const containerClass = widthMode === "expanded" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="py-10 px-6 sm:px-12 w-full transition-all duration-300">
      <div className={`${containerClass} mx-auto space-y-8 transition-all duration-300`}>
        {/* Header */}
        <div className="border-b border-zinc-200 pb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 font-semibold text-[11px] uppercase tracking-wider border border-blue-200">
              Community Scrutiny
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-500 text-xs">Evidence Gap Registry</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
            Open Evidence Gaps
          </h1>

          <p className="font-serif text-base sm:text-lg text-zinc-600 italic leading-relaxed">
            Propositions lacking primary verification or independent replication. Upvote to prioritize agent research runs, or contribute counter-evidence.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-2xl border border-zinc-200 shadow-xs">
          <span className="text-xs font-semibold text-zinc-600 pl-1">Filter:</span>
          {["all", "unverified_gap", "verified_gap", "false_positive_risk"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === f
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {f === "all" ? "All Gaps" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Gaps List */}
        <div className="space-y-4">
          {displayGaps.map((g, idx) => (
            <div
              key={g.id || idx}
              className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                      {g.gap_type.replace(/_/g, " ")}
                    </span>
                    <Link
                      href={`/article/${g.article_slug}`}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Article: {g.article_slug.replace(/-/g, " ")}
                    </Link>
                  </div>

                  <p className="font-serif text-base sm:text-lg text-zinc-900 leading-snug pt-1 font-medium">
                    &ldquo;{g.claim_text}&rdquo;
                  </p>
                </div>

                {/* Upvote Button */}
                <button
                  onClick={() => handleUpvote(g.id)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold flex flex-col items-center gap-0.5 cursor-pointer shrink-0 transition-colors"
                  title="Upvote to prioritize investigation"
                >
                  <span className="text-blue-600">▲</span>
                  <span className="font-mono text-xs">{g.upvotes ?? 0}</span>
                </button>
              </div>

              {/* Submission Box */}
              <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500">
                <span>
                  Expected: <strong className="text-zinc-700">{g.expected_artifact}</strong>
                </span>
                <button
                  onClick={() => setSubmitting(submitting === g.id ? null : g.id)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer self-start sm:self-auto"
                >
                  {submitting === g.id ? "Close" : "+ Submit Evidence Source"}
                </button>
              </div>

              {submitting === g.id && (
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                  <div className="text-xs font-bold text-zinc-900">
                    Submit Primary Artifact or Dataset URL
                  </div>
                  <input
                    type="url"
                    required
                    placeholder="https://doi.org/... or https://arxiv.org/..."
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-zinc-300 bg-white"
                  />
                  <textarea
                    rows={2}
                    placeholder="Context / methodology note…"
                    value={submitNote}
                    onChange={(e) => setSubmitNote(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-zinc-300 bg-white"
                  />
                  {submitMsg && <p className="text-xs text-emerald-700 font-semibold">{submitMsg}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSubmitting(null)}
                      className="px-3 py-1 text-xs text-zinc-600 hover:text-zinc-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit(g.id)}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-lg shadow-xs"
                    >
                      Submit for Verification
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
