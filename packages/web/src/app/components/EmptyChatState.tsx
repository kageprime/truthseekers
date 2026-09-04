"use client";

import { useState, useRef, useEffect } from "react";
import EyebrowTag from "./EyebrowTag";
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

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
    <div className="flex flex-col items-center justify-center min-h-full px-5 sm:px-6 py-16 sm:py-24 text-center">
      {/* Eyebrow */}
      <div className="reveal-blur mb-7 sm:mb-9">
        <EyebrowTag label="Research · Live agent" />
      </div>

      {/* Brand mark + headline */}
      <div className="reveal-blur mb-7 sm:mb-9 flex flex-col items-center gap-5">
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--gold) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
            boxShadow: "0 12px 40px -12px color-mix(in srgb, var(--gold) 40%, transparent)",
          }}
        >
          <IconChat size={32} style={{ color: "var(--gold)" }} />
        </div>
        <div>
          <h1
            className="font-display font-bold mb-2"
            style={{
              fontSize: "clamp(1.85rem, 1.2rem + 2.5vw, 2.75rem)",
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              color: "var(--ink)",
            }}
          >
            What should we research?
          </h1>
          <p className="text-sm sm:text-base max-w-md mx-auto leading-relaxed" style={{ color: "var(--muted)" }}>
            Ask anything — the agent builds a nine-stage epistemic pipeline, then returns a structured answer with maps, timelines, diagrams, and every claim sourced.
          </p>
        </div>
      </div>

      {/* Double-Bezel composer */}
      <div className="w-full max-w-2xl mb-10 sm:mb-14 reveal-blur">
        <div className="bezel">
          <div
            className="bezel-inner flex items-end gap-2 p-2 sm:p-2.5"
            style={{ borderRadius: "calc(2rem - 1.5px)" }}
          >
            <div className="flex-1 min-w-0">
              <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about any topic…"
                rows={1}
                className="w-full resize-none bg-transparent border-none outline-none text-sm sm:text-[15px] min-h-[40px] sm:min-h-[44px] max-h-[200px] text-ink placeholder:text-subtle/60 px-3 py-2.5"
                style={{ lineHeight: "1.5" }}
                aria-label="Chat message input"
              />
            </div>
            <button
              onClick={submit}
              disabled={!value.trim()}
              aria-label="Send message"
              className="cta-bevel shrink-0 !p-1.5 !gap-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <span className="cta-bevel-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </span>
            </button>
          </div>
        </div>
        <p className="mt-3 text-[10px] tracking-wider uppercase" style={{ color: "var(--subtle)" }}>
          <kbd className="px-1.5 py-0.5 rounded border font-mono normal-case tracking-normal" style={{ borderColor: "var(--rule)", background: "var(--surface-elevated)" }}>⏎</kbd>{" "}
          to send · shift+⏎ for new line
        </p>
      </div>

      {/* Topic suggestions as Doppelrand cards */}
      <div className="w-full max-w-2xl space-y-5 sm:space-y-6 reveal-blur">
        {topicCategories.map((cat) => (
          <div key={cat.label}>
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <span className="eyebrow !text-[9px] !py-0.5">{cat.label}</span>
              <div
                className="h-px flex-1 max-w-[60px]"
                style={{ background: "color-mix(in srgb, var(--rule) 70%, transparent)" }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center">
              {cat.topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => onSetInput(topic)}
                  className="bezel !p-px cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                >
                  <span
                    className="bezel-inner block px-3.5 py-1.5 text-xs sm:text-[13px] transition-colors duration-300"
                    style={{
                      color: "var(--ink-secondary)",
                      borderRadius: "calc(2rem - 1.5px)",
                    }}
                  >
                    {topic}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
