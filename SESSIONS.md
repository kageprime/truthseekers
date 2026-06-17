# Session Log

## 2026-06-17 — Architectural Debt Sprint

### Done
- **P1** — Frontend `lib/api.ts` type duplication: moved types to core, removed local redefs, extracted `BASE` to `lib/constants.ts`
- **P3** — Core type exports: all 14 BlockData types already exported (verified)
- **P6** — Removed `useApiQuery`/`useApiMutation` wrappers: inlined into `useApi.ts`, deleted wrapper files
- **P4** — In-memory fallbacks: removed `try { db } catch { mem }` from all chat endpoints, deleted dead memory code from `shared.ts`
- **P2** — Route modules: already split (verified pre-existing)
- **P5** — Auth middleware: already exists (verified pre-existing)

### Sidebar redesign
- Glass backdrop (`backdrop-blur-xl` + translucent surface)
- Active indicator line instead of background fill
- Removed collapse button, removed chevron on hover
- Slimmer padding, `w-64` instead of `w-72`
- Softer borders via `color-mix`

### Chat page removed
- `/chat` was redundant with home (`/`) — deleted
- All references updated: nav links → `/`, login redirects → `/`, "Back to Chat" → "New Chat"

### TruthConsole upgrade
- Scrollbar: 4px wide, transparent track, subtle thumb via `tc-scroll` class
- Cards: all backgrounds use `color-mix` with transparency (60% / 50% / 40% opacities)
- Profile button: `IconUser` link to `/settings` in header
- Softer borders with `color-mix` at 50% opacity
- Smaller header text ("Console" instead of "Truth Console"), tighter spacing

### Sidebar: collapsed state + bigger logo
- Added `defaultCollapsed` prop to Sidebar (wired through PageLayout as `sidebarDefaultCollapsed`)
- Home page starts with collapsed sidebar (icon-only, w-16)
- Toggle chevron moved to bottom-right of sidebar footer
- Logo increased from `w-7` to `w-9` (36px)
- Nav items show icon-only when collapsed, full when expanded
- Conversations/hamburger hidden when collapsed

### Auth guard + marketing landing page
- Home page now checks `useAuth()` before rendering
- Loading state shows centered spinner
- Unauthenticated visitors see marketing landing (brand hero, 3 feature cards, CTA to /login)
- Authenticated users see the full chat interface with sidebar
- `useAuth` re-exported from hooks/index.ts

### Sidebar redesign (Brainwave-inspired)
- Nav grouped into collapsible "Explore" section (Chat, Articles, Maps, Queue)
- Conversations grouped into collapsible "History" section + New Chat button
- Tree-style nesting with left border guide rail and connecting branch lines
- Chevron rotate animation on section collapse via `CollapsiblePanel` component
- Smooth height transition using ref-based scrollHeight measurement
- Active nav item gets tinted background (`color-mix(accent 12%)`) + accent text color
