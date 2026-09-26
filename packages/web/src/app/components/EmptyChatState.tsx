"use client";

const topicCategories: { label: string; topics: string[] }[] = [
  {
    label: "History & Civilizations",
    topics: [
      "Analyze the collapse mechanisms of the Western Roman Empire",
      "What primary innovations triggered the Industrial Revolution?",
    ],
  },
  {
    label: "Science & Epistemics",
    topics: [
      "How does CRISPR prime editing compare with base editing?",
      "Explain the epistemic tension in quantum entanglement proofs",
    ],
  },
  {
    label: "Technology & Systems",
    topics: [
      "Synthesize an overview of post-quantum cryptography standards",
      "Map the key contested milestones in deep space exploration",
    ],
  },
];

interface EmptyChatStateProps {
  onSetInput: (val: string) => void;
}

export default function EmptyChatState({ onSetInput }: EmptyChatStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 sm:px-8 py-12 sm:py-16 text-center max-w-3xl mx-auto">
      {/* Folio Eyebrow */}
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sharp border border-rule bg-surface-elevated text-[10px] font-mono uppercase tracking-[0.18em] text-muted mb-6 shadow-elev-1">
        <span className="w-1.5 h-1.5 rounded-full bg-forest animate-pulse" />
        <span>Veritas Autonomous Epistemic Studio</span>
      </div>

      {/* Main Masthead Headline */}
      <div className="mb-8 space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight">
          What shall we investigate today?
        </h1>
        <p className="font-serif italic text-muted text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          Inquire into any historical event, scientific debate, or complex system. Veritas will retrieve primary sources, adjudicate claims, and synthesize evidence-backed briefs.
        </p>
      </div>

      {/* Suggestion Categories */}
      <div className="w-full space-y-6 pt-2">
        <div className="flex items-center gap-3 justify-center text-[11px] font-mono uppercase tracking-[0.16em] text-subtle">
          <span className="h-px w-12 bg-rule" />
          <span>Select an inquiry or pose your own</span>
          <span className="h-px w-12 bg-rule" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          {topicCategories.map((cat) => (
            <div
              key={cat.label}
              className="p-4 rounded-sharp border border-rule bg-surface-elevated/70 flex flex-col justify-between hover:border-gold/60 hover:bg-gold-bg/10 transition-colors shadow-elev-1 group"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-gold font-semibold mb-2.5 pb-1.5 border-b border-rule/60 flex items-center justify-between">
                <span>{cat.label}</span>
                <span className="text-subtle group-hover:text-gold transition-colors">↗</span>
              </div>
              <div className="space-y-2">
                {cat.topics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => onSetInput(topic)}
                    className="w-full text-left font-serif text-[13px] leading-snug text-ink/90 hover:text-ink hover:underline decoration-gold decoration-1 underline-offset-2 transition-colors cursor-pointer block"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

