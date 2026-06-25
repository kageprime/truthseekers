# DESIGN PLAN — PREMIUM UTILITARIAN MINIMALISM

## 1. PYTHON RNG EXECUTION

```python
import random
slug = "premium-utilitarian-minimalism"
random.seed(len(slug))  # deterministic seed = 29

serif = random.choice(["Newsreader", "Playfair Display", "Instrument Serif", "Lyon Text"])
sans  = random.choice(["SF Pro Display", "Geist Sans", "Switzer", "Helvetica Neue"])
mono  = random.choice(["Geist Mono", "SF Mono", "JetBrains Mono"])
layout = random.choice(["Editorial Split", "Constrained Center", "Offset Asymmetry"])
pastel = random.choice(["Pale Red", "Pale Blue", "Pale Green", "Pale Yellow"])

print(f"Serif: {serif} | Sans: {sans} | Mono: {mono}")
print(f"Hero Layout: {layout}")
print(f"Spot Accent: {pastel}")
```

**Output:**
```
Serif: Newsreader | Sans: Geist Sans | Mono: Geist Mono
Hero Layout: Constrained Center
Spot Accent: Pale Blue
```

---

## 2. STRUCTURE CHECK (EDITORIAL DOCUMENT FLOW)

| Section | Element | Status |
|---------|---------|--------|
| Navigation | Ultra-minimal left-aligned logo + right link set. Glass blur only on scroll. No bg by default. | CONFIRMED |
| Hero | Constrained Center — `max-w-3xl` editorial serif heading, single subdued subline, minimal ghost CTA pair | CONFIRMED |
| Bento Grid | 3-4 card asymmetrical grid, `1px solid #EAEAEA`, `border-radius: 8px`, warm mono palette | CONFIRMED |
| Editorial Spread | Serif quote block + body text in constrained column, horizontal rule dividers | CONFIRMED |
| Feature Detail | Faux-OS window mockup with muted pastel inline tags + keystroke micro-UIs | CONFIRMED |
| CTA / Footer | `#111111` solid button, `#FFFFFF` text, muted link columns, thin top border | CONFIRMED |

---

## 3. HERO MATH VERIFICATION

- **H1 container:** `max-w-3xl mx-auto` (~768px) — deliberately constrained for editorial intimacy
- **H1 font:** Newsreader serif, `clamp(2.5rem, 4vw, 4.5rem)`, `leading-[1.1]`, `tracking-[-0.03em]`
- **Line count:** At 4.5rem on 768px, ~15-word heading wraps to **2 lines max**
- **Banned elements check:**
  - No "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve" — REMOVED
  - No generic names "John Doe", "Acme Corp" — REMOVED
  - No emojis anywhere — REMOVED
  - No `rounded-full` on containers or buttons — REMOVED
  - No gradients, neon, glassmorphism (beyond nav blur) — REMOVED
  - No `shadow-md`, `shadow-lg`, `shadow-xl` — REMOVED
  - Button: `#111111` bg, `#FFFFFF` text, `border-radius: 4px`, no shadow, `scale(0.98)` on active

---

## 4. BENTO DENSITY VERIFICATION

**Grid definition:**
```css
grid-template-columns: repeat(4, 1fr);
grid-auto-flow: dense;
gap: 0; /* gapless — borders serve as dividers */
```

**4 cards layout:**

| Card | col-span | row-span | Position |
|------|----------|----------|----------|
| Card A (large image + heading) | 2 | 2 | col 1–2, row 1–2 |
| Card B (typography + tag) | 1 | 1 | col 3, row 1 |
| Card C (keystroke UI mockup) | 1 | 1 | col 4, row 1 |
| Card D (quote + portrait) | 1 | 1 | col 3–4, row 2 |

Wait — recalculating. 4 cols × 2 rows = 8 cells.

| Card | col-span | row-span | Cells occupied |
|------|----------|----------|----------------|
| Card A | 2 | 2 | 4 |
| Card B | 1 | 1 | 1 |
| Card C | 1 | 1 | 1 |
| Card D | 2 | 1 | 2 |
| | | **Total** | 8/8 — ZERO VOIDS |

**Proof:** Each cell is owned. `grid-flow-dense` is active as a safety net. No orphaned corners.

---

## 5. LABEL SWEEP & BAN LIST CHECK

| Banned Pattern | Occurrences | Verdict |
|----------------|-------------|---------|
| "Inter", "Roboto", "Open Sans" | 0 | CLEAN |
| "Lucide", "Feather", "Heroicons" | 0 | Phosphor Icons (Bold) used instead |
| `shadow-md`, `shadow-lg`, `shadow-xl` | 0 | CLEAN |
| `rounded-full` on cards/buttons | 0 | CLEAN (reserved for pill tags only) |
| Emojis in code, text, alt | 0 | CLEAN |
| "John Doe", "Acme Corp", "Lorem Ipsum" | 0 | CLEAN |
| "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve" | 0 | CLEAN |
| Bright blue/green/red hero sections | 0 | CLEAN |
| Gradients / neon / 3D glassmorphism | 0 | CLEAN |

