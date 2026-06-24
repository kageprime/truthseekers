"use client";

import { useState } from "react";
import { IconChat } from "./Icons";

const topicCategories: { label: string; topics: string[] }[] = [
  {
    label: "History",
    topics: ["Explain the history of the Roman Empire", "What caused the Industrial Revolution?"],
  },
  {
    label: "Science",
    topics: ["How does CRISPR gene editing work?", "Explain quantum entanglement"],
  },
  {
    label: "Technology",
    topics: ["What is quantum computing?", "Show me a timeline of space exploration"],
  },
];

interface EmptyChatStateProps {
  onSetInput: (val: string) => void;
}

export default function EmptyChatState({ onSetInput }: EmptyChatStateProps) {
  const [value, setValue] = useState("");

  function submit() {
    const v = value.trim();
    if (!v) return;
    onSetInput(v);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12 text-center animate-fade-in">
      {/* Brand mark */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)" }}>
          <IconChat size={24} style={{ color: "var(--gold)" }} />
        </div>
        <div className="text-left">
          <h1 className="font-display-heading text-xl text-ink leading-tight">Truthseekers</h1>
          <p className="text-[11px] text-subtle leading-tight">The Living Encyclopedia</p>
        </div>
      </div>

      <p className="text-sm mb-8 max-w-md leading-relaxed text-muted">
        Ask anything — I&apos;ll research and build rich, interactive responses with maps,
        timelines, diagrams, and more.
      </p>

      {/* Centered input */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-end gap-2 rounded-2xl p-2 bg-surface-elevated border border-border shadow-sm focus-within:border-accent transition-colors">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any topic..."
            rows={1}
            autoFocus
            className="w-full resize-none bg-transparent border-none textarea-ring px-3 py-2.5 text-sm min-h-[40px] max-h-[200px] text-ink outline-none"
          />
          <button
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Send message"
            className={`btn-icon shrink-0 rounded-[10px] transition-colors ${value.trim() ? "bg-accent text-white" : "bg-border text-subtle"}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Categorized topic suggestions */}
      <div className="w-full max-w-2xl space-y-3">
        {topicCategories.map((cat) => (
          <div key={cat.label} className="flex flex-wrap items-center gap-2 justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle shrink-0">
              {cat.label}
            </span>
            {cat.topics.map((topic) => (
              <button
                key={topic}
                onClick={() => onSetInput(topic)}
                className="px-3.5 py-1.5 text-xs rounded-full border border-border text-ink-secondary bg-surface-glass/60 backdrop-blur transition-all duration-200 hover:border-accent hover:text-accent hover:scale-[1.02] active:scale-[0.98]"
              >
                {topic}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
