"use client";

import React from "react";

export interface AeroGlassPanelProps {
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function AeroGlassPanel({
  title,
  headerRight,
  children,
  className = "",
  style,
}: AeroGlassPanelProps) {
  return (
    <div
      className={`aero-glass-panel rounded-[6px] border border-[rgba(255,255,255,0.8)] shadow-md overflow-hidden ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.80)",
        backdropFilter: "blur(12px) saturate(1.2)",
        WebkitBackdropFilter: "blur(12px) saturate(1.2)",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        ...style,
      }}
    >
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(180,210,240,0.5)] bg-gradient-to-b from-white/90 to-white/50 text-[11px] font-bold text-[#1e3a8a]">
          <span>{title}</span>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
