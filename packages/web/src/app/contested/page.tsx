"use client";

import { useState } from "react";
import { useContestedClaims } from "../hooks";
import { retroStatusColor } from "@/lib/retro";

// ponytail: retro fault-line ledger — rank, status chip, conf bar. Same hook, new chrome.
export default function ContestedPage() {
  const [limit, setLimit] = useState(50);
  const { data: res, loading } = useContestedClaims(limit);
  const claims = (res?.claims as Array<{
    id: string; text: string; status: string;
    derived_confidence: number; confidence_vector?: Record<string, number>;
  }> | undefined) ?? [];

  return (
    <>
      <div className="border-b-[3px] border-[#0a2a5e] pb-3 mb-4">
        <div className="text-[10px] text-[#0a2a5e] font-bold tracking-widest uppercase">Living Encyclopedia • Fault lines</div>
        <h1 className="r-h1 mt-1" style={{ fontSize: 28 }}>Most Contested Claims</h1>
        <p className="text-[11px] mt-1" style={{ color: "#555" }}>
          Where the evidence is genuinely divided, ranked by contradiction.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-bold">Show:</span>
        {[10, 25, 50, 100].map((n) => (
          <button
            key={n}
            onClick={() => setLimit(n)}
            className="px-2.5 py-[2px] text-[11px] border-[2px] bg-[#d4d0c8] text-black"
            style={{ borderStyle: limit === n ? "inset" : "outset" }}
            aria-pressed={limit === n}
          >
            {n}
          </button>
        ))}
      </div>

      {loading && <div className="text-[11px] py-8 text-center" style={{ color: "#8a7f68" }}>Reading the fault lines…</div>}

      {!loading && claims.length === 0 && (
        <div className="text-[11px] py-12 text-center border-[2px] bg-[#ffffe1]" style={{ borderStyle: "outset", borderWidth: 2 }}>No contested claims recorded yet.</div>
      )}

      {claims.length > 0 && (
        <div className="space-y-1.5">
          {claims.map((c, i) => (
            <div key={c.id} className="bg-white border-[2px] p-2 flex items-start gap-2" style={{ borderStyle: "outset", borderWidth: 2 }}>
              <span className="text-[11px] font-bold text-[#8a7f68] tabular-nums w-7 shrink-0 text-center pt-0.5">{i + 1}</span>
              <span className="w-2.5 h-2.5 rounded-full border border-black shrink-0 mt-1" style={{ background: retroStatusColor(c.status) }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 border border-black text-white" style={{ background: retroStatusColor(c.status) }}>
                    {(c.status ?? "unknown").toUpperCase()}
                  </span>
                  {c.derived_confidence > 0 && (
                    <span className="text-[10px] tabular-nums" style={{ color: "#555" }}>
                      conf {c.derived_confidence.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-[12px] leading-[1.5] text-black" style={{ fontFamily: "Georgia,serif" }}>
                  {c.text}
                </p>
                {c.confidence_vector && (
                  <div className="mt-1.5 flex items-center gap-2 text-[10px]" style={{ color: "#555" }}>
                    <span className="w-16">contra</span>
                    <span className="flex-1 max-w-[220px] h-[6px] bg-[#efe9d5] border border-[#8a7f68]">
                      <span className="block h-full bg-[#a33a3a]" style={{ width: `${Math.max(0, Math.min(1, c.confidence_vector.contradiction_level ?? 0)) * 100}%` }} />
                    </span>
                    <span className="tabular-nums">{(c.confidence_vector.contradiction_level ?? 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
