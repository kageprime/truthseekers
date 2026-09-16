"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export interface AeroTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export default function AeroTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  className = "",
}: AeroTabsProps) {
  return (
    <div className={`w-full ${className}`}>
      {/* 7.css Tab Header Strip */}
      <div className="aero-tabs-header flex gap-0.5 border-b border-[#7096b8] px-2 pt-1 bg-gradient-to-b from-white/40 to-white/10">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`aero-tab text-[11px] font-bold px-3 py-1.5 rounded-t-[4px] border border-b-0 cursor-pointer transition-all ${
                isActive
                  ? "aero-tab-active bg-white text-[#1e3a8a] border-[#7096b8] shadow-xs -mb-[1px] pb-[7px]"
                  : "bg-gradient-to-b from-[#f1f5f9] to-[#cbd5e1] text-[#334155] border-[#94a3b8] hover:bg-gradient-to-b hover:from-white hover:to-[#e2e8f0]"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panel Body */}
      {children && (
        <div className="p-3 bg-white/95 border border-t-0 border-[#7096b8] rounded-b-[4px] shadow-xs">
          {children}
        </div>
      )}
    </div>
  );
}
