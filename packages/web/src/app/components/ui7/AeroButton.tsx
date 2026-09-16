"use client";

import React from "react";

export interface AeroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "standard" | "primary" | "danger" | "glass";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
}

export default function AeroButton({
  children,
  variant = "standard",
  size = "md",
  icon,
  className = "",
  disabled,
  ...props
}: AeroButtonProps) {
  const sizeClasses =
    size === "sm"
      ? "text-[11px] px-2 py-0.5"
      : size === "lg"
      ? "text-[13px] px-4 py-2"
      : "text-[12px] px-3 py-1";

  const variantStyle =
    variant === "primary"
      ? {
          background: "linear-gradient(180deg, #e3f2fd 0%, #bbdefb 45%, #90caf9 50%, #c8e6c9 100%)",
          borderColor: "#1976d2",
          color: "#0d47a1",
        }
      : variant === "danger"
      ? {
          background: "linear-gradient(180deg, #ffebee 0%, #ffcdd2 45%, #ef9a9a 50%, #ff8a80 100%)",
          borderColor: "#c62828",
          color: "#b71c1c",
        }
      : variant === "glass"
      ? {
          background: "rgba(255, 255, 255, 0.45)",
          borderColor: "rgba(255, 255, 255, 0.7)",
          color: "#0c2038",
          backdropFilter: "blur(8px)",
        }
      : {
          background: "linear-gradient(180deg, #f7fafc 0%, #e2eef8 45%, #cbdcf0 50%, #e3f0fb 100%)",
          borderColor: "#7096b8",
          color: "#1a365d",
        };

  return (
    <button
      disabled={disabled}
      className={`aero-btn inline-flex items-center justify-center gap-1.5 font-semibold rounded-[4px] border shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(0,0,0,0.1)",
        ...variantStyle,
      }}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
