"use client";

const PHASES = [
  { key: "researching", icon: "🔍", label: "Research" },
  { key: "outline", icon: "📋", label: "Outline" },
  { key: "writing", icon: "✍️", label: "Write" },
  { key: "verifying", icon: "✅", label: "Verify" },
  { key: "correcting", icon: "🔧", label: "Correct" },
  { key: "media", icon: "🎨", label: "Media" },
  { key: "images", icon: "🖼️", label: "Images" },
  { key: "storing", icon: "💾", label: "Store" },
];

export function currentPhaseIndex(phase: string): number {
  const map: Record<string, number> = {
    starting: 0,
    research: 0,
    researching: 0,
    outline: 1,
    write: 2,
    writing: 2,
    verify: 3,
    verifying: 3,
    correcting: 4,
    "generate-media": 5,
    "generating-images": 6,
    media: 5,
    store: 7,
    storing: 7,
    complete: 8,
    done: 8,
    error: -1,
  };
  return map[phase] ?? -1;
}

export default function PhaseTimeline({ currentPhase, onError }: { currentPhase: string; onError?: () => void }) {
  const activeIdx = currentPhaseIndex(currentPhase);
  const isError = currentPhase === "error";

  return (
    <div className="phase-timeline">
      {PHASES.map((p, i) => {
        const isDone = activeIdx > i;
        const isActive = activeIdx === i;
        const isLast = i === PHASES.length - 1;

        return (
          <div key={p.key} className={`phase-step ${isDone ? "done" : ""} ${isActive ? "active" : ""} ${isError && isActive ? "error" : ""}`}>
            <div className="phase-node">
              <span className="phase-icon">{p.icon}</span>
            </div>
            <span className="phase-label">{p.label}</span>
            {!isLast && <div className={`phase-line ${isDone ? "done" : ""}`} />}
          </div>
        );
      })}
      {isError && onError && (
        <button onClick={onError} className="btn-primary btn-sm" style={{ marginLeft: "1rem" }}>
          Retry
        </button>
      )}
    </div>
  );
}
