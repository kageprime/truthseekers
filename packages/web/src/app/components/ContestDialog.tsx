"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useContestArticle } from "../hooks";
import type { ContestResult } from "@/lib/api";

// Contest dialog — a reader's argued challenge to the article. Submits to
// adjudication; a warranted challenge queues regeneration (the caller
// attaches progress watching), otherwise the reasoning shows inline.
// inline renders the same states in a plain retro box (no Modal overlay)
// for surfaces where the fixed overlay never appears.
export default function ContestDialog({
  slug,
  open,
  onClose,
  onQueued,
  inline = false,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  onQueued: () => void;
  inline?: boolean;
}) {
  const [argument, setArgument] = useState("");
  const [result, setResult] = useState<ContestResult | null>(null);
  const { mutate: contest, loading } = useContestArticle();

  const close = () => {
    setArgument("");
    setResult(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = argument.trim();
    if (!trimmed || loading) return;
    const res = (await contest({ slug, argument: trimmed })) ?? { status: "undecided", error: "Contest failed" };
    setResult(res as ContestResult);
    if ((res as ContestResult).status === "queued") {
      onQueued();
      close();
    }
  };

  const body = result && result.status === "no_change" ? (
    <div>
      <p className="text-[12px] font-bold mb-1" style={{ color: "var(--r-ink, var(--ink))" }}>Challenge reviewed — article stands</p>
      <p className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--r-muted, var(--muted))" }}>{result.reasoning}</p>
      <div className="flex justify-end gap-2">
        <button onClick={close} className={inline ? "r-btn" : "btn btn-secondary btn-sm"}>Close</button>
      </div>
    </div>
  ) : result && result.status !== "queued" ? (
    <div>
      <p className="text-[12px] leading-relaxed mb-3" style={{ color: "#a33a3a" }}>{result.error || "Something went wrong. Please try again."}</p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setResult(null)} className={inline ? "r-btn" : "btn btn-secondary btn-sm"}>Back</button>
        <button onClick={close} className={inline ? "r-btn" : "btn btn-secondary btn-sm"}>Close</button>
      </div>
    </div>
  ) : (
    <form onSubmit={submit}>
      <p className="text-[12px] leading-relaxed mb-2" style={{ color: "var(--r-muted, var(--muted))" }}>
        State your counterpoint — new evidence, a contradiction, a missed perspective. The article is
        re-examined in light of it, and regenerates only if the challenge changes the picture.
      </p>
      <textarea
        value={argument}
        onChange={(e) => setArgument(e.target.value)}
        placeholder="What does this article get wrong, and what supports your view?"
        rows={4}
        maxLength={5000}
        disabled={loading}
        className={inline
          ? "w-full resize-y bg-[var(--r-surface)] border border-[var(--r-border)] rounded-[var(--r-radius)] px-2.5 py-1.5 text-[12px] outline-none"
          : "input w-full resize-y"}
        style={inline ? { color: "var(--r-ink)" } : undefined}
        aria-label="Your counterpoint"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] tabular-nums" style={{ color: "var(--r-muted, var(--subtle))" }}>{argument.trim().length}/5000</span>
        <div className="flex gap-2">
          <button type="button" onClick={close} className={inline ? "r-btn" : "btn btn-secondary btn-sm"} disabled={loading}>Cancel</button>
          <button type="submit" className={inline ? "r-btn" : "btn btn-primary btn-sm"} disabled={!argument.trim() || loading}>
            {loading ? "Reviewing…" : "Submit challenge"}
          </button>
        </div>
      </div>
    </form>
  );

  if (inline) {
    if (!open) return null;
    return (
      <div className="border bg-[var(--r-surface-elevated)] rounded-[var(--r-radius)] p-3" style={{ borderColor: "var(--r-border)" }}>
        <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--r-accent)" }}>
          Contest this article
        </div>
        {body}
      </div>
    );
  }

  return (
    <Modal open={open} onClose={close} title="Contest this article">
      {body}
    </Modal>
  );
}
