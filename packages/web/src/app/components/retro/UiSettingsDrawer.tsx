"use client";

import React, { useState } from "react";
import { useUiSettings, type UiPreset } from "../../context/UiSettingsContext";

export default function UiSettingsDrawer() {
  const {
    settings,
    toggleSetting,
    applyPreset,
    resetDefaults,
    isDrawerOpen,
    toggleDrawer,
    closeDrawer,
  } = useUiSettings();

  const [activeTab, setActiveTab] = useState<"presets" | "layout" | "article" | "rail">("presets");

  return (
    <>
      {/* Floating Aero Trigger Button */}
      <button
        onClick={toggleDrawer}
        aria-label="Toggle UI Scaffold Settings"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer shadow-lg aero-glass-panel hover:brightness-110 active:scale-95"
        style={{
          background: "rgba(240, 245, 252, 0.92)",
          border: "1px solid rgba(120, 160, 200, 0.8)",
          color: "#0c2038",
        }}
      >
        <span className="text-base leading-none">⚙</span>
        <span>UI Scaffold</span>
        <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
          Ctrl+Shift+U
        </span>
      </button>

      {/* Settings Modal / Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-appear-blur">
          <div
            className="w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden border border-[#7096b8] flex flex-col max-h-[85vh] animate-appear-up"
            style={{
              background: "rgba(245, 248, 252, 0.96)",
              backdropFilter: "blur(20px) saturate(1.4)",
            }}
          >
            {/* Aero Title Bar */}
            <div
              className="px-4 py-2.5 flex items-center justify-between border-b border-[#a0c0e0] select-none"
              style={{
                background: "linear-gradient(180deg, #e6f2ff 0%, #b9d7f5 100%)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">⚙</span>
                <span className="font-bold text-[13px] text-[#0c2038]">
                  UI Scaffolding & Component Remodeling Controller
                </span>
              </div>
              <button
                onClick={closeDrawer}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-700 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets Ribbon */}
            <div className="p-3 bg-white/70 border-b border-[#c8daf0] flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 mr-1 tracking-wider">
                Presets:
              </span>
              <button
                onClick={() => applyPreset("barebones")}
                className="px-2.5 py-1 text-[11px] font-bold rounded border transition-all cursor-pointer bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                title="Strip all chrome down to barebones document text"
              >
                ⚡ Barebones Scaffold
              </button>
              <button
                onClick={() => applyPreset("win7")}
                className="px-2.5 py-1 text-[11px] font-bold rounded border transition-all cursor-pointer bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100"
                title="Standard Windows 7 Aero layout"
              >
                🪟 Win7 Aero (Default)
              </button>
              <button
                onClick={() => applyPreset("reading")}
                className="px-2.5 py-1 text-[11px] font-bold rounded border transition-all cursor-pointer bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100"
                title="Clean reading canvas without sidebars"
              >
                📖 Clean Reading
              </button>
              <button
                onClick={() => applyPreset("studio")}
                className="px-2.5 py-1 text-[11px] font-bold rounded border transition-all cursor-pointer bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100"
                title="Full epistemic studio with all tools"
              >
                🔬 Full Studio
              </button>
              <button
                onClick={resetDefaults}
                className="ml-auto text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Reset All
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[#c8daf0] bg-slate-100/50 px-3 pt-2 text-[12px] gap-1">
              {[
                { id: "layout", label: "Layout & Chrome" },
                { id: "article", label: "Article Components" },
                { id: "rail", label: "Right Rail Widgets" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 font-medium rounded-t border-t border-x cursor-pointer transition-all ${
                    activeTab === tab.id
                      ? "bg-white border-[#a0c0e0] text-[#1b6ec2] font-semibold border-b-transparent translate-y-[1px]"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Body */}
            <div className="p-4 overflow-y-auto max-h-[50vh] space-y-3 r-scroll">
              {activeTab === "layout" && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-500 mb-2">
                    Toggle high-level structural columns and window scaffolding:
                  </div>
                  <ToggleItem
                    label="Left Navigation Pane"
                    description="Windows 7 Start Menu / Explorer Navigation Sidebar"
                    checked={settings.showLeftNav}
                    onChange={() => toggleSetting("showLeftNav")}
                  />
                  <ToggleItem
                    label="Right Epistemic Rail"
                    description="Figure plate, claim inspector, and fact box column"
                    checked={settings.showRightRail}
                    onChange={() => toggleSetting("showRightRail")}
                  />
                  <ToggleItem
                    label="Aero Titlebar"
                    description="Top window frame title, icon, and minimize/maximize buttons"
                    checked={settings.showTitleBar}
                    onChange={() => toggleSetting("showTitleBar")}
                  />
                  <ToggleItem
                    label="Window Status Bar"
                    description="Bottom system ready status bar"
                    checked={settings.showStatusBar}
                    onChange={() => toggleSetting("showStatusBar")}
                  />
                  <ToggleItem
                    label="Window Bezel Frame"
                    description="Aero Glass frosted glass borders and shadows (turn off for flat full bleed)"
                    checked={settings.showWindowFrame}
                    onChange={() => toggleSetting("showWindowFrame")}
                  />
                </div>
              )}

              {activeTab === "article" && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-500 mb-2">
                    Turn off any section of the article page down to a raw text scaffold:
                  </div>
                  <ToggleItem
                    label="Article Header & Abstract Deck"
                    description="Category pill, article title, and lead italic abstract"
                    checked={settings.showArticleHeader}
                    onChange={() => toggleSetting("showArticleHeader")}
                  />
                  <ToggleItem
                    label="Action Bar"
                    description="Contest, Regenerate, and What Changed buttons"
                    checked={settings.showActionBar}
                    onChange={() => toggleSetting("showActionBar")}
                  />
                  <ToggleItem
                    label="Overview Section"
                    description="Lead overview narrative and dropcap paragraph"
                    checked={settings.showOverview}
                    onChange={() => toggleSetting("showOverview")}
                  />
                  <ToggleItem
                    label="Detailed Findings Sections"
                    description="Main body sections, subsections, and media items"
                    checked={settings.showDetailedFindings}
                    onChange={() => toggleSetting("showDetailedFindings")}
                  />
                  <ToggleItem
                    label="Extracted Claims Grid"
                    description="List of verified/contested claims with confidence percentages"
                    checked={settings.showClaimsGrid}
                    onChange={() => toggleSetting("showClaimsGrid")}
                  />
                  <ToggleItem
                    label="Interactive Claim Graph & Controversy"
                    description="Force-directed debate graph and dispute mapping"
                    checked={settings.showClaimGraph}
                    onChange={() => toggleSetting("showClaimGraph")}
                  />
                  <ToggleItem
                    label="Epistemic Quiz"
                    description="Interactive 'Weakest Link' critical thinking question"
                    checked={settings.showEpistemicQuiz}
                    onChange={() => toggleSetting("showEpistemicQuiz")}
                  />
                  <ToggleItem
                    label="Inline Claim Anchor Chips"
                    description="Highlight claims with interactive [1] tags (turn off for plain unstyled text)"
                    checked={settings.showInlineClaimChips}
                    onChange={() => toggleSetting("showInlineClaimChips")}
                  />
                  <ToggleItem
                    label="Footer Plate"
                    description="Copyright notice and evidence grounding watermark"
                    checked={settings.showFooterPlate}
                    onChange={() => toggleSetting("showFooterPlate")}
                  />
                </div>
              )}

              {activeTab === "rail" && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-500 mb-2">
                    Control what appears in the right sidebar rail:
                  </div>
                  <ToggleItem
                    label="Live Claim Inspector"
                    description="Detailed evidence sources, confidence vector, and counter-evidence when clicking claims"
                    checked={settings.showClaimInspector}
                    onChange={() => toggleSetting("showClaimInspector")}
                  />
                  <ToggleItem
                    label="Figure Plate"
                    description="Hero media plate (Fig. 1) with zoom preview"
                    checked={settings.showFigurePlate}
                    onChange={() => toggleSetting("showFigurePlate")}
                  />
                  <ToggleItem
                    label="Did You Know? Box"
                    description="Epistemic methodology fact file"
                    checked={settings.showDidYouKnow}
                    onChange={() => toggleSetting("showDidYouKnow")}
                  />
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-3 bg-slate-100/80 border-t border-[#c8daf0] flex items-center justify-between text-[11px] text-slate-600">
              <span>Settings automatically saved to localStorage</span>
              <button
                onClick={closeDrawer}
                className="px-3 py-1 bg-[#1b6ec2] text-white font-semibold rounded text-xs hover:bg-[#15589e] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-start justify-between p-2.5 rounded border border-[#d8e4f0] bg-white/80 hover:bg-white transition-colors cursor-pointer select-none">
      <div className="pr-3">
        <div className="text-[12px] font-semibold text-[#0c2038]">{label}</div>
        <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{description}</div>
      </div>
      <div className="relative inline-flex items-center shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1b6ec2]"></div>
      </div>
    </label>
  );
}
