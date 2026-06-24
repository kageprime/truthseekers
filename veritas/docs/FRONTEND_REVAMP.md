# Frontend Revamp — Page-by-Page Plan

**Project:** Truthseekers (Veritas) — The Living Encyclopedia
**Design Identity:** Editorial Hybrid · Antique Gold & Ink
**Stack:** Next.js 14 App Router, Tailwind CSS, CSS custom properties, React 19

## Guiding Principles

1. **Editorial first** — every page should feel like a page from a printed encyclopedia, not a SaaS dashboard
2. **Consistent patterns** — shared loading/error/empty states, not per-page roll-your-own
3. **Progressive enrichment** — SSR shell for article content, client hydration for interactivity
4. **No emojis as icons** — the codebase has a full SVG icon set (`Icons.tsx`), use it
5. **Every state accounted for** — loading, empty, error, edge cases on every page

---

## 1. `/chat/[id]` — Chat (P0 — core product)

**Current:** 408 lines. Full agent chat with SSE streaming, tool events, truth console drawer, history sidebar, auto-resize textarea, theme toggle, regeneration.

**Problems:**
- Input bar is basic (textarea + send/stop button, no formatting hints)
- History sheet is a plain slide-out — no preview, no search, no delete
- No message actions (copy, retry individual message)
- Empty state is text-heavy, no visual hook
- No keyboard shortcut hints displayed
- TruthConsole drawer is hidden behind a small toggle — users may miss the agent transparency
- No conversation delete

**Revamp scope:**

### Header bar
- Left: hamburger (history) + conversation title (editable on click)
- Right: theme toggle, "New chat" button
- Show keyboard shortcut `Ctrl+/` as a subtle badge

### Message list
- Each message: avatar (initial letter or icon), timestamp on hover, content
- Assistant messages: copy button + feedback (thumbs up/down) on hover
- Last assistant message: regenerate button visible
- Error messages inline with retry
- Streaming: animated cursor pulse, completed steps as subtle gray bullets

### Input area
- Auto-resize textarea with placeholder "Ask about any topic... (Shift+Enter for new line)"
- Send button fills with accent when text is present
- Stop button (red) during generation
- Keyboard shortcut hint `Enter to send · Shift+Enter for new line`

### Agent Console (TruthConsole drawer)
- Make default open on first tool event, auto-close after 5s idle
- Better visual hierarchy: tool name, status icon, duration
- Color-code: search=blue, generate=gold, verify=green, error=red

### History Sheet
- Search bar at top
- Preview: show last message + timestamp
- Delete button on hover/ swipe on mobile
- "Today", "Yesterday", "Older" groupings

---

## 2. `/articles` — Browse (P1)

**Current:** 393 lines. Search with debounce, infinite scroll, list/grid toggle, category `<select>` filter, inline generate, SSE progress.

**Problems:**
- No featured/hero section — raw list from the top
- Category filter is a bare `<select>` — lowest-effort UI
- Grid view thumbnails are inconsistent sizes
- No sorting (recency, popularity, title)
- "Generate" button in search bar label is unclear
- No article count in category filter

**Revamp scope:**

### Hero / Featured section
- 1-3 featured articles as large cards at top (carousel or static row)
- "Trending" or "Recently updated" label

### Search + filter bar
- Search input with icon, clear button, keyboard shortcut `/`
- Category filter as pill buttons (horizontal scroll on mobile), not `<select>`
- Sort dropdown: "Newest", "Recently updated", "Title A–Z"
- View toggle (list/grid) stays

### Results
- List view: better typography hierarchy, thumbnail fixed aspect ratio
- Grid view: 3 columns desktop, 2 tablet, 1 mobile
- Skeleton cards during load (not spinner)
- Empty state: illustration + "Generate an article about it?" CTA

### Generation flow
- Inline GenerationBar with collapsible progress detail
- On complete: card slides into results with a subtle highlight animation

---

## 3. `/article/[slug]` — Article Detail (P1)

**Current:** 352 lines. SSR + client hydration, SSE generation, pre-exist state, export (JSON/MD), refresh, quota awareness.

**Problems:**
- "Back to The Encyclopedia" links to `/chat/new` — wrong destination
- Toolbar (refresh/export) is a thin icon row top-right, easily missed
- No table of contents for long articles
- No related articles section at bottom
- No reading progress bar
- Citations inline but not visually distinguished from body text
- No "share" / copy link

**Revamp scope:**

### Reading layout
- Left rail (desktop): sticky table of contents generated from section headings
- Center column: article body, max-width 42rem (as currently)
- Right rail (optional): related articles, metadata

### Article header
- Title with decorative gold rule (keep)
- Dateline (volume, revision, date) — keep
- Add: estimated reading time
- Add: category badges

### Toolbar
- Move to a sticky bar below the header or a floating button group
- Actions: Copy link, Export JSON, Export MD, Refresh
- Show quota remaining only when low

