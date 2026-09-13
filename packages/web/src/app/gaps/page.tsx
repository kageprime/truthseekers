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
    const res = await upvoteGap(gapId);
    if (res && gaps) {
      // Optimistic: caller will refetch via invalidation; we just update local
      // state through the cache. (useApiMutation swallows errors as undefined.)
    }
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
    <>
      <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
        <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">Living Encyclopedia • Research wanted</div>
        <h1 className="r-h1 mt-1" style={{ fontSize: 28 }}>Open Questions</h1>
        <p className="text-[11px] mt-1" style={{ color: "#555" }}>
          Claims where expected evidence was not found. Upvote to prioritize, or submit evidence you&apos;ve found.
        </p>
      </div>

      {gaps.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {["all", "unverified_gap", "verified_gap", "false_positive_risk"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className="text-[10px] px-2 py-1 border-[2px] bg-[#d4d0c8] text-black"
              style={{ borderStyle: filter === f ? "inset" : "outset" }}
            >{f === "all" ? "All" : f.replace(/_/g, " ")}</button>
          ))}
        </div>
      )}

      {loading && <div className="text-[11px] py-8 text-center" style={{ color: "#8a7f68" }}>Searching the archives…</div>}
      {!loading && filteredGaps.length === 0 && (
        <div className="text-[11px] py-8 text-center border-[2px] bg-[#ffffe1]" style={{ borderStyle: "outset", borderWidth: 2 }}>No gaps match this filter.</div>
      )}

      {filteredGaps.length > 0 && (
        <div className="space-y-1.5">
          {filteredGaps.map((g) => (
            <div key={g.id} className="bg-white border-[2px] p-2" style={{ borderStyle: "outset", borderWidth: 2 }}>
              {g.claim_text && (
                <div className="text-[12px] mb-1.5 leading-[1.5] text-black" style={{ fontFamily: "Georgia,serif" }}>
                  &ldquo;{g.claim_text}&rdquo;
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/article/${g.article_slug}`} className="text-[10px] underline" style={{ color: "#0a2a5e" }}>{g.article_slug}</Link>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 border border-black text-white" style={{ background: g.gap_type === "expected" ? "#b7791f" : "#6b7a8f" }}>{g.gap_type}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 border border-black text-white" style={{ background: g.verification_status === "verified_gap" ? "#a33a3a" : "#6b7a8f" }}>{g.verification_status.replace(/_/g, " ")}</span>
                    <span className="text-[10px]" style={{ color: "#555" }}>{g.expected_artifact}</span>
                    {g.cause_label && <span className="text-[10px]" style={{ color: "#555" }}>· {g.cause_label}</span>}
                  </div>
                </div>
                <button onClick={() => handleUpvote(g.id)} aria-label={`Upvote gap, ${g.upvotes} votes`}
                  className="r-btn shrink-0 flex flex-col items-center px-2 py-1"
                >
                  <span className="text-sm leading-none" aria-hidden>▲</span>
                  <span className="text-[10px] tabular-nums mt-0.5">{g.upvotes}</span>
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-[#c0c0c0]">
                <div className="flex gap-1.5 flex-wrap">
                  <input type="url" placeholder="https://evidence-url.com" aria-label="Evidence URL"
                    value={submitting === g.id ? submitUrl : ""}
                    onChange={(e) => { setSubmitting(g.id); setSubmitUrl(e.target.value); }}
                    onFocus={() => setSubmitting(g.id)}
                    className="flex-1 min-w-[180px] text-[11px] px-2 py-1 bg-white text-black"
                    style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }} />
                  <input type="text" placeholder="Note (optional)" aria-label="Evidence note"
                    value={submitting === g.id ? submitNote : ""}
                    onChange={(e) => { setSubmitting(g.id); setSubmitNote(e.target.value); }}
                    onFocus={() => setSubmitting(g.id)}
                    className="w-32 text-[11px] px-2 py-1 bg-white text-black"
                    style={{ borderStyle: "inset", borderWidth: 2, borderColor: "#808080 #fff #fff #808080" }} />
                  <button onClick={() => handleSubmit(g.id)} disabled={submitting === g.id && !submitUrl.trim()}
                    className="r-btn text-[11px] px-3 py-1 disabled:opacity-40"
                  >Submit</button>
                </div>
                {submitting === g.id && submitMsg && (
                  <div className="text-[10px] mt-1.5 bg-[#ffffe1] border border-black p-1">{submitMsg}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

