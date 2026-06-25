"use client";

import { useState, useEffect } from "react";

interface TourStep {
  title: string;
  body: string;
  icon: string;
}

const STEPS: TourStep[] = [
  {
    title: "Ask Anything",
    body: "Type any question here. I'll research the web, look up articles, and build rich responses with maps, timelines, and diagrams.",
    icon: "💬",
  },
  {
    title: "Choose Your Model",
    body: "Pick which AI model powers your research. DeepSeek Flash for speed, Pro for depth, Gemma for a balanced approach.",
    icon: "🧠",
  },
  {
    title: "Open the Truth Console",
    body: "Toggle the Console panel to watch the agent work in real-time — every web search, tool call, and result as it happens.",
    icon: "🎛️",
  },
  {
    title: "Explore Rich Responses",
    body: "Responses aren't just text — they include interactive maps, timelines, Mermaid diagrams, image galleries, and more.",
    icon: "✨",
  },
  {
    title: "Chat History",
    body: "All your conversations are saved in the sidebar. Revisit past chats, pick up where you left off, or start fresh.",
    icon: "📋",
  },
];

export default function ChatTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    setLeaving(true);
    setTimeout(() => onComplete(), 300);
  }

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.5)", zIndex: "var(--z-tour)" }}
      onClick={handleDismiss}
    >
      <div
        className={`w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-xl transition-all duration-300 ${leaving ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? "24px" : "6px",
                background: i <= step ? "var(--accent)" : "var(--border)",
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-4xl text-center mb-4">{s.icon}</div>

        {/* Title */}
        <h3 className="text-base font-semibold text-center mb-2" style={{ color: "var(--ink)" }}>
          {s.title}
        </h3>

        {/* Body */}
        <p className="text-sm text-center leading-relaxed mb-6" style={{ color: "var(--muted)" }}>
          {s.body}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleDismiss}
            className="text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--subtle)" }}
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="btn btn-secondary btn-sm"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn btn-primary btn-sm"
            >
              {isLast ? "Get Started" : "Next"}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <p className="text-[10px] text-center mt-4" style={{ color: "var(--subtle)" }}>
          {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