### Body
- Section headings as anchor targets (`#section-name`)
- Section-navigation links in TOC highlight on scroll
- Citations: superscript numbers linking to footnote cards on hover
- Block renderer is already strong — keep editorial components (DropCap, PullQuote, FigurePlate, Fleuron)

### Footer
- "See also" links (from article crossrefs)
- Related articles section (graph edges)
- Back to top button
- Share / copy link

### Generation states
- Pre-generation: "Topic not yet generated" — keep, but add example articles as inspiration
- Generating: GenerationBar + agent events — keep, add estimated time
- Error: show with retry + link to home

---

## 4. `/queue` — Queue Monitor (P2)

**Current:** 324 lines. Live polling + SSE, active/queued/error sections, stat cards, cancel/retry, config panel.

**Problems:**
- Busy page — 4 stat cards + 3 job sections + config = overwhelming
- Stat cards use icons as the only visual differentiator
- No estimated wait time for queued jobs
- No completed jobs archive
- Page layout is cramped at desktop

**Revamp scope:**

### Simplified layout
- Top row: 3 stat cards (Active, Queued, Errors) — remove "Done" since completed jobs are ephemeral
- Remove the config panel at the bottom (power-user feature, move to admin or tooltip)
- Wider max-width

### Job cards
- Active jobs: GenerationBar with progress, cancel button always visible (not hover-only)
- Queued jobs: position in queue, estimated wait, time queued, cancel
- Errors: show error message truncated + retry, dismiss

### Completed section
- Collapsible "Recently completed" accordion
- Link to article on completion

---

## 5. `/settings` — Account (P2)

**Current:** 241 lines. Profile form, subscription badge + usage bar, theme selector plain buttons, sign out.

**Problems:**
- Dense single-column — no sidebar nav for future expansion
- Theme selector is 3 buttons with no preview
- No API keys section
- No notification preferences
- No delete account

**Revamp scope:**

### Layout
- Two-column on desktop: left nav (Profile, Subscription, Preferences, API Keys, Danger Zone) + right content panel
- Single column on mobile with sections stacked

### Profile section
- Keep email (read-only), name, avatar URL
- Add avatar preview (round crop)
- Save indicator

### Subscription
- Keep current plan badge + usage bar
- Add: next billing date, invoice history link
- Add: cancel subscription flow

### Theme
- Replace buttons with visual cards showing light/dark/system previews

### Add sections
- API Keys: list + generate + revoke
- Danger Zone: delete account with confirmation modal

---

## 6. `/login` — Auth (P2)

**Current:** 149 lines. Email magic link + GitHub/Google OAuth.

**Problems:**
- Brutalist shadow buttons (`box-shadow: 3px 3px 0 var(--ink)`) clash with editorial theme
- "WELCOME" in all-caps with no value prop
- No password option (fine, but not explained)
- Cold landing — no screenshot, no tagline

**Revamp scope:**

### Layout
- Centered card on editorial paper background
- Logo at top (keep)
- Tagline: "The AI-powered encyclopedia. Research, write, verify — on any topic."

### OAuth buttons
- Use theme-consistent styling (not brutalist shadows)
- GitHub: dark button with white icon
- Google: light button with colored icon
- Proper hover states

### Email form
- Keep magic link flow
- "Send magic link" — button with accent styling
- Sent state: clean confirmation with icon
- Error state: inline message with clear guidance

### Footer
- Terms link
- "No account needed? Browse articles →" link to /articles

---

## 7. `/onboarding` — First Run (P2)

**Current:** 120 lines. 2-step wizard (name + goal), pixel step indicator, emoji icons.

**Problems:**
- **Emojis as icons** (👋🎯) — most urgent fix
- Pixel step indicator clashes with editorial design
- Only 3 hardcoded goals — feels incomplete
- No skip option
- No branding / logo

**Revamp scope:**

### Visual refresh
- Replace emojis with SVG icons from the Icons set
- Step indicator: thin gold line with numbered circles (editorial, not pixel)
- Background: standard paper surface, not special

### Step 1 — Name
- "Welcome to Truthseekers" heading
- "What should we call you?" subheading
- Name input with character limit (40)
- Illustration or stylized logo

### Step 2 — Goal
- "How will you use Truthseekers?"
- Goal cards (existing 3 + "Just exploring" as 4th)
- Cards with icon + label + description, theme-consistent selection state

### Footer
- Skip button ("I'll figure it out later")
- Back button on step 2

---

## 8. `/pricing` — Plans (P2)

**Current:** 158 lines. 3-column card layout, "most popular" badge, Stripe checkout.

**Problems:**
- No annual/monthly toggle
- Feature lists are plain text with checkmarks — no visual hierarchy
- No FAQ section
- `/register` link points to nonexistent route

