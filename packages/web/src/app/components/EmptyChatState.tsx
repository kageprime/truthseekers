"use client";

interface EmptyChatStateProps {
  suggestedTopics: string[];
  onSetInput: (val: string) => void;
}

export default function EmptyChatState({ suggestedTopics, onSetInput }: EmptyChatStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center animate-fade-in">
      <img src="/logo.png" alt="Truthseekers" className="mb-4" style={{ height: 48, width: "auto", objectFit: "contain" }} />
      <p className="text-sm mb-8 max-w-md" style={{ color: "var(--muted)" }}>Ask anything — I'll research and build rich, interactive responses with maps, timelines, diagrams, and more.</p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {suggestedTopics.map((topic) => (
          <button
            key={topic}
            onClick={() => onSetInput(topic)}
            className="px-4 py-2 text-sm rounded-full border transition-colors hover:bg-[var(--accent-bg)] hover:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}
