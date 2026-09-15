"use client";

import { useState } from "react";
import { useTimeMachine } from "../hooks/useTimeMachine";
import { IconClock, IconX } from "./Icons";

const PRESET_ERAS = [
  { label: "Ancient World", era: "500 BCE", year: "-500" },
  { label: "Renaissance", era: "1500 CE", year: "1500" },
  { label: "Turn of Century", era: "1900 CE", year: "1900" },
  { label: "Mid-20th Century", era: "1945", year: "1945" },
  { label: "Present Day", era: "Present", year: "2026" },
];

export default function TimeMachineBar() {
  const { activeEra, isActive, isOpen, setEra, close, reset } = useTimeMachine();
  const [customInput, setCustomInput] = useState("");

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setEra(customInput.trim());
    setCustomInput("");
  };

  return (
    <div className="fixed top-14 inset-x-0 z-[60] flex justify-center px-4 animate-appear-down pointer-events-none">
      <div
        className="pointer-events-auto max-w-2xl w-full p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all flex flex-col gap-3"
        style={{
          background: "color-mix(in srgb, var(--surface-elevated, #fbf6e9) 95%, black)",
          borderColor: "var(--gold, #a67c2f)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 0 0 2px var(--gold)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border-light)" }}>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-gold/15 text-gold">
              <IconClock size={18} />
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gold">Time Machine Mode</div>
              <div className="text-[11px] text-muted">
                {isActive ? (
                  <span>Simulating state of knowledge & world in <strong className="text-accent font-bold">{activeEra}</strong></span>
                ) : (
                  <span>Select an era to explore history through that point in time</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <button
                onClick={reset}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gold/10 text-gold hover:bg-gold/20 transition-colors cursor-pointer"
              >
                Reset to Present
              </button>
            )}
            <button
              onClick={close}
              className="p-1 rounded hover:bg-black/10 text-muted transition-colors cursor-pointer"
              aria-label="Close Time Machine"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Preset Era Scrubber Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PRESET_ERAS.map((item) => {
            const isSelected = activeEra === item.era;
            return (
              <button
                key={item.era}
                onClick={() => setEra(item.era)}
                className={`py-2 px-2 rounded-xl text-xs font-medium transition-all text-center flex flex-col items-center justify-center cursor-pointer border ${
                  isSelected
                    ? "bg-accent text-white border-accent font-bold shadow-md scale-102"
                    : "bg-surface border-border text-ink hover:border-accent"
                }`}
              >
                <span className="text-[10px] opacity-75">{item.label}</span>
                <span className="text-xs">{item.era}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Year Input Form */}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Or enter custom era (e.g. 1348, 1888, 50 BCE)..."
            className="flex-1 bg-surface border border-border rounded-xl px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!customInput.trim()}
            className="px-3 py-1.5 rounded-xl bg-gold text-black font-bold text-xs hover:brightness-110 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Jump ⏳
          </button>
        </form>
      </div>
    </div>
  );
}
