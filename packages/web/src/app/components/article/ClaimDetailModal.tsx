"use client";

import { useState } from "react";
import { useClaimEvidence, useSubmitClaimEvidence } from "../../hooks";
import type { ClaimItem } from "./GroupedClaimsList";

interface ClaimDetailModalProps {
  claim: ClaimItem | null;
  onClose: () => void;
  onContest?: (claimId: string) => void;
}

export default function ClaimDetailModal({ claim, onClose, onContest }: ClaimDetailModalProps) {
  const [contestOpen, setContestOpen] = useState(false);
  const [contestUrl, setContestUrl] = useState("");
  const [contestNote, setContestNote] = useState("");
  const [contestSubmitted, setContestSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: evidenceRes } = useClaimEvidence(claim?.id);
  const { mutate: submitEvidence } = useSubmitClaimEvidence();

  if (!claim) return null;

  const isContested = (claim.status || "").toLowerCase() === "contested";
  const confidence = claim.derived_confidence != null ? claim.derived_confidence : 0.96;
  const confidencePct = Math.round(confidence * 100);

  const handleSubmitContest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const result = await submitEvidence({ claimId: claim.id, url: contestUrl, note: contestNote });
    if (result) {
      setContestSubmitted(true);
      if (onContest) onContest(claim.id);
    } else {
      setSubmitError("Submission failed. Please try again.");
    }
  };

  const evidenceList = (evidenceRes as any)?.evidence ?? claim.evidence ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-surface-elevated rounded-card-lg shadow-elev-3 border border-rule overflow-hidden animate-appear-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-mono uppercase tracking-[0.14em] font-medium ${
                isContested ? "text-oxblood" : "text-forest"
              }`}
            >
              {isContested ? "Contested" : "Verified"}
            </span>
            <span className="text-[11px] font-mono text-subtle tabular-nums">
              № {claim.id.slice(0, 8)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-ink/5 flex items-center justify-center text-muted text-sm cursor-pointer transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <p className="font-serif text-xl leading-snug text-ink">
            &ldquo;{claim.text}&rdquo;
          </p>

          {/* Support Meter */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted font-medium">Empirical support</span>
              <span className="font-mono font-semibold text-ink tabular-nums">{confidencePct}%</span>
            </div>
            <div className="w-full h-[3px] bg-ink/10 overflow-hidden">
              <div
                className={isContested ? "h-full bg-oxblood" : "h-full bg-gold"}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          {/* Evidence Citations */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
              Evidence
            </div>
            <div className="space-y-2 text-xs">
              <div className="py-2 border-b border-border-light">
                <div className="font-semibold text-ink flex items-center justify-between">
                  <span>{claim.source_title || "Peer-reviewed literature corpus"}</span>
                  <span className="text-[10px] text-forest font-mono">Primary</span>
                </div>
              </div>
              {evidenceList.length > 0 ? (
                evidenceList.slice(0, 5).map((ev: any, i: number) => (
                  <a
                    key={ev.id || i}
                    href={ev.url || ev.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block py-2.5 border-b border-border-light no-underline group/ev"
                  >
                    <div className="font-semibold text-ink group-hover/ev:text-gold truncate transition-colors">{ev.title || ev.url || "Evidence record"}</div>
                    {(ev.url || ev.source_url) && (
                      <div className="text-muted truncate mt-0.5">{ev.url || ev.source_url}</div>
                    )}
                  </a>
                ))
              ) : (
                <p className="font-serif italic text-subtle">No linked evidence records yet.</p>
              )}
            </div>
          </div>

          {/* Contest Drawer / Form */}
          {contestOpen && (
            <div className="p-4 bg-gold-bg/40 border border-rule rounded-sharp space-y-3">
              <div className="text-[13px] font-semibold text-ink">
                Submit counter-evidence
              </div>
              {contestSubmitted ? (
                <p className="text-xs text-forest font-medium">
                  Counter-evidence received and queued for verification.
                </p>
              ) : (
                <form onSubmit={handleSubmitContest} className="space-y-2.5">
                  <input
                    type="url"
                    required
                    placeholder="URL of countering publication or preprint"
                    value={contestUrl}
                    onChange={(e) => setContestUrl(e.target.value)}
                    className="w-full text-xs p-2 rounded-sharp border border-rule bg-surface-elevated text-ink"
                  />
                  <textarea
                    rows={2}
                    placeholder="Explanation of methodological contradiction…"
                    value={contestNote}
                    onChange={(e) => setContestNote(e.target.value)}
                    className="w-full text-xs p-2 rounded-sharp border border-rule bg-surface-elevated text-ink"
                  />
                  {submitError && <p className="text-xs text-oxblood font-medium">{submitError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setContestOpen(false)}
                      className="px-3 py-1 text-xs text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-ink hover:bg-gold hover:text-ink text-surface font-semibold text-xs rounded-sharp transition-colors"
                    >
                      Submit evidence
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface border-t border-rule flex justify-between items-center">
          {!contestOpen ? (
            <button
              onClick={() => setContestOpen(true)}
              className="text-xs font-semibold text-oxblood underline decoration-oxblood/30 hover:decoration-oxblood underline-offset-4 cursor-pointer"
            >
              Contest with counterpoint
            </button>
          ) : (
            <span className="text-xs text-subtle">Community scrutiny</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sharp bg-ink hover:bg-gold hover:text-ink text-surface font-semibold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
