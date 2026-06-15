"use client";

interface FollowUpSuggestionsProps {
  followUps: string[];
  onClick: (msg: string) => void;
}

export default function FollowUpSuggestions({ followUps, onClick }: FollowUpSuggestionsProps) {
  return (
    <div className="px-6 py-4">
      <p className="text-[10px] pixel mb-3" style={{ color: "var(--subtle)" }}>SUGGESTED FOLLOW-UPS</p>
      <div className="flex flex-wrap gap-2">
        {followUps.map((q, i) => (
          <button
            key={i}
            onClick={() => onClick(q)}
            className="px-4 py-2 text-xs rounded-xl border transition-colors hover:bg-[#f5f5f4]"
            style={{ borderColor: "#e5e5e5", color: "var(--ink)", background: "white" }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
