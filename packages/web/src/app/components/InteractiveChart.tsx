"use client";

import { useState } from "react";
import type { ChartBlockData } from "@encarta/core";

export default function InteractiveChart({
  chartType = "bar",
  title,
  caption,
  xAxisLabel,
  yAxisLabel,
  labels = [],
  datasets = [],
}: ChartBlockData) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!labels || labels.length === 0 || !datasets || datasets.length === 0) {
    return null;
  }

  // Calculate scaling
  const allValues = datasets.flatMap((d: { data: number[] }) => d.data);
  const maxVal = Math.max(...allValues, 1);
  const colors = ["var(--accent, #3b82f6)", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="my-6 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm">
      {title && <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">{title}</h4>}
      {yAxisLabel && <p className="text-[11px] text-[var(--subtle)] font-mono mb-2">{yAxisLabel}</p>}

      {/* SVG Chart Render */}
      <div className="relative h-56 w-full flex items-end gap-2 pt-6 pb-6 border-b border-[var(--border)]">
        {labels.map((label: string, idx: number) => {
          return (
            <div
              key={`col-${idx}`}
              className="flex-1 h-full flex flex-col justify-end items-center relative group"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Bars for each dataset */}
              <div className="w-full flex items-end justify-center gap-1 h-full">
                {datasets.map((ds: { label: string; data: number[]; color?: string }, dsIdx: number) => {
                  const val = ds.data[idx] ?? 0;
                  const heightPct = Math.max(5, (val / maxVal) * 100);
                  const color = ds.color ?? colors[dsIdx % colors.length];

                  return (
                    <div
                      key={`ds-${dsIdx}-${idx}`}
                      className="w-full max-w-[28px] rounded-t transition-all duration-200 hover:brightness-110"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: color,
                      }}
                    />
                  );
                })}
              </div>

              {/* Tooltip on hover */}
              {hoveredIdx === idx && (
                <div className="absolute -top-12 z-20 rounded bg-black/90 px-2 py-1 text-xs text-white shadow-md pointer-events-none whitespace-nowrap">
                  <div className="font-semibold">{label}</div>
                  {datasets.map((ds: { label: string; data: number[] }, dsIdx: number) => (
                    <div key={dsIdx} className="text-[11px] opacity-90">
                      {ds.label}: <span className="font-mono">{ds.data[idx]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* X Axis labels */}
      <div className="flex justify-between mt-2 px-1 text-[11px] text-[var(--subtle)] font-mono">
        {labels.map((label: string, idx: number) => (
          <span key={`xlabel-${idx}`} className="truncate max-w-[60px] text-center">
            {label}
          </span>
        ))}
      </div>
      {xAxisLabel && <p className="text-center text-[11px] text-[var(--subtle)] font-mono mt-1">{xAxisLabel}</p>}

      {/* Legend & Caption */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--subtle)] pt-2 border-t border-[var(--border)]/50">
        <div className="flex items-center gap-3">
          {datasets.map((ds: { label: string; color?: string }, dsIdx: number) => (
            <div key={`leg-${dsIdx}`} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ds.color ?? colors[dsIdx % colors.length] }}
              />
              <span>{ds.label}</span>
            </div>
          ))}
        </div>
        {caption && <span className="italic">{caption}</span>}
      </div>
    </div>
  );
}
