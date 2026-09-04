"use client";

import { useState } from "react";
import Link from "next/link";
import { useArticleGaps, useUpvoteGap, useSubmitGapEvidence } from "../hooks";

interface Gap {
  id: string;
  claim_id: string;
  claim_text: string;
  gap_type: string;
  expected_artifact: string;
  verification_status: string;
  cause_label: string;
  upvotes: number;
}

const STATUS_BG: Record<string, string> = {
  verified_gap: "rgba(179,60,60,0.08)",
  unverified_gap: "rgba(184,122,46,0.08)",
  false_positive_risk: "rgba(136,136,136,0.08)",
};
const STATUS_BORDER: Record<string, string> = {
  verified_gap: "rgba(179,60,60,0.25)",
  unverified_gap: "rgba(184,122,46,0.25)",
  false_positive_risk: "rgba(136,136,136,0.25)",
};
const STATUS_TEXT: Record<string, string> = {
  verified_gap: "#b33c3c",
  unverified_gap: "#b87a2e",
  false_positive_risk: "#888",
};

export default function ArticleGapsPanel({ slug }: { slug: string }) {
  const { data: res } = useArticleGaps(slug);
  const { mutate: upvoteGap } = useUpvoteGap();
  const { mutate: submitGapEvidence } = useSubmitGapEvidence();
  const gaps = (res?.gaps as Gap[] | undefined) ?? [];
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (gaps.length === 0) return null;

  const handleUpvote = async (gapId: string) => {
    await upvoteGap(gapId);
  };

  const handleSubmit = async (gapId: string) => {
    if (!url.trim()) return;
    setSubmitting(gapId);
    setMsg(null);
    const res = await submitGapEvidence({ gapId, url, note });
    if (res) {
      setMsg({ kind: "ok", text: "Evidence submitted for review. Thank you." });
      setUrl(""); setNote("");
    } else {
      setMsg({ kind: "err", text: "Submission failed. Please try again." });
    }
    setSubmitting(null);
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <section
      className="my-8 rounded-lg border"
      style={{ borderColor: "var(--border, #e5e5e5)", background: "var(--surface-elevated, #fff)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]"
        style={{ background: "none", border: "none", color: "inherit" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span aria-hidden className="text-base">?</span>
          <span className="font-display font-semibold text-sm" style={{ color: "var(--ink)" }}>
            Open Questions
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums"
            style={{
              background: "rgba(184,122,46,0.10)",
              color: "#b87a2e",
              border: "1px solid rgba(184,122,46,0.25)",
            }}
          >
            {gaps.length} {gaps.length === 1 ? "gap" : "gaps"}
          </span>
        </div>
        <span
          className="text-[11px] transition-transform"
          style={{
            color: "var(--muted, #777)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transitionDuration: "0.25s",
          }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: "var(--border-light, #f0f0f0)" }}>
          {gaps.map((g) => (
            <div
              key={g.id}
              className="p-4 border-b last:border-b-0"
              style={{ borderColor: "var(--border-light, #f0f0f0)" }}
            >
              {g.claim_text && (
                <p
                  className="text-xs leading-relaxed mb-2 font-serif italic"
                  style={{ color: "var(--ink, #222)" }}
                >
                  &ldquo;{g.claim_text}&rdquo;
                </p>
              )}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1.5 min-w-0">
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      background: STATUS_BG[g.verification_status] || STATUS_BG.unverified_gap,
                      border: `1px solid ${STATUS_BORDER[g.verification_status] || STATUS_BORDER.unverified_gap}`,
                      color: STATUS_TEXT[g.verification_status] || "#888",
                    }}
                  >
                    {g.verification_status.replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] text-subtle">{g.expected_artifact}</span>
                  {g.cause_label && <span className="text-[9px] text-subtle">· {g.cause_label}</span>}
                </div>
                <button
                  onClick={() => handleUpvote(g.id)}
                  className="shrink-0 flex flex-col items-center px-1.5 py-0.5 rounded border hover:border-[var(--accent)] transition-colors cursor-pointer"
                  style={{
                    borderColor: "var(--border, #e5e5e5)",
                    color: g.upvotes > 0 ? "var(--accent)" : "var(--muted, #777)",
                  }}
                  title="Upvote this gap"
                >
                  <span className="text-[10px] leading-none">▲</span>
                  <span className="text-[8px] tabular-nums mt-0.5">{g.upvotes}</span>
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="https://evidence-url.com"
                  value={submitting === g.id ? url : ""}
                  onChange={(e) => { setSubmitting(g.id); setUrl(e.target.value); }}
                  onFocus={() => setSubmitting(g.id)}
                  className="flex-1 text-[10px] px-2 py-1 rounded border bg-transparent"
                  style={{ borderColor: "var(--border, #e5e5e5)", color: "var(--ink)" }}
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={submitting === g.id ? note : ""}
                  onChange={(e) => { setSubmitting(g.id); setNote(e.target.value); }}
                  className="w-24 text-[10px] px-2 py-1 rounded border bg-transparent"
                  style={{ borderColor: "var(--border, #e5e5e5)", color: "var(--ink)" }}
                />
                <button
                  onClick={() => handleSubmit(g.id)}
                  disabled={submitting === g.id && !url.trim()}
                  className="text-[10px] px-2 py-1 rounded border transition-colors disabled:opacity-40 cursor-pointer"
                  style={{
                    borderColor: "var(--accent)",
                    color: "var(--accent)",
                    background: "color-mix(in srgb, var(--accent) 6%, transparent)",
                  }}
                >
                  Submit
                </button>
              </div>
              {submitting === g.id && msg && (
                <div
                  className="text-[10px] mt-1.5"
                  style={{ color: msg.kind === "ok" ? "var(--accent)" : "var(--red, #b33c3c)" }}
                >
                  {msg.text}
                </div>
              )}
            </div>
          ))}
          <div className="px-4 py-2.5 text-center">
            <Link
              href="/gaps"
              className="text-[10px] font-medium hover:underline"
              style={{ color: "var(--accent)" }}
            >
              View all gaps across the encyclopedia →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
