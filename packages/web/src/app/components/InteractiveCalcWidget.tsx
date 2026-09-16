"use client";

import { useState } from "react";
import type { InteractiveCalcBlockData, CalcVariable } from "@encarta/core";

export default function InteractiveCalcWidget({
  title = "Interactive Physical / Financial Playground",
  formulaDisplay = "E = m · c²",
  caption,
  variables = [
    { name: "m", label: "Mass (kg)", min: 1, max: 100, step: 1, defaultVal: 10, unit: "kg" },
    { name: "c", label: "Speed of Light (10⁸ m/s)", min: 1, max: 10, step: 1, defaultVal: 3, unit: "10⁸ m/s" },
  ],
  expression = "m * (c * c)",
}: InteractiveCalcBlockData) {
  // Initialize state with default variable values
  const [vals, setVals] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const v of variables) {
      init[v.name] = v.defaultVal;
    }
    return init;
  });

  const handleChange = (name: string, val: number) => {
    setVals((prev) => ({ ...prev, [name]: val }));
  };

  // Evaluate formula expression safely
  const computeResult = (): number => {
    try {
      // Build Function with variable names
      const varNames = variables.map((v) => v.name);
      const varValues = varNames.map((n) => vals[n] ?? 0);
      const fn = new Function(...varNames, `return ${expression};`);
      const res = fn(...varValues);
      return typeof res === "number" && !isNaN(res) ? res : 0;
    } catch {
      return 0;
    }
  };

  const result = computeResult();

  return (
    <div className="my-6 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ⚡ INTERACTIVE FORMULA PLAYGROUND
        </span>
      </div>

      {title && <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">{title}</h4>}
      {formulaDisplay && (
        <div className="my-2 p-2.5 rounded bg-black/40 border border-[var(--border)] font-mono text-center text-sm text-[var(--accent,#3b82f6)] font-bold">
          {formulaDisplay}
        </div>
      )}

      {/* Variables Range Sliders */}
      <div className="my-4 space-y-3">
        {variables.map((v: CalcVariable) => (
          <div key={v.name} className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[var(--foreground)] font-medium">{v.label}:</span>
              <span className="text-[var(--accent,#3b82f6)] font-bold">
                {vals[v.name] ?? v.defaultVal} {v.unit ?? ""}
              </span>
            </div>
            <input
              type="range"
              min={v.min}
              max={v.max}
              step={v.step ?? 1}
              value={vals[v.name] ?? v.defaultVal}
              onChange={(e) => handleChange(v.name, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent,#3b82f6)]"
            />
          </div>
        ))}
      </div>

      {/* Calculated Output Gauge */}
      <div className="p-3 rounded bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between">
        <span className="text-xs font-mono font-semibold text-[var(--subtle)]">CALCULATED RESULT:</span>
        <span className="text-base font-mono font-bold text-emerald-400">
          {result.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
      </div>

      {caption && <p className="mt-2 text-xs text-[var(--subtle)] italic">{caption}</p>}
    </div>
  );
}
