"use client";

import { useEffect, useState } from "react";
import { fetchContestedClaims } from "@/lib/api";
import ConfidenceRadar from "@/app/components/ConfidenceRadar";

interface ContestedClaim {
  id: string;
  text: string;
  status: string;
  derived_confidence: number;
  confidence_vector?: Record<string, number>;
}

const STATUS_COLOR: Record<string, string> = {
  disputed: "#b33c3c",
  weak: "#b87a2e",
  supported: "#2b7a4b",
};

export default function ContestedPage() {
  const [claims, setClaims] = useState<ContestedClaim[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchContestedClaims(limit).then((res) => {
      if (!alive) return;
      setClaims((res?.claims as ContestedClaim[]) || []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [limit]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-serif mb-2 text-ink">Most Contested Claims</h1>
      <p className="text-xs text-subtle mb-8">
        The claims across the encyclopedia that carry the highest contradiction level or fall into dispute —
        the fault lines where the evidence is genuinely divided.
      </p>

      <div className="mb-6 text-[11px]" style={{ color: "var(--muted, #777)" }}>
        Show:{" "}
        {[10, 25, 50, 100].map((n) => (
          <button
            key={n}
            onClick={() => setLimit(n)}
            className="px-2 py-0.5 rounded-full border cursor-pointer mr-1"
            style={{
              borderColor: "var(--border-light, #e5e5e5)",
              background: limit === n ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
              color: limit === n ? "var(--accent)" : "var(--muted, #777)",
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {loading && <div className="text-xs text-subtle">Loading…</div>}

      {!loading && (!claims || claims.length === 0) && (
        <div className="text-xs text-subtle py-16 text-center">No contested claims recorded yet.</div>
      )}

      {claims && claims.length > 0 && (
        <div className="space-y-2">
          {claims.map((c, i) => {
            const col = STATUS_COLOR[c.status] || "#8a8a8a";
            return (
              <div key={c.id} className="p-4 rounded-lg border flex items-start gap-4" style={{ borderColor: "var(--border, #e5e5e5)" }}>
                <div className="w-7 shrink-0 text-center text-[11px] font-mono pt-0.5" style={{ color: "var(--subtle, #999)" }}>
                  {i + 1}
                </div>
                <ConfidenceRadar vector={c.confidence_vector} size={88} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: col + "1a", color: col }}
                    >
                      {c.status}
                    </span>
                    {c.derived_confidence > 0 && (
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--muted, #777)" }}>
                        conf {c.derived_confidence.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--ink)" }}>
                    {c.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