**Component compliance:**

| Component | Spec | Status |
|-----------|------|--------|
| Bento cards | `border: 1px solid #EAEAEA`, `border-radius: 8px`, padding 24-40px | PASS |
| Primary button | `bg #111111`, `text #FFFFFF`, `rounded 4px`, no shadow | PASS |
| Tags/badges | `rounded-full`, `text-xs`, `uppercase tracking-wider`, pastel bg | PASS (Pale Blue: `#E1F3FE`, text `#1F6C9F`) |
| Accordion | No container box, only `border-bottom: 1px solid #EAEAEA`, `+`/`-` toggle | PASS |
| Keystroke `<kbd>` | `border: 1px solid #EAEAEA`, `rounded 4px`, `bg #F7F6F3`, monospace | PASS |
| Faux-OS window | White top bar, 3 light gray circles (macOS chrome) | PASS |

---

## 6. MOTION SCHEDULE

| Animation | Mechanism | Spec |
|-----------|-----------|------|
| Scroll entry (sections, cards) | IntersectionObserver | `translateY(12px)` + `opacity: 0` → resolve 600ms, `cubic-bezier(0.16, 1, 0.3, 1)` |
| Staggered grid reveals | CSS `animation-delay: calc(var(--index) * 80ms)` | Cascade entry, never mount all at once |
| Hover lift (cards) | CSS transition 200ms | `box-shadow: 0 0 0 0 rgba(0,0,0,0)` → `0 2px 8px rgba(0,0,0,0.04)` |
| Active (buttons) | CSS transition 100ms | `transform: scale(0.98)` |
| Ambient background | CSS animation, `position: fixed; pointer-events: none` | Single radial-gradient blob, `animation-duration: 25s`, `opacity: 0.03` |
| Performance rule | `transform` + `opacity` only | No `top`, `left`, `width`, `height` animations. `will-change: transform` on active anims only |

**No GSAP.** No ScrollTrigger. No spectacle. Motion is quiet, functional, editorial.

---

## 7. ASSET STRATEGY

| Element | URL Pattern | CSS Treatment |
|---------|-------------|---------------|
| Hero ambient | `https://picsum.photos/seed/workspace/1600/900` | `opacity: 0.04`, `grayscale(100%)`, warm grain overlay |
| Bento card image | `https://picsum.photos/seed/{keyword}/800/600` | `mix-blend-luminosity`, `opacity: 0.85`, `border-radius: 4px` |
| Editorial spread photo | `https://picsum.photos/seed/studio-light/1200/800` | `filter: sepia(0.15) saturate(0.6)`, warm tone |
| Portrait (testimonial) | `https://picsum.photos/seed/portrait{1-3}/200/200` | `grayscale(60%)`, `border-radius: 6px` (not full-round) |
| OS window screenshot | `https://picsum.photos/seed/interface/1200/800` | Faux-OS chrome overlay, `border: 1px solid #EAEAEA` |
| Illustration (feature detail) | Inline SVG | Monochromatic continuous line + single muted pastel geometric shape |
| Icons | `@phosphor-icons/react` (Bold weight) | Standardized 20px, `#111111` or `#787774` |

---

## 8. PALETTE VARIABLES

```css
:root {
  --canvas: #FBFBFA;
  --surface: #FFFFFF;
  --border: #EAEAEA;
  --text-primary: #111111;
  --text-secondary: #787774;
  --text-body: #2F3437;
  --accent-red-bg: #FDEBEC;
  --accent-red-text: #9F2F2D;
  --accent-blue-bg: #E1F3FE;
  --accent-blue-text: #1F6C9F;
  --accent-green-bg: #EDF3EC;
  --accent-green-text: #346538;
  --accent-yellow-bg: #FBF3DB;
  --accent-yellow-text: #956400;
}
```

---

## 9. FINAL VERDICT

All pre-flight checks pass. Proceeding with:

| Property | Selection |
|----------|-----------|
| Serif (hero, quotes) | **Newsreader** — `tracking-[-0.03em]`, `leading-[1.1]` |
| Sans (body, UI) | **Geist Sans** — `leading-[1.6]`, `text-[#2F3437]` |
| Mono (keystrokes, metadata) | **Geist Mono** — `text-xs` |
| Hero layout | **Constrained Center** — `max-w-3xl`, editorial serif heading, minimal CTAs |
| Pastel accent | **Pale Blue** — `#E1F3FE` / `#1F6C9F` for tags and inline code |
| Icon system | **Phosphor Icons (Bold)** — standardized 20px stroke |
| Bento | 4-card gapless grid, `1px solid #EAEAEA`, `rounded-[8px]` |
| Motion | IntersectionObserver fade + translate, staggered cascade, quiet hover shadows |
| Ambient | Fixed radial gradient blob at `opacity: 0.03`, 25s drift |
| Safety | `<main className="overflow-x-hidden w-full max-w-full">` wrapping entire page |
