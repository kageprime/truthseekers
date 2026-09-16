"use client";

import React from "react";

export interface AeroWindowProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  statusText?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function AeroWindow({
  title = "Truthseekers — Knowledge Base",
  icon = "/logo-icon.png",
  children,
  statusText,
  onClose,
  onMinimize,
  onMaximize,
  className = "",
  style,
}: AeroWindowProps) {
  return (
    <div
      className={`r-window aero-window w-full flex flex-col rounded-[8px] overflow-hidden border border-[rgba(255,255,255,0.7)] shadow-2xl transition-colors duration-200 ${className}`}
      style={{
        background: "rgba(240, 245, 250, 0.90)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        boxShadow: "0 12px 40px rgba(0, 20, 50, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        ...style,
      }}
    >
      {/* 7.css Aero Glass Titlebar */}
      <div className="r-title aero-title flex items-center justify-between px-3 select-none shrink-0 gap-2 h-[34px] border-b border-[rgba(140,180,220,0.5)] bg-gradient-to-b from-[rgba(230,242,255,0.85)] via-[rgba(185,215,245,0.7)] to-[rgba(180,215,250,0.75)]">
        <div className="flex items-center gap-2 text-[#0c2038] text-[12px] font-semibold truncate drop-shadow-xs">
          {icon && <img src={icon} alt="" className="w-4 h-4 object-contain shrink-0" />}
          <span className="truncate">{title}</span>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="w-6 h-5 flex items-center justify-center text-[10px] text-[#1e3a8a] bg-white/40 hover:bg-white/70 border border-white/60 rounded-[2px] transition-colors"
              title="Minimize"
            >
              _
            </button>
          )}
          {onMaximize && (
            <button
              onClick={onMaximize}
              className="w-6 h-5 flex items-center justify-center text-[10px] text-[#1e3a8a] bg-white/40 hover:bg-white/70 border border-white/60 rounded-[2px] transition-colors"
              title="Maximize"
            >
              □
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-5 flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-b from-rose-400 to-rose-600 hover:from-rose-500 hover:to-rose-700 border border-rose-800 rounded-[2px] shadow-xs cursor-pointer transition-colors"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">{children}</div>

      {/* Aero Status Bar */}
      {statusText && (
        <div className="h-6 bg-gradient-to-b from-[#e5effa] to-[#d6e5f5] border-t border-[rgba(140,180,220,0.6)] flex items-center px-3 text-[10px] text-[#334155] justify-between shrink-0">
          <span className="font-medium truncate">{statusText}</span>
          <span className="text-[9px] text-[#64748b]">Windows 7 Aero Glass</span>
        </div>
      )}
    </div>
  );
}
