"use client";

import React from "react";

export interface AeroProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  className?: string;
}

export default function AeroProgressBar({
  value,
  label,
  className = "",
}: AeroProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-[10px] font-semibold text-[#1e3a8a] mb-1">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="aero-progress h-3.5 bg-slate-200 border border-slate-400 rounded-[3px] overflow-hidden shadow-inner relative">
        <div
          className="aero-progress-fill h-full bg-gradient-to-b from-green-300 via-green-500 to-green-700 transition-all duration-300 relative"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
