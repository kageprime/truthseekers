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
  title = "Empirical Propositions & Scrutiny",
  subtitle = "Select a claim to view evidence and provenance",
}: GroupedClaimsListProps) {
  if (!claims || claims.length === 0) {
    return null;
  }

  const getStatusBadge = (status?: string) => {
    const s = (status || "verified").toLowerCase();
    if (s === "contested") {
      return {
        badgeBg: "bg-amber-100 text-amber-900 border-amber-200",
        avatarBg: "bg-amber-50 text-amber-700",
        label: "Contested",
      };
    }
    if (s === "debated" || s === "developing") {
      return {
        badgeBg: "bg-purple-100 text-purple-900 border-purple-200",
        avatarBg: "bg-purple-50 text-purple-700",
        label: "Developing",
      };
    }
    return {
      badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
      avatarBg: "bg-blue-50 text-blue-600",
      label: "Verified",
    };
  };

  return (
    <div className="space-y-3 my-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          {title} ({claims.length})
        </h2>
        {subtitle && <span className="text-xs text-zinc-400">{subtitle}</span>}
      </div>

      <div className="rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden bg-white shadow-xs">
        {claims.map((claim, index) => {
          const { badgeBg, avatarBg, label } = getStatusBadge(claim.status);
          const confidencePct = claim.derived_confidence
            ? Math.round(claim.derived_confidence * 100)
            : 95;

          return (
            <div
              key={claim.id || index}
              onClick={() => onSelectClaim(claim)}
              className="p-4 sm:p-5 flex items-center justify-between cursor-pointer group hover:bg-zinc-50/80 transition-colors"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectClaim(claim);
                }
              }}
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-4">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${avatarBg} flex items-center justify-center font-bold text-xs sm:text-sm shrink-0`}
                >
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors line-clamp-1">
                    {claim.text}
                  </div>
                  <div className="text-[11px] sm:text-xs text-zinc-500 truncate mt-0.5 flex items-center gap-1.5">
                    <span>{claim.source_title || "Primary Literature Corpus"}</span>
                    <span>·</span>
                    <span className="font-mono text-zinc-600">{confidencePct}% Confidence</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className={`text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeBg}`}>
                  {label}
                </span>
                <span className="text-zinc-400 text-lg font-light group-hover:text-zinc-700 transition-colors">
                  ›
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
