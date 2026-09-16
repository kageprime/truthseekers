"use client";

import React from "react";

export interface AeroBadgeProps {
  children: React.ReactNode;
  variant?: "blue" | "green" | "amber" | "rose" | "glass";
  icon?: React.ReactNode;
  className?: string;
}

export default function AeroBadge({
  children,
  variant = "blue",
  icon,
  className = "",
}: AeroBadgeProps) {
  const variantStyles =
    variant === "green"
      ? "bg-gradient-to-b from-emerald-50 to-emerald-100 text-emerald-900 border-emerald-300"
      : variant === "amber"
      ? "bg-gradient-to-b from-amber-50 to-amber-100 text-amber-900 border-amber-300"
      : variant === "rose"
      ? "bg-gradient-to-b from-rose-50 to-rose-100 text-rose-900 border-rose-300"
      : variant === "glass"
      ? "bg-white/60 text-slate-800 border-white/80 backdrop-blur-xs"
      : "bg-gradient-to-b from-blue-50 to-blue-100 text-blue-900 border-blue-300";

  return (
    <span
      className={`aero-badge inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border shadow-xs ${variantStyles} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
