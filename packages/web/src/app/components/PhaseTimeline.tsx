"use client";

import { IconSearch, IconClipboard, IconPencil, IconCheck, IconLightning, IconPalette, IconImage, IconDatabase } from "./Icons";

const PHASES = [
  { key: "researching", icon: IconSearch, label: "Research" },
  { key: "outline", icon: IconClipboard, label: "Outline" },
  { key: "writing", icon: IconPencil, label: "Write" },
  { key: "verifying", icon: IconCheck, label: "Verify" },
  { key: "correcting", icon: IconLightning, label: "Correct" },
  { key: "media", icon: IconPalette, label: "Media" },
  { key: "images", icon: IconImage, label: "Images" },
  { key: "storing", icon: IconDatabase, label: "Store" },
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
        const IconComp = p.icon;
        const isDone = activeIdx > i;
        const isActive = activeIdx === i;
        const isLast = i === PHASES.length - 1;

        return (
          <div key={p.key} className={`phase-step ${isDone ? "done" : ""} ${isActive ? "active" : ""} ${isError && isActive ? "error" : ""}`}>
            <div className="phase-node">
              <IconComp size={16} />
            </div>
            <span className="phase-label">{p.label}</span>
            {!isLast && <div className={`phase-line ${isDone ? "done" : ""}`} />}
          </div>
        );
      })}
      {isError && onError && (
        <button onClick={onError} className="btn btn-primary btn btn-sm" style={{ marginLeft: "1rem" }}>
          Retry
        </button>
      )}
    </div>
  );
}
