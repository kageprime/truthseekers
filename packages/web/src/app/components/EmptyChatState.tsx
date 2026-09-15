"use client";

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

// ponytail: display-only — composer lives pinned in page footer, pills send directly.
export default function EmptyChatState({ onSetInput }: EmptyChatStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-5 sm:px-6 py-10 sm:py-16 text-center">
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
            Ask anything — we research deeply, then return maps, timelines, diagrams, and sourced claims. Use the composer below.
          </p>
        </div>
      </div>

      {/* Topic suggestions — 44px touch targets */}
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
                  className="bezel !p-px cursor-pointer transition-all duration-300 hover:-translate-y-0.5 min-h-[44px]"
                >
                  <span
                    className="bezel-inner flex items-center px-3.5 py-2.5 text-xs sm:text-[13px] transition-colors duration-300 min-h-[42px]"
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
