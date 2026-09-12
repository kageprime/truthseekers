"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useContestArticle } from "../hooks";
import type { ContestResult } from "@/lib/api";

// Contest dialog — a reader's argued challenge to the article. Submits to
// adjudication; a warranted challenge queues regeneration (the caller
// attaches progress watching), otherwise the reasoning shows inline.
export default function ContestDialog({
  slug,
  open,
  onClose,
  onQueued,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  onQueued: () => void;
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

  return (
    <Modal open={open} onClose={close} title="Contest this article">
      {result && result.status === "no_change" ? (
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: "var(--ink)" }}>Challenge reviewed — article stands</p>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--muted)" }}>{result.reasoning}</p>
          <div className="flex justify-end gap-2">
            <button onClick={close} className="btn btn-secondary btn-sm">Close</button>
          </div>
        </div>
      ) : result && result.status !== "queued" ? (
        <div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--oxblood)" }}>{result.error || "Something went wrong. Please try again."}</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setResult(null)} className="btn btn-secondary btn-sm">Back</button>
            <button onClick={close} className="btn btn-secondary btn-sm">Close</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--muted)" }}>
            State your counterpoint — new evidence, a contradiction, a missed perspective. The article is
            re-examined in light of it, and regenerates only if the challenge changes the picture.
          </p>
          <textarea
            value={argument}
            onChange={(e) => setArgument(e.target.value)}
            placeholder="What does this article get wrong, and what supports your view?"
            rows={5}
            maxLength={5000}
            disabled={loading}
            className="input w-full resize-y"
            aria-label="Your counterpoint"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs tabular-nums" style={{ color: "var(--subtle)" }}>{argument.trim().length}/5000</span>
            <div className="flex gap-2">
              <button type="button" onClick={close} className="btn btn-secondary btn-sm" disabled={loading}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!argument.trim() || loading}>
                {loading ? "Reviewing…" : "Submit challenge"}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
