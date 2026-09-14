"use client";

import { useState } from "react";
import { useContestedClaims } from "../hooks";
import { retroStatusColor } from "@/lib/retro";

export default function ContestedPage() {
  const [limit, setLimit] = useState(50);
  const { data: res, loading } = useContestedClaims(limit);
  const claims = (res?.claims as Array<{
    id: string; text: string; status: string;
    derived_confidence: number; confidence_vector?: Record<string, number>;
  }> | undefined) ?? [];

  return (
    <div className="space-y-4">
      <div className="border-b border-[var(--r-border)] pb-3">
        <div className="text-[10px] text-[var(--r-muted)] font-bold tracking-widest uppercase">Living Encyclopedia • Fault Lines</div>
        <h1 className="r-h1 mt-1 text-[26px] sm:text-[32px]">Most Contested Claims</h1>
        <p className="text-[12px] text-[var(--r-muted)] mt-1">
          Where empirical evidence is actively disputed, ranked by contradiction severity.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap bg-[var(--r-surface-elevated)] p-3 rounded-[var(--r-radius)] border border-[var(--r-border)]">
        <span className="text-[12px] font-bold text-[var(--r-ink)]">Display Limit:</span>
        {[10, 25, 50, 100].map((n) => (
          <button
            key={n}
            onClick={() => setLimit(n)}
            className={`r-btn px-3 py-1 ${limit === n ? "bg-[var(--r-accent)] text-white font-bold" : ""}`}
            aria-pressed={limit === n}
          >
            {n}
          </button>
        ))}
      </div>

      {loading && <div className="text-[12px] py-12 text-center text-[var(--r-muted)]">Reading the fault lines…</div>}

      {!loading && claims.length === 0 && (
        <div className="text-[12px] py-12 text-center border border-[var(--r-border)] bg-[var(--r-surface-elevated)] rounded-[var(--r-radius)]">
          No contested claims recorded yet.
        </div>
      )}

      {claims.length > 0 && (
        <div className="space-y-2.5">
          {claims.map((c, i) => (
            <div key={c.id} className="bg-[var(--r-surface-elevated)] border border-[var(--r-border)] p-3.5 rounded-[var(--r-radius)] flex items-start gap-3 shadow-sm">
              <span className="text-[11px] font-bold text-[var(--r-muted)] tabular-nums w-7 shrink-0 text-center pt-0.5">{i + 1}</span>
              <span className="w-2.5 h-2.5 rounded-full border border-black shrink-0 mt-1.5" style={{ background: retroStatusColor(c.status) }} aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm text-white" style={{ background: retroStatusColor(c.status) }}>
                    {(c.status ?? "unknown").toUpperCase()}
                  </span>
                  {c.derived_confidence > 0 && (
                    <span className="text-[11px] tabular-nums font-mono text-[var(--r-muted)]">
                      conf {(c.derived_confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-[14px] leading-relaxed text-[var(--r-ink)]" style={{ fontFamily: "Georgia, serif" }}>
                  {c.text}
                </p>
                {c.confidence_vector && (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--r-muted)] pt-1">
                    <span className="w-14 font-semibold uppercase">Contra</span>
                    <span className="flex-1 max-w-[240px] h-[6px] bg-[var(--r-surface)] border border-[var(--r-border)] rounded-sm overflow-hidden">
                      <span className="block h-full bg-red-700" style={{ width: `${Math.max(0, Math.min(1, c.confidence_vector.contradiction_level ?? 0)) * 100}%` }} />
                    </span>
                    <span className="tabular-nums font-mono">{(c.confidence_vector.contradiction_level ?? 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
