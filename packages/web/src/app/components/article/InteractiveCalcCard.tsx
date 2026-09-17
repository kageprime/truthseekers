"use client";

import { useState } from "react";

interface InteractiveCalcCardProps {
  title?: string;
  formulaDescription?: string;
  minQubits?: number;
  maxQubits?: number;
  initialQubits?: number;
}

export default function InteractiveCalcCard({
  title = "Hilbert state space",
  formulaDescription = "2ᴺ orthogonal states vs classical supercomputer simulation runtime",
  minQubits = 10,
  maxQubits = 80,
  initialQubits = 53,
}: InteractiveCalcCardProps) {
  const [qubits, setQubits] = useState(initialQubits);

  const calculateStates = (n: number): string => {
    const states = Math.pow(2, n);
    if (n > 40) {
      return states.toExponential(3);
    }
    return states.toLocaleString();
  };

  const getRuntimeEstimate = (n: number): string => {
    if (n >= 53) return "~10,000 years (exascale Summit / Frontier)";
    if (n >= 40) return "~2.5 days (Summit supercomputer simulation)";
    if (n >= 30) return "~4 minutes (high-end GPU cluster)";
    return "< 1 second (standard classical CPU)";
  };

  return (
    <section className="border border-rule rounded-sharp bg-surface-elevated p-6 sm:p-8 my-8" aria-label={title}>
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-border-light pb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold mb-1">
            Interactive figure
          </div>
          <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
          <p className="font-serif italic text-sm text-muted mt-0.5">{formulaDescription}</p>
        </div>
        <div className="sm:text-right">
          <div className="font-mono text-2xl font-semibold text-ink tabular-nums">
            {calculateStates(qubits)}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle">
            Orthogonal states
          </div>
        </div>
      </div>

      <div className="pt-5 space-y-3">
        <div className="flex justify-between text-[13px] font-medium text-ink">
          <span>Qubits (N)</span>
          <span className="font-mono tabular-nums">{qubits}</span>
        </div>
        <input
          type="range"
          min={minQubits}
          max={maxQubits}
          value={qubits}
          onChange={(e) => setQubits(parseInt(e.target.value, 10))}
          className="w-full accent-gold cursor-pointer"
          aria-label="Qubits slider"
        />
        <div className="flex justify-between text-[11px] font-mono text-subtle tabular-nums">
          <span>{minQubits}</span>
          <span>{maxQubits}</span>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-border-light flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">Classical simulation runtime</span>
        <span className="font-mono text-sm text-ink tabular-nums">
          {getRuntimeEstimate(qubits)}
        </span>
      </div>
    </section>
  );
}
