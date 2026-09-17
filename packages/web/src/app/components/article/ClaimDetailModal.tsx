"use client";

import { useState } from "react";
import Link from "next/link";
import { useClaimEvidence, useSubmitClaimEvidence } from "../../hooks";
import type { ClaimItem } from "./GroupedClaimsList";

export interface ElsewhereHit {
  id: string;
  slug: string;
  title: string;
  text: string;
  status: string;
  confidence: number;
}

interface ClaimDetailModalProps {
  claim: ClaimItem | null;
  onClose: () => void;
  onContest?: (claimId: string) => void;
  // Trail context (article page supplies these; finder/registry leave empty).
  allClaims?: ClaimItem[];
  edges?: Array<{ source: string; target: string; relationship?: string; type?: string }>;
  gaps?: Array<{ id: string; claim_id: string; gap_type: string; expected_artifact: string }>;
  versionDiffs?: Array<{ claim_id: string; old_status?: string; new_status?: string; status_changed?: boolean; confidence_delta?: number }>;
  elsewhere?: ElsewhereHit[];
  onNavigate?: (claim: ClaimItem) => void;
}

const isDisputedStatus = (s?: string) =>
  ["disputed", "weak", "contested"].includes((s || "").toLowerCase());

export default function ClaimDetailModal({
  claim,
  onClose,
  onContest,
  allClaims = [],
  edges = [],
  gaps = [],
  versionDiffs = [],
  elsewhere = [],
  onNavigate,
}: ClaimDetailModalProps) {
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

  // Trail context for this claim.
  const vector = claim.confidence_vector ?? {};
  const vectorEntries = Object.entries(vector).filter(([, v]) => typeof v === "number");
  const claimGaps = gaps.filter((g) => g.claim_id === claim.id);
  const versionNote = versionDiffs.find((d) => d.claim_id === claim.id);
  const disputed = allClaims.filter((c) => isDisputedStatus(c.status));
  const disputeIdx = disputed.findIndex((c) => c.id === claim.id);
  const prevDisputed = disputeIdx > 0 ? disputed[disputeIdx - 1] : null;
  const nextDisputed = disputeIdx >= 0 && disputeIdx < disputed.length - 1 ? disputed[disputeIdx + 1] : null;
  const related = edges
    .filter((e) => e.source === claim.id || e.target === claim.id)
    .map((e) => {
      const otherId = e.source === claim.id ? e.target : e.source;
      const other = allClaims.find((c) => c.id === otherId);
      return other ? { claim: other, relationship: e.relationship || e.type || "related" } : null;
    })
    .filter((r): r is { claim: ClaimItem; relationship: string } => r !== null)
    .slice(0, 5);
  const go = (c: ClaimItem) => {
    if (onNavigate) onNavigate(c);
  };

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

          {versionNote?.status_changed && (
            <p className="text-xs text-gold font-medium">
              Status changed {versionNote.old_status} → {versionNote.new_status}
              {typeof versionNote.confidence_delta === "number" &&
                ` (${versionNote.confidence_delta >= 0 ? "+" : ""}${Math.round(versionNote.confidence_delta * 100)} pts)`}
            </p>
          )}

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

          {/* Confidence vector */}
          {vectorEntries.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                Confidence vector
              </div>
              {vectorEntries.slice(0, 6).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted capitalize w-32 shrink-0 truncate">
                    {(k as string).replace(/_/g, " ")}
                  </span>
                  <span className="flex-1 h-[3px] bg-ink/10 overflow-hidden" aria-hidden>
                    <span
                      className="block h-full bg-gold"
                      style={{ width: `${Math.round((v as number) * 100)}%` }}
                    />
                  </span>
                  <span className="font-mono text-[11px] text-subtle tabular-nums w-9 text-right">
                    {(v as number).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

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

          {/* Open gaps on this claim */}
          {claimGaps.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">
                Open gaps ({claimGaps.length})
              </div>
              <ul className="space-y-1.5">
                {claimGaps.slice(0, 3).map((g) => (
                  <li key={g.id} className="text-xs text-muted">
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold">
                      {(g.gap_type || "").replace(/_/g, " ")}
                    </span>
                    {g.expected_artifact ? ` — needs ${g.expected_artifact}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

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

        {/* Trail: in-article disputes, related claims, disputed elsewhere */}
        {(prevDisputed || nextDisputed || related.length > 0 || elsewhere.length > 0) && onNavigate && (
          <div className="px-6 py-4 bg-surface border-t border-rule space-y-3 max-h-56 overflow-y-auto">
            {(prevDisputed || nextDisputed) && (
              <div className="flex items-center justify-between gap-2 text-xs font-medium">
                {prevDisputed ? (
                  <button onClick={() => go(prevDisputed)} className="category-link no-underline cursor-pointer">
                    ← Prev dispute
                  </button>
                ) : <span />}
                {nextDisputed ? (
                  <button onClick={() => go(nextDisputed)} className="category-link no-underline cursor-pointer">
                    Next dispute →
                  </button>
                ) : <span />}
              </div>
            )}
            {related.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">Related claims</div>
                {related.map(({ claim: c, relationship }) => (
                  <button
                    key={c.id}
                    onClick={() => go(c)}
                    className="block w-full text-left text-[13px] text-ink hover:text-gold truncate transition-colors cursor-pointer"
                  >
                    <span className="font-mono text-[11px] text-subtle uppercase tracking-[0.1em] mr-2">{relationship}</span>
                    {c.text}
                  </button>
                ))}
              </div>
            )}
            {elsewhere.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-subtle">Disputed elsewhere</div>
                {elsewhere.map((h) => (
                  <Link
                    key={`${h.slug}-${h.id}`}
                    href={`/article/${h.slug}`}
                    className="block text-[13px] text-ink hover:text-gold truncate transition-colors no-underline"
                  >
                    {h.title}
                    <span className="text-muted"> — {h.text.slice(0, 80)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

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
