"use client";

const iconMap: Record<string, string> = {
  "What": "🔍",
  "How": "⚙️",
  "Why": "💡",
  "Who": "👤",
  "Where": "📍",
  "When": "📅",
  "Explain": "📖",
  "Compare": "⚖️",
  "Show": "🖼️",
  "Tell": "🗣️",
  "Create": "✨",
  "Generate": "✨",
};

function getIcon(topic: string): string {
  for (const [prefix, icon] of Object.entries(iconMap)) {
    if (topic.startsWith(prefix)) return icon;
  }
  return "💬";
}

interface EmptyChatStateProps {
  suggestedTopics: string[];
  onSetInput: (val: string) => void;
}

export default function EmptyChatState({ suggestedTopics, onSetInput }: EmptyChatStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center animate-fade-in">
      <div className="mb-6 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl bg-accent-bg">
        🧠
      </div>
      <p className="text-sm mb-8 max-w-md leading-relaxed text-muted">
        Ask anything — I'll research and build rich, interactive responses with maps, timelines, diagrams, and more.
      </p>
      <div className="flex flex-wrap gap-2.5 justify-center max-w-lg">
        {suggestedTopics.map((topic) => (
          <button
            key={topic}
            onClick={() => onSetInput(topic)}
            className="group relative px-4 py-2.5 text-sm rounded-xl border border-border text-ink bg-surface-glass/60 backdrop-blur transition-all duration-200 hover:scale-[1.03] hover:shadow-md active:scale-[0.97]"
          >
            <span className="mr-1.5 opacity-70">{getIcon(topic)}</span>
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}