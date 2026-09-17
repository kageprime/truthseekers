"use client";

export interface ClaimItem {
  id: string;
  text: string;
  status?: string;
  derived_confidence?: number;
  source_title?: string;
  contradiction_level?: number;
  confidence_vector?: Record<string, number>;
  evidence?: any[];
  signature?: string;
}

interface GroupedClaimsListProps {
  claims: ClaimItem[];
  onSelectClaim: (claim: ClaimItem) => void;
  title?: string;
  subtitle?: string;
}

export default function GroupedClaimsList({
  claims,
  onSelectClaim,
  title = "Empirical propositions",
  subtitle = "Select a claim to inspect its evidence",
}: GroupedClaimsListProps) {
  if (!claims || claims.length === 0) {
    return null;
  }

  const statusOf = (status?: string) => {
    const s = (status || "verified").toLowerCase();
    if (s === "contested") return { label: "Contested", className: "text-oxblood" };
    if (s === "developing") return { label: "Developing", className: "text-gold" };
    if (s === "unknown") return { label: "Unverified", className: "text-subtle" };
    return { label: "Verified", className: "text-forest" };
  };

  return (
    <section className="my-10">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-4">
        <h2 className="font-display text-2xl font-bold text-ink">
          {title} <span className="font-mono text-sm font-normal text-subtle tabular-nums">({claims.length})</span>
        </h2>
        {subtitle && <span className="font-serif italic text-sm text-muted">{subtitle}</span>}
      </div>

      <div className="ledger">
        {claims.map((claim, index) => {
          const st = statusOf(claim.status);
          const confidencePct = claim.derived_confidence
            ? Math.round(claim.derived_confidence * 100)
            : 95;

          return (
            <button
              key={claim.id || index}
              onClick={() => onSelectClaim(claim)}
              className="ledger-row group w-full text-left"
            >
              <span className="index-numeral">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-serif text-[17px] leading-snug text-ink group-hover:text-gold transition-colors">
                  {claim.text}
                </span>
                <span className="block text-xs text-muted truncate mt-1">
                  {claim.source_title || "Primary literature corpus"}
                  {"  ·  "}
                  <span className={`font-semibold ${st.className}`}>{st.label}</span>
                </span>
              </span>
              <span className="font-mono text-xs text-subtle tabular-nums shrink-0">
                {confidencePct}%
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
