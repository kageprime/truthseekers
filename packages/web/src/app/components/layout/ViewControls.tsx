"use client";

import { useUiMode } from "../../context/UiModeContext";

/**
 * ViewControls — the reading-preference groups (width / alignment / type
 * scale), lifted verbatim out of the old header. One component, two homes:
 * the Reading desk rail (≥xl) and the masthead `Aa` popover (<xl).
 * State lives in UiModeContext, so both instances always agree.
 */
export default function ViewControls({ className = "" }: { className?: string }) {
  const { widthMode, setWidthMode, alignMode, setAlignMode, typeScale, setTypeScale } = useUiMode();

  const ctlOn = "text-ink font-semibold underline decoration-gold decoration-2 underline-offset-4 cursor-pointer";
  const ctlOff = "text-subtle hover:text-ink cursor-pointer";

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Width — Focus keeps a short measure, Expanded breathes */}
      <div>
        <p className="view-ctl-label">Width</p>
        <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-wider" role="group" aria-label="Reading width">
          <button
            type="button"
            onClick={() => setWidthMode("focus")}
            aria-pressed={widthMode === "focus"}
            title="Compact focus measure"
            className={`transition-colors tracking-wider ${widthMode === "focus" ? ctlOn : ctlOff}`}
          >
            Focus
          </button>
          <span className="text-rule" aria-hidden>/</span>
          <button
            type="button"
            onClick={() => setWidthMode("expanded")}
            aria-pressed={widthMode === "expanded"}
            title="Breathable expanded layout"
            className={`transition-colors tracking-wider ${widthMode === "expanded" ? ctlOn : ctlOff}`}
          >
            Expanded
          </button>
        </div>
      </div>

      {/* Align — left hangs the column off the gutter, center floats it */}
      <div>
        <p className="view-ctl-label">Align</p>
        <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-wider" role="group" aria-label="Reading column alignment">
          <button
            type="button"
            onClick={() => setAlignMode("left")}
            aria-pressed={alignMode === "left"}
            title="Left-aligned column — anchored to the contents index"
            className={`transition-colors tracking-wider ${alignMode === "left" ? ctlOn : ctlOff}`}
          >
            Left
          </button>
          <span className="text-rule" aria-hidden>/</span>
          <button
            type="button"
            onClick={() => setAlignMode("center")}
            aria-pressed={alignMode === "center"}
            title="Centered column — floats in the viewport"
            className={`transition-colors tracking-wider ${alignMode === "center" ? ctlOn : ctlOff}`}
          >
            Center
          </button>
        </div>
      </div>

      {/* Type — rem knob on html[data-type] */}
      <div>
        <p className="view-ctl-label">Type</p>
        <div className="flex items-center gap-1.5 text-xs font-mono" role="group" aria-label="Adjustable type size">
          {(["s", "m", "l"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTypeScale(s)}
              aria-pressed={typeScale === s}
              title={s === "s" ? "Compact type" : s === "m" ? "Standard type" : "Large type"}
              className={`px-1 uppercase transition-colors ${typeScale === s ? ctlOn : ctlOff}`}
              style={{ fontSize: s === "s" ? "0.65rem" : s === "m" ? "0.75rem" : "0.85rem" }}
            >
              {s === "s" ? "A" : s === "m" ? "A+" : "A++"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}