"use client";

import { useState, useRef, useEffect } from "react";
import { IconChat } from "./retro/icons";

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
      <div className="mb-7 sm:mb-9">
        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#0a2a5e] text-white border border-[#0a2a5e] tracking-widest uppercase">Research • Live agent</span>
      </div>

      {/* Brand mark + headline */}
      <div className="mb-7 sm:mb-9 flex flex-col items-center gap-5">
        <div
          className="w-16 h-16 flex items-center justify-center bg-[#d4d0c8] text-[#0a2a5e]"
          style={{ borderStyle: "outset", borderWidth: 3, borderColor: "#fff8e0 #8a7f68 #8a7f68 #fff8e0", boxShadow: "4px 4px 0 rgba(0,0,0,.35)" }}
        >
          <IconChat size={30} />
        </div>
        <div>
          <h1
            className="font-bold mb-2 text-[#0a2a5e]"
            style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: "clamp(1.85rem, 1.2rem + 2.5vw, 2.75rem)", lineHeight: 1.05 }}
          >
            What should we research?
          </h1>
          <p className="text-[13px] max-w-md mx-auto leading-relaxed" style={{ color: "#555" }}>
            Ask anything — the agent builds a nine-stage epistemic pipeline, then returns a structured answer with maps, timelines, diagrams, and every claim sourced.
          </p>
        </div>
      </div>

      {/* Double-Bezel composer */}
      <div className="w-full max-w-2xl mb-10 sm:mb-14">
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
        <p className="mt-3 text-[10px] tracking-wider uppercase" style={{ color: "#8a7f68" }}>
          <kbd className="px-1.5 py-0.5 border font-mono normal-case tracking-normal bg-white text-black" style={{ borderStyle: "outset", borderWidth: 2 }}>⏎</kbd>{" "}
          to send · shift+⏎ for new line
        </p>
      </div>

      {/* Topic suggestions */}
      <div className="w-full max-w-2xl space-y-5 sm:space-y-6">
        {topicCategories.map((cat) => (
          <div key={cat.label}>
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#0a2a5e] text-white tracking-widest uppercase">{cat.label}</span>
              <div className="h-[2px] flex-1 max-w-[60px] bg-[#0a2a5e]" />
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
