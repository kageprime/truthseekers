"use client";

const DOT: Record<string, string> = {
  supported: "#2b7a4b",
  disputed: "#b33c3c",
  weak: "#b87a2e",
  unknown: "#888",
};

export interface RailClaim {
  id: string;
  text?: string;
  status?: string;
  derived_confidence?: number;
}

export interface EvidenceCount {
  supports: number;
  contradicts: number;
}

// Margin sidenotes — one per claim, in reading order. Glanceable by design:
// status, a line of wording, confidence, evidence tally. Depth lives in the
// trail drawer; the rail never duplicates it.
export default function ClaimRail({
  claims,
  evidenceCounts,
  activeId,
  onSelect,
}: {
  claims: RailClaim[];
  evidenceCounts: Record<string, EvidenceCount>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!claims || claims.length === 0) return null;
  return (
    <div className="claim-rail" role="complementary" aria-label="Claims in this article">
      <p className="claim-rail-title">Claims</p>
      <ol className="claim-rail-list">
        {claims.map((c, i) => {
          const color = DOT[c.status ?? ""] ?? DOT.unknown;
          const conf = typeof c.derived_confidence === "number" ? c.derived_confidence : null;
          const ev = evidenceCounts[c.id];
          const active = activeId === c.id;
          return (
            <li key={c.id} id={`claim-note-${c.id}`}>
              <button
                onClick={() => onSelect(c.id)}
                aria-current={active || undefined}
                className={"claim-note" + (active ? " claim-note-active" : "")}
                style={{ ["--note-dot" as string]: color }}
              >
                <span className="claim-note-head">
                  <span className="claim-note-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="claim-note-status">{c.status ?? "unknown"}</span>
                </span>
                <span className="claim-note-text">{c.text || "Claim text unavailable"}</span>
                <span className="claim-note-foot">
                  {conf !== null && (
                    <span className="claim-note-conf" aria-label={`confidence ${Math.round(conf * 100)} percent`}>
                      <span className="claim-note-bar"><span style={{ width: `${Math.round(conf * 100)}%` }} /></span>
                      <span className="tabular-nums">{conf.toFixed(2)}</span>
                    </span>
                  )}
                  {ev && (ev.supports > 0 || ev.contradicts > 0) && (
                    <span className="claim-note-ev">
                      {ev.supports > 0 && <span className="claim-note-sup">▲ {ev.supports}</span>}
                      {ev.contradicts > 0 && <span className="claim-note-con">▼ {ev.contradicts}</span>}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
