"use client";

interface FollowUpSuggestionsProps {
  followUps: string[];
  onClick: (msg: string) => void;
}

export default function FollowUpSuggestions({ followUps, onClick }: FollowUpSuggestionsProps) {
  if (!followUps?.length) return null;
  return (
    <div className="px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--subtle)" }}>Suggested follow-ups</p>
      <div className="flex flex-wrap gap-2">
        {followUps.map((q, i) => (
          <button
            key={i}
            onClick={() => onClick(q)}
            className="group relative px-3.5 py-2 text-xs rounded-xl border transition-all duration-200 hover:scale-[1.03] hover:shadow-sm active:scale-[0.97]"
            style={{
              borderColor: "var(--border)",
              color: "var(--ink)",
              background: "var(--surface-glass)",
              backdropFilter: "blur(4px)",
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
