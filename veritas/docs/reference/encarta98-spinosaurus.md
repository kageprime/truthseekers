# Encarta 98 — Spinosaurus Reference (canonical)

Source: user-supplied React artifact (Spinosaurus aegyptiacus full article).
Saved: 2026-09-13. This spec is the pixel contract; the HTML artifact is the visual truth.

## Chrome
- Page `bg #c3bda8`, window `max-w-[1440px] bg #efe9d5 border 3px outset #fff8e0/#8a7f68 shadow 4px 4px 0 rgba(0,0,0,.35), inset 1px 1px white`.
- Titlebar `h-[22px] linear-gradient(90deg,#0a2a5e,#1a4a9e)`, badge `16x14 bg #c9a227 border black 10px`, controls `_ □ X 16x14 bg #d4d0c8 outset`.
- Menubar `h-[20px] bg #d4d0c8 border-b #808080 11px Verdana` (F/E/V/G/H underlined), right `© 1993-1998`.
- Toolbar `bg #d4d0c8 border-b-[2px] #808080`, buttons `outset 2px` / inactive `inset`, address `bg white inset 2px min-w-[260px]/[340px] 📍 encarta.msn.com/...`.
- Statusbar `h-[18px] bg #d4d0c8 border-t-[2px] #808080 10px`, Ready `inset 1px bg #efe9d5`.

## Layout
- 3-col flex: left `w-[270px] bg #e8e0c5 border-r-[2px] #8a7f68`, center `bg white inset 3px #8a7f68/#fff8e0` inner `max-w-[720px] p-4/sm:p-6`, right `w-[340px] bg #e8e0c5 border-l-[2px]`.
- Fonts: UI Verdana, body Georgia 14.5px/1.65 #1a1a1a, H1 Georgia 30/sm:38 0.95 bold #0a2a5e, H2 Verdana 15px bold bg #0a2a5e white px-2 py-1.

## Claim explorer (520x460, viewBox 0 0 520 460)
- Container `h-[460px] bg #fdf8e8 inset 3px #a09060/#fff9e5 + inset 1px 1px 3px rgba(0,0,0,.2)`.
- Physics per frame: repel `<140 *0.03`, spring supports=120 / contradicts=150 `*0.02`, central gravity `0.02`, other `0.002`, damping `*0.88`, clamp `x 50-470 y 45-415`. Pause on drag (rAF still ticks).
- Nodes: central `r38 fill #0a2a5e stroke 3`, leaf `r30 fill white stroke 2.5`, status dot `r6`; colors verified #2e7d32 supported #5a9a3a disputed #b7791f contradicted #a33/#a33a3a; label Verdana 9.5/8.5 bold, sub `7.5px conf% • status`.
- Edges: supports `2px #5a9a3a`, contradicts `1.5px #a33 dashed 6 4`, mid badge `r8 #e6f4ea/#fde8e8` with `+ / –` 10px bold.
- Overlays: `DRAG NODES • CLICK FOR EVIDENCE` navy top-left, legend Verified/Disputed/Contradicted top-right, filters Show All / Supporting Only / Highlight Weakest Link (outset vs inset navy active), detail panel inset white with Strength/Conf chips `#efe9d5` + Citation sidebar.
- Scrollbar `16px bg #d4d0c8 thumb outset`, selection `bg #c9a227/30`. Tooltip `bg #ffffe1 border black shadow 2px 2px 0 rgba(0,0,0,.3)`.
- TOC scrollspy: IntersectionObserver `rootMargin -20% 0px -60% 0px threshold 0.1`, smooth scrollIntoView.
