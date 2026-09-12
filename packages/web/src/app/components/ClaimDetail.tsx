"use client";

import { useEffect } from "react";
import type { ClaimGraphNode, ClaimGraphEdge } from "@/lib/api";

const DOT: Record<string, string> = {
  supported: "#2b7a4b",
  disputed: "#b33c3c",
  weak: "#b87a2e",
  unknown: "#888",
};

export interface TrailClaim {
  id: string;
  text?: string;
  status?: string;
  derived_confidence?: number;
  confidence_vector?: Record<string, number>;
}

export interface TrailGap {
  id?: string;
  claim_id?: string;
  gap_type?: string;
  expected_artifact?: string;
  verification_status?: string;
  cause_label?: string;
}

function domainOf(url?: string): string {
  try {
    return new URL(url || "").hostname.replace(/^www\./, "");
  } catch {
    return url || "";
  }
}

// Claim trail drawer — the full path from one claim outward: its wording and
// standing, the evidence for and against with real destinations, the claims
// it touches (selectable, so the trail walks), and its open gaps. Fed by the
// epistemic composite, so the whole trail arrives in one round trip.
export default function ClaimDetail({
  claim,
  graph,
  gaps,
  allClaims,
  onClose,
  onSelectClaim,
}: {
  claim: TrailClaim;
  graph: { nodes: ClaimGraphNode[]; edges: ClaimGraphEdge[] } | null;
  gaps: TrailGap[];
  allClaims: TrailClaim[];
  onClose: () => void;
  onSelectClaim: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const color = DOT[claim.status ?? ""] ?? DOT.unknown;
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const claimById = new Map(allClaims.map((c) => [c.id, c]));

  const evidence = edges
    .filter((e) => e.target === claim.id && e.type === "evidence")
    .map((e) => ({ edge: e, node: byId.get(e.source) }));

  const linked = edges
    .filter((e) => e.type === "claim" && (e.source === claim.id || e.target === claim.id))
    .map((e) => {
      const otherId = e.source === claim.id ? e.target : e.source;
      const dir = e.source === claim.id ? "outgoing" : "incoming";
      return { edge: e, otherId, dir, other: claimById.get(otherId) };
    });

  const vector = claim.confidence_vector ?? {};
  const vectorRows = Object.entries(vector);

  return (
    <div className="trail-backdrop" onClick={onClose} role="presentation">
      <aside
        className="trail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Claim trail: ${(claim.text || "").slice(0, 80)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trail-head">
          <span className="trail-status" style={{ color, borderColor: color }}>
            <span className="trail-dot" style={{ background: color }} />
            {claim.status ?? "unknown"}
          </span>
          <button onClick={onClose} className="trail-close" aria-label="Close claim trail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="trail-text">{claim.text || "Claim text unavailable"}</p>

        {typeof claim.derived_confidence === "number" && (
          <div className="trail-conf">
            <span>confidence</span>
            <span className="trail-bar"><span style={{ width: `${Math.round(claim.derived_confidence * 100)}%`, background: color }} /></span>
            <span className="tabular-nums">{claim.derived_confidence.toFixed(2)}</span>
          </div>
        )}

        {vectorRows.length > 0 && (
          <div className="trail-section">
            <p className="trail-label">Confidence vector</p>
            {vectorRows.map(([k, v]) => (
              <div key={k} className="trail-row">
                <span className="trail-k">{k.replace(/_/g, " ")}</span>
                <span className="trail-bar"><span style={{ width: `${Math.round((v || 0) * 100)}%`, background: color }} /></span>
                <span className="tabular-nums">{(v || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="trail-section">
          <p className="trail-label">Evidence ({evidence.length})</p>
          {evidence.length === 0 && <p className="trail-empty">No linked evidence yet.</p>}
          {evidence.map(({ edge, node }, i) => {
            const url = node?.label || "";
            const good = edge.relationship === "supports";
            return (
              <a
                key={`${edge.source}-${i}`}
                href={url.startsWith("http") ? url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="trail-ev"
                onClick={url.startsWith("http") ? undefined : (e) => e.preventDefault()}
              >
                <span className="trail-verdict" style={{ color: good ? DOT.supported : DOT.disputed }}>
                  {good ? "▲ supports" : "▼ contradicts"}
                </span>
                <span className="trail-url">{domainOf(url) || node?.id || edge.source}</span>
              </a>
            );
          })}
        </div>

        {linked.length > 0 && (
          <div className="trail-section">
            <p className="trail-label">Connected claims ({linked.length})</p>
            {linked.map(({ edge, otherId, dir, other }) => (
              <button key={`${edge.source}-${edge.target}`} onClick={() => onSelectClaim(otherId)} className="trail-linked">
                <span className="trail-rel">{edge.relationship} · {dir}</span>
                <span className="trail-linked-text">{other?.text || otherId}</span>
              </button>
            ))}
          </div>
        )}

        {gaps.length > 0 && (
          <div className="trail-section">
            <p className="trail-label">Open gaps ({gaps.length})</p>
            {gaps.map((g, i) => (
              <div key={g.id ?? i} className="trail-gap">
                <p className="trail-gap-type">{(g.gap_type || "gap").replace(/_/g, " ")}</p>
                {g.expected_artifact && <p className="trail-gap-text">Missing: {g.expected_artifact}</p>}
                {g.cause_label && <p className="trail-gap-text">{g.cause_label}</p>}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
