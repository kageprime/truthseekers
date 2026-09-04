# Specification: Layout & UI Consistency Pass

**Project**: Truthseekers (encarta-ng)  
**Author**: UX Architecture  
**Status**: Draft for Dev Review  
**Date**: 2026-06-12  

---

## Table of Contents

1. [Layout Architecture Reform](#1-layout-architecture-reform)
2. [Footer Fix (Article Generation)](#2-footer-fix-article-generation)
3. [Button Design System](#3-button-design-system)
4. [Migration Strategy](#4-migration-strategy)

---

## 1. Layout Architecture Reform

### 1.1 Problem Summary

Each page currently assembles its own hero/wave/title section independently, leading to:

- Duplicated wave SVG markup in `page.tsx` (Home) and `maps/page.tsx`
- Inconsistent page-title placement (hero on Home/Maps, action bar on Article, nothing on Queue/New Article)
- Search bar appearing only on Home and Maps via `showSearch` prop, which produces a disorienting appearance/disappearance on navigation
- No unified component for page-level headings/subtitles

### 1.2 Proposed Component: `PageHero`

Create a new component at `components/PageHero.tsx` to replace all standalone hero/header sections. This component owns the wave SVG rendering, gradient background, and title area.

```tsx
// Proposed interface
interface PageHeroProps {
  title: string;
  subtitle?: string;
  gradient: "blue" | "green";  // maps to the two gradient presets
  waveColor?: string;           // defaults to var(--warm)
  children?: React.ReactNode;   // optional action buttons, search override, etc.
}
```

The component renders:

- A `<header>` with `relative overflow-hidden` + gradient background
- Title/subtitle in the `z-10` layer with white text
- The wave SVG at bottom (exact same `d="M0,60..."` path, using `wave-anim` class)
- If `children` provided, renders them in the title area (right-aligned or below title)

The SVG wave must not be duplicated — it lives in exactly one file.

### 1.3 Proposed Component: `SectionHeader`

Create a helper at `components/SectionHeader.tsx` for in-page section headings (used in article sections, maps sections, queue). This is a small presentational component.

```tsx
interface SectionHeaderProps {
  emoji?: string;
  title: string;
  accent?: string;    // CSS color for the underline bar, defaults to var(--orange)
  className?: string;
}
```

Renders:

```html
<div class="flex items-center gap-4 mb-6">
  {emoji && <span class="text-2xl">{emoji}</span>}
  <div>
    <h2 class="pixel text-sm">{title}</h2>
    <div class="h-1 w-12 mt-1" style={{ background: accent }} />
  </div>
</div>
```

This pattern already exists in ~10 places with near-identical markup (page.tsx:432-437, maps/page.tsx:83-88, queue/page.tsx:132-137, etc.). The migration should replace every instance with `<SectionHeader>`.

### 1.4 SharedHeader Changes

**Remove the `showSearch` prop entirely** from `SharedHeader`, `PageLayout`, and all call sites. Instead:

- The search bar becomes a page-level element rendered inside `PageHero` (for Home and Maps) or as a standalone component `SearchBar` that pages can optionally place.
- `SharedHeader` loses the `showSearch`/`query`/`onQueryChange`/`onSearch`/`onClear`/`searching`/`onGenerate`/`onKeyDown` props. It keeps only `links` (and optionally `children` for right-side extras).

**Why**: The search bar's conditional appearance between pages is jarring. Making it a per-page choice (rather than a `SharedHeader` toggle) gives each page explicit control while keeping the header itself stable.

### 1.5 PageLayout Changes

Simplify `PageLayout`:

- Remove `showSearch`, `query`, `onQueryChange`, `onSearch`, `onClear`, `searching`, `onGenerate`, `onKeyDown` props.
- The footer stays as-is.
- `children` now receives everything below the header — pages are responsible for their own hero/title/search area.

### 1.6 Per-Page Header Mapping

| Page | Current | After Migration |
|------|---------|-----------------|
| Home (`/`) | Inline hero `<header>` with blue gradient + wave, plus search in SharedHeader | `<PageHero gradient="blue" title="Truthseekers" subtitle="The Living Encyclopedia">` with search bar rendered as child inside the hero, OR below SharedHeader but above `<main>`. Search bar uses same `pixel-input` pattern but lives on the page, not in SharedHeader. |
| Maps (`/maps`) | Inline hero `<header>` with green gradient + wave, plus search in SharedHeader | `<PageHero gradient="green" title="World History Maps" subtitle="Explore historical maps...">` with search bar inside hero |
| Maps detail (`/maps/[slug]`) | No hero, only `<main>` | No change (no hero needed for detail pages) |
| Article (`/article/[slug]`) | Inline gray action bar with version/date/buttons | Replace inline gray bar with a `<PageTitleBar>` component (see below). No gradient/wave hero needed. |
| New Article (`/article/new`) | Nothing | No hero needed, but page-title text should use a standardized heading style (e.g., `<h1 class="pixel text-sm">`) |
| Queue (`/queue`) | Nothing | Same as New Article — standardize heading |

### 1.7 Proposed Component: `PageTitleBar`

For pages that need a simple action bar (not a gradient hero), create `components/PageTitleBar.tsx`:

```tsx
interface PageTitleBarProps {
  children: React.ReactNode;
  className?: string;
}
```

Renders a `<div>` with `border-b px-6 py-3 bg-white` (replacing the inline markup in ArticleClient.tsx:251-287). This is used by the article detail page for the version/date/buttons bar.

### 1.8 Layout Hierarchy Rules

The final layout stack is:

```
PageLayout                          (min-h-screen flex flex-col)
├─ SharedHeader                     (sticky top-0 z-50, white bg, border-b)
│  ├─ TruthseekersLogo
│  ├─ QueueIndicator
│  ├─ Desktop nav links
│  └─ HamburgerMenu
│
├─ [PageHero or PageTitleBar]       (optional — per-page choice)
│
├─ <main class="flex-1 ...">        (page content — ALL pages must use this)
│
└─ <footer>                         (border-t px-6 py-6, bg-white)
```

Every page MUST wrap its content area in `<main className="flex-1 ...">`. This is non-negotiable for correct footer positioning.

---

## 2. Footer Fix (Article Generation)

### 2.1 Bug

In `ArticleClient.tsx`, two state wrappers use a `<div>` without `flex-1`, preventing the footer from reaching the bottom of the viewport:

1. **Not generated** state (line 190): `<div className="px-6 py-12 sm:py-16">`
2. **Generating** state (line 228): `<div className="px-6 py-12 sm:py-16">`

Both lack `flex-1`.

**Correctly-behaving states** for reference:
- Error (line 151): `<main className="flex-1 flex items-center justify-center px-6 py-16">`
- Loading (line 178): `<main className="flex-1 flex items-center justify-center">`

### 2.2 Fix

**File**: `packages/web/src/app/article/[slug]/ArticleClient.tsx`

**Line 187-213 (not generated state)**:
Change the wrapper from `<div className="px-6 py-12 sm:py-16">` to `<main className="flex-1 px-6 py-12 sm:py-16">`.

**Line 226-243 (generating state)**:
Change the wrapper from `<div className="px-6 py-12 sm:py-16">` to `<main className="flex-1 px-6 py-12 sm:py-16">`.

Both wrappers can safely use `<main>` since they represent the primary content area in those states. The inner `<div className="max-w-lg mx-auto">` and `<GenerationBar>` remain nested as-is.

### 2.3 Layout Shift Consideration

The `GenerationBar`'s ProcessViewer expands as agent events arrive. With `flex-1` on the wrapper, the wrapper will grow to fill all available space. If the events extend beyond viewport height, the page will scroll naturally (the footer will be pushed below the scroll). This is the correct behavior.

However, note that `GenerationBar` has a `max-h-48` on its inner scroll container (ProcessViewer line 133). If agent events overflow, they scroll internally without pushing the page layout. This is fine — the `flex-1` container's height is determined before internal scrolling happens.

### 2.4 Full Audit of ArticleClient.tsx Wrappers

| State | Lines | Current Wrapper | Has `flex-1`? | Fix Needed? |
|-------|-------|----------------|---------------|-------------|
| Error | 148-172 | `<main className="flex-1 ...">` | Yes | No |
| Loading | 175-184 | `<main className="flex-1 ...">` | Yes | No |
| Not generated | 187-213 | `<div className="px-6 py-12 sm:py-16">` | **No** | **Yes** |
| Generating | 216-243 | `<div className="px-6 py-12 sm:py-16">` | **No** | **Yes** |
| Article rendered | 247-426 | content is direct child of `<PageLayout>` | N/A (PageLayout handles it) | No (footer sits below article content, which is tall enough) |

---

## 3. Button Design System

### 3.1 Goals

- Unify all ~15+ button instances under a shared system
- Max 3 visual variants: **Primary**, **Secondary**, **Ghost**
- Size scale: **sm**, **md**, **lg** (with mobile touch target guarantees)
- All buttons follow the pixel aesthetic (except Ghost, which is minimal)
- Definition of CSS classes in `layout.tsx` (alongside existing `pixel-btn`), or in `globals.css` if that is easier

### 3.2 Variants

#### Variant A: Primary (`btn-primary`)

For the most important action on screen: Generate, Search, Submit, Refresh, Retry.

```css
.btn-primary {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  text-transform: uppercase;
  padding: 0.6rem 1.2rem;
  border: 2px solid var(--ink);
  box-shadow: 3px 3px 0px var(--ink);
  background: var(--orange);
  color: white;
  cursor: pointer;
  transition: all 0.1s ease-out;
}
.btn-primary:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0px var(--ink);
}
.btn-primary:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0px var(--ink);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: 1px 1px 0px var(--ink);
}
```

**Color modifiers** (via data-attr or class composition):

- `btn-primary` = `background: var(--orange)` (default)
- `btn-primary[data-color="green"]` or `btn-primary-green` = `background: var(--green)` (for VIEW / done actions)
- `btn-primary[data-color="blue"]` or `btn-primary-blue` = `background: var(--blue)` (for WATCH LIVE)
- `btn-primary[data-color="red"]` or `btn-primary-red` = `background: var(--red)` (for RETRY / destructive)

**Size modifiers**:

- `btn-sm`: `padding: 0.4rem 0.8rem; font-size: 8px` (for inline actions like VIEW, JSON, MD)
- `btn-lg`: `padding: 0.8rem 1.6rem; font-size: 12px` (for hero CTA like Generate Encyclopedia Article)

#### Variant B: Secondary (`btn-secondary`)

For Clear, JSON, MD export, Browse all maps — non-primary actions that still need the pixel look.

```css
.btn-secondary {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  text-transform: uppercase;
  padding: 0.6rem 1.2rem;
  border: 2px solid var(--ink);
  box-shadow: 3px 3px 0px var(--ink);
  background: white;
  color: var(--ink);
  cursor: pointer;
  transition: all 0.1s ease-out;
}
/* hover/active/disabled same as primary */
```

Same size modifiers (`btn-sm`, `btn-lg`) apply.

#### Variant C: Ghost (`btn-ghost`)

For dismiss/close (✕), Hide links, auto-scroll toggle — minimal footprint, no heavy border/shadow.

```css
.btn-ghost {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #aaa;
  transition: color 0.1s;
}
.btn-ghost:hover {
  color: var(--ink);
}
```

For the ✕ dismiss button specifically, wrap it in a `min-h-[44px] min-w-[44px] flex items-center justify-center` container to meet touch targets.

#### Variant D: Link-style (`btn-link`)

For "Back to home", "Back to Maps", "← Back to home" text links. This is not a button — it stays as an `<a>` tag with hover underline. No CSS class needed, but a reusable `styles` object or small helper could reduce inline repetition.

### 3.3 Touch Target Rule

All interactive elements should meet `min-h-[44px]` on mobile. Apply this via:

- `btn-sm` on mobile gets extra padding via `sm:` overrides, or use a utility `.btn-sm { @apply min-h-[44px] sm:min-h-0 }`
- The Ghost/✕ button gets `min-w-[44px] min-h-[44px]` always (since mobile users need a big tap target)

### 3.4 GenerationBar Action Buttons Migration

These are currently hand-styled pixel links/buttons. They map to `btn-primary` with size `btn-sm`:

| Current | New Class | Color Modifier |
|---------|-----------|----------------|
| VIEW (`GenerationBar.tsx:175`) | `<a class="btn-primary btn-sm" data-color="green">` | `--green` |
| RETRY (`GenerationBar.tsx:184`) | `<button class="btn-primary btn-sm" data-color="red">` | `--red` |
| WATCH LIVE (`GenerationBar.tsx:233`) | `<a class="btn-primary btn-sm" data-color="blue">` | `--blue` |
| DISMISS ✕ (`GenerationBar.tsx:191`) | `<button class="btn-ghost">` wrapped in `min-h-[44px] min-w-[44px]` | none |
| RETRY GENERATION (`GenerationBar.tsx:254`) | `<button class="btn-primary btn-sm">` | orange (default) |
| VIEW (from ArticleClient's GenerationBar, via ArticleClient) | Same as VIEW above | |

The DISMISS button's current inline `border border-[#ccc] w-10 h-10` styling should be dropped in favor of the Ghost variant.

### 3.5 ProcessViewer Auto-scroll Toggle

Current: hand-styled `<button>` with conditional background (ProcessViewer.tsx:119-129).

Migrate to: `<button class="btn-ghost text-[10px]">` — the current `border` approach is not pixel-consistent. The auto-scroll toggle can use a simple text-based ghost style:

```
Auto-scroll ON  → style="color: var(--blue); font-weight: 600"
Auto-scroll OFF → style="color: #aaa"
```

No border, no background. Or, if a visual toggle is preferred, use `btn-sm` + secondary styling.

### 3.6 New Article Page Submit Button

Current (`article/new/page.tsx:46-51`): `rounded-lg bg-[#ea580c]` — this is the biggest outlier. It does not follow the pixel aesthetic at all.

Migrate to: `<button class="btn-primary btn-lg w-full">` — full-width large primary button. Remove `rounded-lg`, keep `border-2 border-black` from the pixel btn system.

Also migrate the input field on the same page from `rounded-lg border border-[#dfe1e5]` to the existing `pixel-input` class for consistency.

### 3.7 Maps 2D/3D Toggle

Current (`maps/[slug]/page.tsx:68-91`): Manually styled toggle group with conditional classes.

Migrate to: Two `<button>` elements using `btn-sm` with a new utility class or inline style for the active state. Or, keep the toggle-group pattern but give each button `btn-sm btn-secondary` styling with an `.active` modifier:

```
.active-toggle {
  background: var(--orange) !important;
  color: white !important;
}
```

This is a low-priority visual polish item. At minimum, ensure the font-family uses `'Press Start 2P'` (which it already does via inline style) and the border style matches.

---

## 4. Migration Strategy

### 4.1 Priority Order

| Priority | Scope | Files | Effort |
|----------|-------|-------|--------|
| **P0** | Footer fix (generating + not-generated state `flex-1`) | `ArticleClient.tsx` | Trivial (2 line changes) |
| **P0** | New Article page pixel consistency (submit button + input) | `article/new/page.tsx` | Small (2 component swaps) |
| **P1** | CSS class definitions for new button system | `layout.tsx` | Medium (~50 lines of CSS) |
| **P1** | Replace all inline `pixel-btn` usages with new classes | Multiple files | Medium (search/replace) |
| **P1** | Replace GenerationBar custom buttons with new system | `GenerationBar.tsx` | Medium |
| **P1** | Create `PageHero` component | New file `components/PageHero.tsx` | Medium |
| **P1** | Create `SectionHeader` component | New file `components/SectionHeader.tsx` | Small |
| **P2** | Create `PageTitleBar` component | New file `components/PageTitleBar.tsx` | Small |
| **P2** | Create `SearchBar` component | New file or inline | Small |
| **P2** | Migrate Home page hero to `PageHero` | `page.tsx` | Medium |
| **P2** | Migrate Maps page hero to `PageHero` | `maps/page.tsx` | Medium |
| **P2** | Migrate Article action bar to `PageTitleBar` | `ArticleClient.tsx` | Small |
| **P2** | Migrate all `SectionHeader` inline instances | 6-8 files | Medium |
| **P3** | Simplify `SharedHeader` props (remove search-related) | `SharedHeader.tsx`, `PageLayout.tsx`, all callers | Medium |
| **P3** | Maps 2D/3D toggle pixel-consistency pass | `maps/[slug]/page.tsx` | Small |
| **P3** | ProcessViewer auto-scroll button | `ProcessViewer.tsx` | Small |

### 4.2 Button Instance → Variant Mapping

#### `pixel-btn` instances (current class `pixel-btn`):

| Location | Current Style | New Class | Notes |
|----------|--------------|-----------|-------|
| SharedHeader Search | Orange + white | `btn-primary` | Size `md` (default) |
| SharedHeader Generate | Orange + white | `btn-primary` | Size `md` |
| SharedHeader Clear | White bg | `btn-secondary` | Size `md` |
| ErrorBoundary Try Again | Orange + white | `btn-primary` | Size `md` |
| ArticleClient Error Try Again | Orange + white | `btn-primary` | Size `md` |
| ArticleClient Not Generated Generate | Orange + white | `btn-primary` `btn-lg` | Larger CTA |
| ArticleClient Refresh | Orange + white, `text-[8px]` | `btn-primary` `btn-sm` | Size `sm` |
| ArticleClient JSON | White bg, `text-[8px]` | `btn-secondary` `btn-sm` | Size `sm` |
| ArticleClient MD | White bg, `text-[8px]` | `btn-secondary` `btn-sm` | Size `sm` |
| Home search Generate | Orange + white | `btn-primary` | Size `md` |
| Home Load More | Orange + white | `btn-primary` | Size `md` |
| Maps Clear search | White bg | `btn-secondary` | Size `md` |
| Maps detail Search Articles link | Orange + white, inline-block | `btn-primary` | Size `md` |
| Maps detail Browse all maps link | White bg, inline-block | `btn-secondary` | Size `md` |

#### Custom pixel buttons (GenerationBar):

| Location | Current Style | New Class | Notes |
|----------|--------------|-----------|-------|
| VIEW (`GenerationBar`) | Green, `pixel text-[8px]` | `btn-primary btn-sm` with `data-color="green"` | Also convert `<a>` to use `btn-primary` |
| RETRY (`GenerationBar`) | Red, same pattern | `btn-primary btn-sm` with `data-color="red"` | |
| WATCH LIVE (`GenerationBar`) | Blue, same pattern | `btn-primary btn-sm` with `data-color="blue"` | |
| DISMISS (`GenerationBar`) | Gray X, `w-10 h-10` | `btn-ghost` in `min-h-[44px] min-w-[44px]` wrapper | |
| RETRY GENERATION (error expanded) | Orange, same pattern | `btn-primary btn-sm` | Default orange |

#### Non-pixel buttons:

| Location | Current Style | New Class | Notes |
|----------|--------------|-----------|-------|
| New Article submit | `rounded-lg bg-[#ea580c]` | `btn-primary btn-lg w-full` | Replace entirely |
| Maps 2D/3D toggle | `rounded-lg border` with conditional bg | `btn-sm btn-secondary` + active modifier | Retain toggle-group layout |
| ProcessViewer auto-scroll | `rounded border` with conditional bg | `btn-ghost` | Text-based toggle |
| Home "Hide" link | `ml-auto text-sm hover:underline` | `btn-ghost` or keep as plain `<span>` | Low priority |

### 4.3 Notes on Data Attributes vs Class Composition

For color variants, the spec suggests `data-color="green"` as a clean approach. The CSS would be:

```css
.btn-primary[data-color="green"] { background: var(--green); }
.btn-primary[data-color="blue"] { background: var(--blue); }
.btn-primary[data-color="red"] { background: var(--red); }
```

If the team prefers class composition (e.g., `btn-primary btn-green`), that also works. Key requirement: **no inline `style` props for colors on buttons** after migration.

### 4.4 File Change Order (Recommended Sequence)

1. **`layout.tsx`** — Add CSS classes for `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-sm`, `btn-lg`, color modifiers
2. **`ArticleClient.tsx`** — Fix `<div>` → `<main className="flex-1">` on lines 190 and 228
3. **`article/new/page.tsx`** — Replace submit button + input with pixel equivalents
4. **`GenerationBar.tsx`** — Replace all 5 button/link instances with new classes
5. **`ErrorBoundary.tsx`** — Replace Try Again button
6. **`page.tsx`** (Home) — Replace all button instances
7. **`maps/page.tsx`** — Replace Clear search button
8. **`maps/[slug]/page.tsx`** — Replace Search Articles, Browse all maps buttons; optionally fix 2D/3D toggle
9. **`SharedHeader.tsx`** — Replace Search, Generate, Clear buttons
10. **`ProcessViewer.tsx`** — Replace auto-scroll toggle
11. Create **`components/PageHero.tsx`**, **`components/SectionHeader.tsx`**, **`components/PageTitleBar.tsx`**
12. Migrate pages to use the new components (Home, Maps, Article, Queue, New Article)

### 4.5 Testing the Changes

- Viewport height test: Force `generating && !article` state on ArticleClient and confirm footer is at viewport bottom
- Button interaction test: Hover, active, and disabled states on every button variant
- Mobile touch target test: All buttons should be tappable at >=44px height on narrow viewports
- Regression: Check that no button lost its border/shadow/hover animation
- SectionHeader: Confirm all section titles render identically (emoji + title + accent bar)
- PageHero: Confirm Home and Maps pages look identical before and after (gradient, wave, text)
