"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { ClaimStatus } from "@/lib/claim-parser";
import { useClaimEvidence } from "../hooks";
import ConfidenceRadar from "./ConfidenceRadar";

const CHIP_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  supported: { dot: "#2b7a4b", bg: "rgba(43,122,75,0.08)", border: "rgba(43,122,75,0.25)" },
  disputed: { dot: "#b33c3c", bg: "rgba(179,60,60,0.08)", border: "rgba(179,60,60,0.25)" },
  weak: { dot: "#b87a2e", bg: "rgba(184,122,46,0.08)", border: "rgba(184,122,46,0.25)" },
  unknown: { dot: "#888", bg: "rgba(136,136,136,0.08)", border: "rgba(136,136,136,0.25)" },
};

export function ProvenanceChipInline({ claimId, status }: { claimId: string; status?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const s = status || "unknown";
  const colors = CHIP_COLORS[s] || CHIP_COLORS.unknown;

  const { data } = useClaimEvidence(open ? claimId : undefined);

  const { claimData, freshness } = useMemo(() => {
    if (!data) return { claimData: null, freshness: null as number | null };
    const claimData: ClaimStatus = {
      claim_id: claimId,
      text: "",
      status: s as ClaimStatus["status"],
      derived_confidence: 0,
      confidence_vector: {},
      ...(data as any).claim,
    };
    const evidence = (data as any).evidence || [];
    let freshness: number | null = 0.5;
    if (evidence.length > 0) {
      const ages = evidence.map((e: any) => {
        const created = e.created_at ? new Date(e.created_at).getTime() : Date.now();
        return (Date.now() - created) / (1000 * 86400);
      });
      const avgAge = ages.reduce((a: number, b: number) => a + b, 0) / ages.length;
      freshness = 1 / (1 + avgAge / 180);
    }
    return { claimData, freshness };
  }, [data, claimId, s]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  const freshnessColor = freshness === null ? "#888" : freshness > 0.7 ? "#2b7a4b" : freshness > 0.4 ? "#b87a2e" : "#b33c3c";

  return (
    <span ref={ref} className="relative inline-block mx-0.5 align-middle">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border leading-none"
        style={{ color: colors.dot, borderColor: colors.border, background: colors.bg }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.dot }} />
        {s}
      </button>
      {open && (
        <div className="absolute z-50 w-72 p-3 rounded-lg shadow-xl border" style={{
          top: "calc(100% + 4px)", left: 0,
          background: "var(--surface-elevated, #fff)",
          borderColor: "var(--border-light, #e5e5e5)",
        }}>
          <div className="text-[10px] font-mono mb-2 break-all" style={{ color: "var(--subtle, #999)" }}>{claimId}</div>
          {claimData && (
            <div className="mb-2 flex justify-center">
              <ConfidenceRadar vector={claimData.confidence_vector} size={120} />
            </div>
          )}
          {claimData && Object.entries(claimData.confidence_vector || {}).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 mb-1">
              <span className="text-[10px] capitalize w-24 flex-shrink-0 truncate" style={{ color: "var(--muted, #777)" }}>
                {k.replace(/_/g, " ")}
              </span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border, #eee)" }}>
                <div className="h-full rounded-full" style={{ width: `${((v as number) || 0) * 100}%`, background: colors.dot }} />
              </div>
              <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: "var(--muted, #777)" }}>
                {(v as number).toFixed(2)}
              </span>
            </div>
          ))}
          {freshness !== null && (
            <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border-light, #eee)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] capitalize w-24 flex-shrink-0 truncate" style={{ color: "var(--muted, #777)" }}>
                  freshness
                </span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border, #eee)" }}>
                  <div className="h-full rounded-full" style={{ width: `${freshness * 100}%`, background: freshnessColor }} />
                </div>
                <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: "var(--muted, #777)" }}>
                  {freshness.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
