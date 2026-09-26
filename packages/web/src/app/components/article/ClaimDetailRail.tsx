"use client";

import { useEffect, useRef, useState } from "react";
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

// ponytail: one claim surface everywhere. The rail docks right on desktop
// (the article stays visible and scrollable beside it) and becomes a bottom
// sheet <640px via the shared .trail-* classes. Trail context renders only
// when the caller supplies it (article page); finder/contested get the
// evidence + contest core without the trail sections.
interface ClaimDetailRailProps {
  claim: ClaimItem | null;
  onClose: () => void;
  onContest?: (claimId: string) => void;
  allClaims?: ClaimItem[];
  edges?: Array<{ source: string; target: string; relationship?: string; type?: string }>;
  gaps?: Array<{ id: string; claim_id: string; gap_type: string; expected_artifact: string }>;
  versionDiffs?: Array<{ claim_id: string; old_status?: string; new_status?: string; status_changed?: boolean; confidence_delta?: number }>;
  elsewhere?: ElsewhereHit[];
  onNavigate?: (claim: ClaimItem) => void;
}

const isDisputedStatus = (s?: string) =>
  ["disputed", "weak", "contested"].includes((s || "").toLowerCase());

const STATUS_TONE: Record<string, { label: string; text: string }> = {
  verified: { label: "Verified", text: "text-forest" },
  supported: { label: "Verified", text: "text-forest" },
  contested: { label: "Contested", text: "text-oxblood" },
  disputed: { label: "Contested", text: "text-oxblood" },
  developing: { label: "Developing", text: "text-gold" },
  weak: { label: "Developing", text: "text-gold" },
};