**Revamp scope:**

### Layout
- Section heading "Simple, transparent pricing"
- Annual/monthly toggle (annual gets "2 months free" badge)
- 3 columns: Free | Pro | Enterprise

### Cards
- Current plan shows a green checkmark badge
- Pro card has "Most popular" gold badge (keep)
- Feature list: grouped by category (Generations, Features, Support)
- CTA button prominent

### FAQ
- Collapsible accordion below the grid
- Questions: "Can I upgrade later?", "What happens when I hit my limit?", "Can I cancel anytime?"

---

## 9. `/maps` — Maps List (P3)

**Current:** 164 pages. Static + interactive map listing, PageHero with green gradient.

**Problems:**
- Green gradient hero clashes with gold/ink identity
- No preview zoom on static map thumbnails
- Skeleton is hand-rolled, not shared

**Revamp scope:**

### Hero (if kept)
- Use editorial gold accent gradient, not green
- Or remove hero entirely — go straight to grid

### Grid
- Static maps: larger thumbnails with caption overlay
- Interactive maps: Leaflet preview (keep) with play button overlay
- Tags: region, era, 3D badge — keep
- Shared skeleton component

### Search
- Filter by region, era, type (static/interactive/3d)

---

## 10. `/maps/[slug]` — Map Detail (P3)

**Current:** 196 lines. 2D/3D viewer, description, timeline, related articles CTA.

**Problems:**
- 2D/3D toggle is raw buttons — no visual connection to viewport
- No zoom-to-region on static maps
- Loading skeleton is hand-rolled
- "Related Articles" section hardcodes a search link

**Revamp scope:**

### Viewer section
- 2D/3D toggle styled as segmented control inside the viewer card
- Full-width (not max-w-6xl constrained)
- Static maps: allow click-to-zoom overlay

### Content sections
- Keep details card (title, tags, date)
- Keep description with MarkdownRenderer
- Keep timeline (InteractiveTimeline)
- Replace hardcoded search link with actual related articles from graph

### Skeleton
- Use shared skeleton component

---

## 11. `/admin` — Admin Panel (P3)

**Current:** 112 lines. Single feature: featured articles management.

**Problems:**
- Only one feature in the panel
- No auth guard error state (redirects, but shows flash of content)
- Search dropdown is unstyled
- No pagination on search results

**Revamp scope:**

### Layout
- Sidebar nav for future admin sections: Dashboard, Featured, Users, Settings
- Currently only Featured is implemented — other items can be disabled

### Featured Articles
- Keep search + add flow
- Improve search dropdown: proper card styling, loading state, empty state
- Add drag-to-reorder for featured list
- Add confirmation on remove

### Placeholder sections
- "Coming soon" states for Users, Settings, Analytics

---

## 12. `/article/new` — New Article (P3)

**Current:** 103 lines. Single input for topic slug, quota check, tips box.

**Problems:**
- Asks user for a "slug" — technical jargon
- Tips box uses `<code>` blocks
- No natural language input

**Revamp scope:**

### Input
- Change label from "Topic Slug" to "Article Topic"
- Accept natural language: "quantum computing" → auto-slugified to `quantum-computing`
- Show the slug preview below input: `Will be: /article/quantum-computing`

### Tips
- Replace tips box with editorial-styled hints
- "Specific topics produce better results" section with examples

### Quota
- Move quota display next to the generate button (subtle)
- At limit: show upgrade CTA directly (not separate page state)

---

## Shared Components to Extract

Build these once, use everywhere:

| Component | Used By | Priority |
|-----------|---------|----------|
| `Skeleton` (card, text, page) | All pages | P0 |
| `EmptyState` (icon + title + description + CTA) | Articles, Maps, Chat, Queue | P0 |
| `ErrorState` (message + retry + back) | All pages | P0 |
| `LoadingState` (page-level spinner or skeleton) | All pages | P0 |
| `ConfirmDialog` (modal with confirm/cancel) | Admin, Settings, Queue | P1 |
| `PageHeader` (title + description + actions) | Articles, Maps, Admin, Settings, Queue | P1 |
| `StatCard` (icon + value + label) | Queue, Settings (quota) | P2 |
| `TOC` (table of contents with scroll spy) | Article detail | P2 |

---

## Implementation Order

1. **P0:** Chat — highest usage, sets the tone
2. **P0:** Shared components (Skeleton, EmptyState, ErrorState, LoadingState)
3. **P1:** Articles browse — second most visited page
4. **P1:** Article detail — core reading experience
5. **P2:** Onboarding — quick win, visible to all new users
6. **P2:** Login — auth is the first touchpoint
7. **P2:** Settings — account management
8. **P2:** Pricing — conversion impact
9. **P2:** Queue — power user tool
10. **P3:** Maps list + detail
11. **P3:** Admin panel
12. **P3:** New article page
