## Progress
### Done
- Created reusable ContentCard component from the chat card layout pattern (centered max-w-4xl, rounded-2xl, border-2 bg-surface, header/children/footer slots, configurable maxWidth, scrollable body)
- Applied ContentCard to maps page — replaced PageLayout + PageHero, inline section headings instead of SectionHeader, editorial card styling for map grid items (border + hover accent, subtle tags)
- Applied ContentCard to article detail page — all 5 render paths (error/loading/empty/generating/article) now use ContentCard, removed PageLayout wrappers, adjusted article reading layout (px-8, max-w-[42rem] inside card)
- Applied ContentCard to settings page — replaced PageLayout, kept max-w-2xl constrained sections inside card
- Removed unused imports from maps page (IconMap, IconGlobe, SectionHeader, PageHero, PageLayout, useEffect)
- All buttons now have `cursor-pointer` per ui-ux-pro-max rules
- FRONTEND_REVAMP.md — 12-page detailed plan
- Installed taste-skill from GitHub (`design-taste-frontend` in `.agents/skills/`)
- Revamped chat card shadow with .chat-shell premium shadow, gold-tinted agent console overlay shadow
- Removed auto-close console timer (user controls it)
- Added stagger entrance animation to HistorySheet items
- Trimmed demo mock events from 12 to 8 (kept search + verdict + image)
- Applied ui-ux-pro-max search (FAQ + Minimal pattern, Exaggerated Minimalism style)
- Applied Pre-Delivery Checklist fixes: focus rings on select, aria-labels on textarea/select/console-toggle, cursor-pointer on 6 buttons, active:scale-90 on send/stop
- Revamped sidebar — nav links section (Home, Chat, Articles, Maps, Settings) with SVG icons and gold active state, width reduced from w-72 to w-60, date grouping (Today/Yesterday/This week/Month), relative dates ("2h ago"), editorial search bar, skeleton shimmer loading, dashed "New conversation" footer
- Revamped ChatMessage — user messages right-aligned in gold-tinted bubble, assistant messages with gold left rule + serif body + "Truthseeker" label, refined action bar with smaller icons (12px)
- Restored loading spinner when data fetching (user preference over skeleton)
- Refined model selector bar (smaller text, tighter spacing)
- Refined input area with gold focus glow (`shadow-[0_0_0_3px_var(--gold-bg)]`), smaller send/stop buttons
- Removed card shadow completely — card uses `border border-border/40` flush with surface
- Unified outer container to `bg-surface` (same as card background)
- Revamped /onboarding, /login, /settings — editorial gold accents, watermarks, theme preview cards, danger zone
- Auth fixes — AuthProvider reactive to token changes (polls cookie 500ms), login page auth loading guard
- Mock data system, mock API guards, mock AuthProvider, floating mock badge in AppShell
- Go /health endpoint
- Icons.tsx — added IconTrash

### In Progress
- (none)

## Key Decisions
- ContentCard uses flex-1 + min-h-0 overflow-y-auto body — scrollable content inside the card without breaking the outer layout
- All pages that previously used `<PageLayout>` + custom centering now use `<ContentCard>` — unified editorial card container across the app
- Maps page uses inline `<h2>` section headings instead of `<SectionHeader>` component — fewer imports, simpler DOM
- Article page removed the `-mt-12 sm:-mt-16` negative margin on toolbar (no longer needed without PageHero background)
- `cursor-pointer` added to every button/clickable element — ui-ux-pro-max rule
- AuthProvider uses token polling (setInterval 500ms) instead of event-based — simpler, imperceptible delay, works across navigations
- Mock token marker ("truthseekers_mock") rather than env-var auto-login — lets user see login page design then proceed manually
- Taste-skill loaded after install — DESIGN_VARIANCE 8, MOTION_INTENSITY 6, VISUAL_DENSITY 4
- Card shadow removed entirely in favor of flush border — requested after taste-skill shadow was applied, then reduced, then removed
- Loading state uses spinner with "LOADING" label (reverted from skeleton per user preference)
- Console auto-close timer removed — console stays open until user dismisses it
- Agent computer panel z-50 for floating overlay — single overlay, legitimate use case
- Sidebar links use pathname prefix matching (`pathname.startsWith(link.href)`) for active state

## Next Steps
- Continue with remaining pages that still use PageLayout: Pricing, Queue, Articles browse, individual article listing pages
- Check the articles listing page (`/articles`) — may need ContentCard treatment
- Verify all error/loading/empty states across maps, article, and settings pages

## Relevant Files
- `packages/web/src/app/components/ContentCard.tsx`: NEW — reusable card component with header/children/footer slots
- `packages/web/src/app/chat/[id]/page.tsx`: using ContentCard with header + footer slots
- `packages/web/src/app/maps/page.tsx`: using ContentCard, removed PageLayout/PageHero/SectionHeader
- `packages/web/src/app/article/[slug]/ArticleClient.tsx`: all 5 states using ContentCard
- `packages/web/src/app/settings/page.tsx`: using ContentCard