export default function ClaimDetailRail({
  claim,
  onClose,
  onContest,
  allClaims = [],
  edges = [],
  gaps = [],
  versionDiffs = [],
  elsewhere = [],
  onNavigate,
}: ClaimDetailRailProps) {
  const [contestOpen, setContestOpen] = useState(false);
  const [contestUrl, setContestUrl] = useState("");
  const [contestNote, setContestNote] = useState("");
  const [contestSubmitted, setContestSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: evidenceRes, loading: evidenceLoading } = useClaimEvidence(claim?.id);
  const { mutate: submitEvidence } = useSubmitClaimEvidence();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Fresh form each time the user walks the trail to another claim.
  useEffect(() => {
    setContestOpen(false);
    setContestUrl("");
    setContestNote("");
    setContestSubmitted(false);
    setSubmitError(null);
  }, [claim?.id]);

  // Escape closes; focus lands on ✕ so keyboard users start inside the rail.
  useEffect(() => {
    if (!claim) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [claim, onClose]);

  // Mobile sheet traps page scroll; desktop rail leaves the article scrollable.
  useEffect(() => {
    if (!claim) return;
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      document.body.style.overflow = "";
      mq.removeEventListener("change", apply);
    };
  }, [claim]);

  if (!claim) return null;

  const tone = STATUS_TONE[(claim.status || "").toLowerCase()] ?? { label: "Unverified", text: "text-subtle" };
  const isContested = tone.label === "Contested";
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
    <div className="trail-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="trail-drawer"
        role="dialog"
        aria-modal="false"
        aria-label={`Claim details: ${(claim.text || "").slice(0, 80)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Folio header — sticky so ✕ never scrolls away on long trails */}
        <div className="trail-stickyhead">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[11px] font-mono uppercase tracking-[0.14em] font-medium ${tone.text}`}>
              {tone.label}
            </span>
            <span className="text-[11px] font-mono text-subtle tabular-nums shrink-0">
              № {claim.id.slice(0, 8)}
            </span>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="trail-close"
            aria-label="Close claim details"
          >
            ✕
          </button>
        </div>

        <p className="trail-text">&ldquo;{claim.text}&rdquo;</p>

        {versionNote?.status_changed && (
          <p className="text-xs text-gold font-medium mb-3">
            Status changed {versionNote.old_status} → {versionNote.new_status}
            {typeof versionNote.confidence_delta === "number" &&
              ` (${versionNote.confidence_delta >= 0 ? "+" : ""}${Math.round(versionNote.confidence_delta * 100)} pts)`}
          </p>
        )}

        {/* Support meter */}
        <div className="trail-section trail-section-first">
          <div className="trail-meterhead">
            <span className="trail-metersub">Empirical support</span>
            <span className="font-mono font-semibold text-ink tabular-nums text-xs">{confidencePct}%</span>
          </div>
          <div className="w-full h-[3px] bg-ink/10 overflow-hidden" role="img" aria-label={`Empirical support ${confidencePct} percent`}>
            <div
              className={isContested ? "h-full bg-oxblood" : "h-full bg-gold"}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>

        {/* Confidence vector */}
        {vectorEntries.length > 0 && (
          <div className="trail-section">
            <p className="trail-label">Confidence vector</p>
            {vectorEntries.slice(0, 6).map(([k, v]) => (
              <div key={k} className="trail-row">
                <span className="trail-k">{(k as string).replace(/_/g, " ")}</span>
                <span className="trail-bar" aria-hidden>
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
        <div className="trail-section">
          <p className="trail-label">Evidence</p>
          <div className="py-2 border-b border-border-light">
            <div className="font-semibold text-ink text-xs flex items-center justify-between">
              <span>{claim.source_title || "Peer-reviewed literature corpus"}</span>
              <span className="text-[10px] text-forest font-mono">Primary</span>
            </div>
          </div>
          {evidenceLoading && evidenceList.length === 0 ? (
            <div className="space-y-2 py-2" aria-live="polite" aria-label="Loading evidence">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
              <div className="skeleton h-3 w-4/6" />
            </div>
          ) : evidenceList.length > 0 ? (
            <div>
              {evidenceList.slice(0, 5).map((ev: any, i: number) => (
                <a
                  key={ev.id || i}
                  href={ev.url || ev.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block py-2.5 border-b border-border-light no-underline group/ev"
                >
                  <div className="font-semibold text-[13px] text-ink group-hover/ev:text-gold truncate transition-colors">{ev.title || ev.url || "Evidence record"}</div>
                  {(ev.url || ev.source_url) && (
                    <div className="text-muted text-xs truncate mt-0.5">{ev.url || ev.source_url}</div>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="trail-empty">No linked evidence records yet.</p>
          )}
        </div>

        {/* Open gaps on this claim */}
        {claimGaps.length > 0 && (
          <div className="trail-section">
            <p className="trail-label">Open gaps ({claimGaps.length})</p>
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

        {/* Contest form — collapsed behind the scrutiny link */}
        <div className="trail-section">
          {!contestOpen ? (
            <button
              onClick={() => setContestOpen(true)}
              className="text-xs font-semibold text-oxblood underline decoration-oxblood/30 hover:decoration-oxblood underline-offset-4 cursor-pointer"
            >
              Contest with counterpoint
            </button>
          ) : (
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
                    aria-label="Counter-evidence URL"
                    className="w-full text-xs p-2 rounded-sharp border border-rule bg-surface-elevated text-ink"
                  />
                  <textarea
                    rows={2}
                    placeholder="Explanation of methodological contradiction…"
                    value={contestNote}
                    onChange={(e) => setContestNote(e.target.value)}
                    aria-label="Counter-evidence explanation"
                    className="w-full text-xs p-2 rounded-sharp border border-rule bg-surface-elevated text-ink"
                  />
                  {submitError && <p className="text-xs text-oxblood font-medium" role="alert">{submitError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setContestOpen(false)}
                      className="px-3 py-1 text-xs text-muted hover:text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-ink hover:bg-gold hover:text-ink text-surface font-semibold text-xs rounded-sharp transition-colors cursor-pointer"
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
          <div className="trail-section">
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
              <div className="space-y-1.5 mt-3">
                <p className="trail-label">Related claims</p>
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
              <div className="space-y-1.5 mt-3">
                <p className="trail-label">Disputed elsewhere</p>
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
      </aside>
    </div>
  );
}
