"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchAllGaps, upvoteGap, submitGapEvidence } from "@/lib/api";

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
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const loadGaps = useCallback(() => {
    fetchAllGaps().then((res) => {
      if (res) setGaps(res.gaps as Gap[]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGaps(); }, [loadGaps]);

  const handleUpvote = async (gapId: string) => {
    const res = await upvoteGap(gapId);
    if (res && gaps) {
      setGaps(gaps.map((g) => (g.id === gapId ? { ...g, upvotes: res.upvotes } : g)));
    }
  };

  const handleSubmit = async (gapId: string) => {
    if (!submitUrl.trim()) return;
    setSubmitting(gapId);
    setSubmitMsg(null);
    const res = await submitGapEvidence(gapId, submitUrl, submitNote);
    if (res) {
      setSubmitMsg("Evidence submitted for review. Thank you!");
      setSubmitUrl(""); setSubmitNote("");
    } else { setSubmitMsg("Submission failed. Please try again."); }
    setSubmitting(null);
    setTimeout(() => setSubmitMsg(null), 4000);
  };
  const filteredGaps = gaps ? (filter === "all" ? gaps : gaps.filter((g) => g.verification_status === filter)) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-serif mb-2 text-ink">Open Questions</h1>
      <p className="text-xs text-subtle mb-6">
        Unresolved evidence gaps across all articles. These are claims where expected evidence types
        were not found. Upvote gaps you want prioritized, or submit evidence you&apos;ve found.
      </p>

      {gaps && gaps.length > 0 && (
        <div className="flex gap-1.5 mb-6">
          {["all", "unverified_gap", "verified_gap", "false_positive_risk"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-[10px] px-2 py-1 rounded-full border transition-colors"
              style={{
                borderColor: filter === f ? "var(--accent)" : "var(--border, #e5e5e5)",
                color: filter === f ? "var(--accent)" : "var(--muted, #777)",
                background: filter === f ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
              }}
            >{f === "all" ? "All" : f.replace(/_/g, " ")}</button>
          ))}
        </div>
      )}

      {loading && <div className="text-xs text-subtle">Loading...</div>}
      {!loading && (!filteredGaps || filteredGaps.length === 0) && (
        <div className="text-xs text-subtle py-8 text-center">No gaps match this filter.</div>
      )}

      {filteredGaps && filteredGaps.length > 0 && (
        <div className="space-y-2">
          {filteredGaps.map((g) => (
            <div key={g.id} className="p-4 rounded border" style={{ borderColor: "var(--border, #e5e5e5)" }}>
              {g.claim_text && (
                <div className="text-sm text-ink mb-2 leading-relaxed">
                  &ldquo;{g.claim_text}&rdquo;
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/article/${g.article_slug}`} className="text-[10px] font-mono hover:underline" style={{ color: "var(--muted, #777)" }}>{g.article_slug}</Link>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{
                      background: g.gap_type === "expected" ? "rgba(184,122,46,0.08)" : "rgba(136,136,136,0.08)",
                      borderColor: g.gap_type === "expected" ? "rgba(184,122,46,0.25)" : "rgba(136,136,136,0.25)",
                      color: g.gap_type === "expected" ? "#b87a2e" : "#888",
                    }}>{g.gap_type}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{
                      background: g.verification_status === "verified_gap" ? "rgba(179,60,60,0.08)" : "rgba(136,136,136,0.08)",
                      borderColor: g.verification_status === "verified_gap" ? "rgba(179,60,60,0.25)" : "rgba(136,136,136,0.25)",
                      color: g.verification_status === "verified_gap" ? "#b33c3c" : "#888",
                    }}>{g.verification_status.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-subtle">{g.expected_artifact}</span>
                    {g.cause_label && <span className="text-[10px] text-subtle">· {g.cause_label}</span>}
                  </div>
                </div>
                <button onClick={() => handleUpvote(g.id)}
                  className="shrink-0 flex flex-col items-center px-2 py-1 rounded border hover:border-opacity-100 transition-colors cursor-pointer"
                  style={{ borderColor: "var(--border, #e5e5e5)", color: g.upvotes > 0 ? "var(--accent)" : "var(--muted, #777)" }}
                >
                  <span className="text-sm leading-none">▲</span>
                  <span className="text-[10px] tabular-nums mt-0.5">{g.upvotes}</span>
                </button>
              </div>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border-light, #f0f0f0)" }}>
                <div className="flex gap-1.5">
                  <input type="url" placeholder="https://evidence-url.com"
                    value={submitting === g.id ? submitUrl : ""}
                    onChange={(e) => { setSubmitting(g.id); setSubmitUrl(e.target.value); }}
                    onFocus={() => setSubmitting(g.id)}
                    className="flex-1 text-[11px] px-2 py-1 rounded border bg-transparent"
                    style={{ borderColor: "var(--border, #e5e5e5)", color: "var(--ink)" }} />
                  <input type="text" placeholder="Note (optional)"
                    value={submitting === g.id ? submitNote : ""}
                    onChange={(e) => { setSubmitting(g.id); setSubmitNote(e.target.value); }}
                    onFocus={() => setSubmitting(g.id)}
                    className="w-32 text-[11px] px-2 py-1 rounded border bg-transparent"
                    style={{ borderColor: "var(--border, #e5e5e5)", color: "var(--ink)" }} />
                  <button onClick={() => handleSubmit(g.id)} disabled={submitting === g.id && !submitUrl.trim()}
                    className="text-[11px] px-3 py-1 rounded border transition-colors disabled:opacity-40"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}
                  >Submit</button>
                </div>
                {submitting === g.id && submitMsg && (
                  <div className="text-[10px] mt-1.5" style={{ color: "var(--accent)" }}>{submitMsg}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

