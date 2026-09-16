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
  title = "Hilbert State Space Dimension",
  formulaDescription = "Formula: 2ᴺ orthogonal states vs classical supercomputer simulation runtime",
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
    if (n >= 53) return "~10,000 Years (Exascale Summit / Frontier)";
    if (n >= 40) return "~2.5 Days (Summit Supercomputer Simulation)";
    if (n >= 30) return "~4 Minutes (High-End GPU Cluster)";
    return "< 1 Second (Standard Classical CPU)";
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-6 sm:p-8 space-y-6 bg-white shadow-xs my-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-0.5">
            Interactive Epistemic Tool
          </div>
          <h3 className="text-base font-bold text-zinc-900">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{formulaDescription}</p>
        </div>
        <div className="sm:text-right bg-blue-50/50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
          <div className="text-xl sm:text-2xl font-mono font-bold text-blue-600">
            {calculateStates(qubits)}
          </div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
            Orthogonal Quantum States
          </div>
        </div>
      </div>

      {/* Interactive Slider */}
      <div className="space-y-3">
        <div className="flex justify-between text-xs font-semibold text-zinc-700">
          <span>Transmon Qubits (N):</span>
          <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
            {qubits} Qubits
          </span>
        </div>
        <input
          type="range"
          min={minQubits}
          max={maxQubits}
          value={qubits}
          onChange={(e) => setQubits(parseInt(e.target.value, 10))}
          className="w-full accent-zinc-900 cursor-pointer h-2 bg-zinc-200 rounded-lg"
          aria-label="Transmon Qubits Slider"
        />
        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
          <span>{minQubits} qubits</span>
          <span>{maxQubits} qubits</span>
        </div>
      </div>

      {/* Classical Comparison */}
      <div className="bg-[#FEFDF8] rounded-xl p-4 text-xs text-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-zinc-200/80">
        <span className="font-medium text-zinc-600">Classical Simulation Runtime:</span>
        <span className="font-bold text-zinc-900 font-mono text-xs sm:text-sm">
          {getRuntimeEstimate(qubits)}
        </span>
      </div>
    </div>
  );
}
