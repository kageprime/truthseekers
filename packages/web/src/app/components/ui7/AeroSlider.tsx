"use client";

import React from "react";

export interface AeroSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  onChange: (val: number) => void;
  className?: string;
}

export default function AeroSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  label,
  onChange,
  className = "",
}: AeroSliderProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-[11px] font-semibold text-[#1e3a8a] mb-1">
          <span>{label}</span>
          <span className="font-mono text-[10px] bg-white/80 px-1.5 py-0.5 rounded border border-blue-200">{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1b6ec2] focus:outline-hidden"
      />
    </div>
  );
}
