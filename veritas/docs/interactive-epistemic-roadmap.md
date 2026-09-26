# Interactive Epistemic Workbench & Advanced Visual Features Roadmap

This document outlines the complete implementation specification and status for Truthseekers (Encarta NG) interactive epistemic reader features, advanced media visual interactivity, autonomous CMS management, and DAG workflow optimizations.

---

## Architecture & Roadmap Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Epistemic Workbench & Reader Fact-Checking (COMPLETED)           │
│  ├─ Sentence-Level Evidence Inspector Side Drawer                         │
│  └─ Community Evidence & Counter-Source Submission                        │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Advanced Visual & Spatial Interactivity (COMPLETED)               │
│  ├─ "Time Machine" Map Comparison Block (map_compare)                     │
│  ├─ Ultra-Wide Panoramic Map Viewer (map_panoramic)                       │
│  ├─ Interactive Code & Formula Playgrounds (interactive_calc)             │
│  └─ Archival Photo Lightbox Metadata & Museum Provenance                  │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Veritas Autonomous CMS Engine & DAG Optimizations (COMPLETED)    │
│  ├─ Parallel Media Node (generate_media) & Conditional Scrutinize Skip    │
│  ├─ VeritasWorker Background Watchdog & Policy Guardrails (requireApproval)│
│  └─ Global 3-Column Dual-Sidebar Grid Layout                              │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Interactive Epistemic Workbench & Reader Fact-Checking (COMPLETED)

### 1.1 Sentence-Level Evidence Inspector
- **Implementation**: now [ClaimDetailRail.tsx](file:///c:/Users/kage/agent/encarta-ng/packages/web/src/app/components/article/ClaimDetailRail.tsx) — the original `EpistemicInspectorDrawer.tsx` was retired (dead code) when claim details converged on the right-rail surface.
- **Features**:
  - Clicking any anchored sentence (`[claim:id]`) opens the right rail displaying:
    - Claim ID & text.
    - Derived Confidence Rating & vector breakdown.
    - Raw Source Passages from Layer 1 `retrieve`.
    - Language Precision Upgrades from Layer 2 `map_language`.
    - Dissent & Scrutiny Notes.

### 1.2 Community Evidence Submission
- **Implementation**: [handlers.go](file:///c:/Users/kage/agent/encarta-ng/veritas/go-orchestrator/internal/api/handlers.go) (`POST /claims/:id/evidence`)
- **Features**:
  - Readers submit primary links + context notes to open gaps.
  - Submissions trigger targeted mini-scrutiny runs to update claim vectors.

---

## Phase 2: Richer Visual & Spatial Interactivity (COMPLETED)

### 2.1 "Time Machine" Map Comparison Block (`map_compare`) & Panoramic Maps (`map_panoramic`)
- **Implementation**: [MapCompareViewer.tsx](file:///c:/Users/kage/agent/encarta-ng/packages/web/src/app/components/MapCompareViewer.tsx) & [PanoramicMapViewer.tsx](file:///c:/Users/kage/agent/encarta-ng/packages/web/src/app/components/PanoramicMapViewer.tsx)
- **Features**:
  - Dual map canvas split slider for historical vs. modern cartography.
  - Ultra-wide panoramic topographical map viewer with drag-pan, zoom, hotspot pins, and time overlay.

### 2.2 Interactive Code & Formula Playgrounds (`interactive_calc`)
- **Implementation**: [InteractiveCalcWidget.tsx](file:///c:/Users/kage/agent/encarta-ng/packages/web/src/app/components/InteractiveCalcWidget.tsx)
- **Features**:
  - Parameter sliders for physics, mathematics, and economics formulas recalculating values in real time.

### 2.3 Archival Photo Lightbox Metadata
- **Implementation**: [MediaImage.tsx](file:///c:/Users/kage/agent/encarta-ng/packages/web/src/app/components/MediaImage.tsx)
- **Features**:
  - Lightbox metadata drawer displaying repository institution, rights license, and high-res downloads.

---

## Phase 3: Autonomous Engine & DAG Optimizations (COMPLETED)

### 3.1 Veritas Autonomous CMS Engine
- **Implementation**: [autonomous.go](file:///c:/Users/kage/agent/encarta-ng/veritas/go-orchestrator/internal/api/autonomous.go)
- **Features**:
  - `VeritasWorker` runs background watchdog tasks (staleness refresh, gap mini-scrutiny, graph reindex) on an hourly cycle.
  - `requireApproval` IAM policy guardrails block high-impact operations (`delete_article`, `rotate_credentials`, `change_tier`, `bulk_generate`).
  - `get_autonomous_summary` chat tool reports activity audit logs to the user.

### 3.2 DAG Optimizations
- **Implementation**: [pipeline.go](file:///c:/Users/kage/agent/encarta-ng/veritas/go-orchestrator/internal/agent/pipeline.go) & [generate.go](file:///c:/Users/kage/agent/encarta-ng/veritas/go-orchestrator/internal/api/generate.go)
- **Features**:
  - Parallel `generate_media` node runs concurrently with `generate_article` once `resolve` finishes.
  - Conditional `scrutinize` node skipping for consensus topics with 0 contested claims.

### 3.3 Global 3-Column Layout
- **Implementation**: [RetroShell.tsx](file:///c:/Users/kage/agent/encarta-ng/packages/web/src/app/components/retro/RetroShell.tsx) & [GlobalRightSidebar.tsx](file:///c:/Users/kage/agent/encarta-ng/packages/web/src/app/components/GlobalRightSidebar.tsx)
- **Features**:
  - `[Left Contents Index] | [Centered Main Reading Canvas] | [Right Epistemic Rail]` layout across all platform pages.
