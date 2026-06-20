# Truthseekers Roadmap — Sprints

An AI-powered interactive encyclopedia. The chat is the universal interface; categories are the browse layer; responsive layout adapts to any device.

---

## Current State

- **Article pipeline**: Research → Outline → Write → Verify → Correct → Media → Store. SSE streams process. Articles have maps, timelines, 3D models, images as `Block[]`.
- **Chat agent**: 13 tools, tool-calling loop with planning phase. Streaming via SSE. Agent events captured and displayed in Truth Console. Persisted per message in MongoDB.
- **Web app**: Next.js 15 with App Router. Pages: chat (with sidebar history), article viewer, article grid, maps, login, settings, queue, pricing.
- **Data**: MongoDB (Mongoose) for serving, git for version history. Redis optional (Upstash in prod).
- **Chat context** (`ChatContext`): lives in `chat/layout.tsx`, holds `agentEvents`, `consoleOpen`, `sending`. Resets on navigation.
- **Responsive**: Basic `max-md:` breakpoints. No container queries. No adaptive layout that responds to chat open/close.

---

## Vision

```
┌──────────────────────────────────────────────────┐
│  SHARED HEADER (categories nav, logo, search)     │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────┬──────────────────┐  │
│  │                          │                  │  │
│  │  PAGE CONTENT            │  FLOATING CHAT   │  │
│  │  (auto-shrinks via       │  PANEL           │  │
│  │   CSS Grid)              │  (docked 400px   │  │
│  │                          │   on desktop,    │  │
│  │                          │   overlay on     │  │
│  │                          │   mobile)        │  │
│  └──────────────────────────┴──────────────────┘  │
├──────────────────────────────────────────────────┤
│  FOOTER                                           │
└──────────────────────────────────────────────────┘
```

Core principles:

1. **Chat as universal shell** — open it from any page. On desktop it docks alongside content (CSS Grid split). On mobile it's a bottom-sheet overlay. Each page adapts naturally without iframes or modals.
2. **AI-tagged categories** — 13 browse categories. Articles auto-tagged during generation. Category pages auto-populated from DB.
3. **Special content types** — ProCon (two-column debate), Quiz (interactive), Dictionary (search-first), On This Day (date-based), One Good Fact (daily random), Videos (embedded block + library).
4. **Agent intelligence** — new tools let the agent browse, quiz, define, and discover encyclopedia content from within any conversation.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout split mechanism | CSS Grid on root `<main>` + class toggle (no JS layout calc) | Pages don't need to change; CSS does all the work. Container queries on main content for inner reflow. |
| Floating chat state | `FloatingChatContext` at root layout, separate from `ChatContext` in chat routes | Open/close is global; message/event state is per-session. Different lifetimes. |
| Chat conversation ID | Lazy-created on first message, stored in `localStorage` | No wasted API calls. User can browse without creating conversations. |
| Overlay vs split detection | Route-level export (`chatMode: "split" | "overlay"`) | Maps and fullscreen pages can opt out of the grid split. |
| Category taxonomy | Fixed 13 slugs, stored as `String[]` on articles | Simple querying, no hierarchy complexity. Subcategories freeform. |
| Cross-session memory | `mem_store`/`mem_recall` tools + `Memory` MongoDB collection | Already exists. Enhance with automatic injection of relevant memories into system prompt. |
| Container queries | `container-type: inline-size` on `.app-content` | Content reflows based on its actual width (not viewport), so it adapts to both split and full modes. |
| Quiz generation | On-demand via agent tool: `create_quiz(topic, count)` → returns QuizBlock | No storage needed; generated fresh each time. Option to persist popular quizzes later. |

---

## Definition of Done (Across All Sprints)

- [ ] TypeScript compiles (`npx tsc --noEmit` passes in web and server)
- [ ] Next.js production build succeeds (`npx next build`)
- [ ] No new warnings in build output
- [ ] New pages render without 404/500 errors
- [ ] Floating chat works on desktop (docked split), tablet (overlay), mobile (bottom-sheet)
- [ ] SSE streaming works for all agent interactions
- [ ] Error states render (loading, empty, error, offline)
- [ ] Keyboard accessible (focus management, tab order, aria labels)
- [ ] Pre-existing e2e tests still pass

---

## Sprint 1: Floating Chat Shell & Responsive Layout

**Goal:** The chat is available from every page. Opening it gracefully splits the layout on desktop, overlays on mobile. The foundation for all subsequent features.

**Duration:** 1 sprint (~2 weeks)

### Epics

#### 1.1 Lift Chat State to Root

| Item | Detail |
|------|--------|
| **Why** | `ChatContext` currently lives in `chat/layout.tsx`. For the floating chat to work from any page, it needs to be at the root layout. |
| **What** | Move `ChatProvider` from `chat/layout.tsx` → `app/layout.tsx`. Keep `ChatContext` interface the same. |
| **Merge** | The existing `ChatProvider` in `chat/layout.tsx` is removed. The chat page's `useChatContext()` calls now resolve to the root provider. |
| **Files** | `packages/web/src/app/layout.tsx`, `packages/web/src/app/chat/layout.tsx`, `packages/web/src/app/chat/ChatContext.tsx` |
| **Risk** | The chat page might read stale context values if the lifecycle doesn't match. Mitigation: the context resets on `pathname` change (already implemented in `ChatContext.tsx`). |

#### 1.2 FloatingChatContext

| Item | Detail |
|------|--------|
| **File** | `packages/web/src/app/FloatingChatContext.tsx` |
| **State** | `isOpen: boolean`, `panelMode: "docked" | "overlay"` (determined by active route), `activeConversationId: string | null`, `panelWidth: number` (user-resizable) |
| **Persistence** | `isOpen` stored in `localStorage` (remember across sessions). `activeConversationId` stored in `localStorage`. |
| **Toggle** | `toggleChat()` — opens/closes. Keyboard shortcut `Cmd+/` or `Cmd+K`. |
| **Reset** | When user navigates to a new route, `panelMode` recalculates based on route metadata. |
| **Provider** | Rendered in `app/layout.tsx` wrapping the entire app. |

#### 1.3 CSS Grid Split Layout

| Item | Detail |
|------|--------|
| **What** | Replace the single-column `{children}` in `layout.tsx` with a CSS Grid container that has two columns: `main` and `chat`. |
| **Layout structure** | `app/layout.tsx` outputs: `<div class="app-shell"><SharedHeader /><div class="app-body"><main class="app-content">{children}</main><aside class="app-chat"><FloatingChatWidget /></aside></div><Footer /></div>` |
| **CSS Grid** | `.app-body { display: grid; grid-template-columns: 1fr 0px; }` → when chat opens: `grid-template-columns: 1fr 400px;` |
| **Transition** | `transition: grid-template-columns 0.35s cubic-bezier(0.23, 1, 0.32, 1)` |
| **Mobile** | `@media (max-width: 1023px) { .app-body { grid-template-columns: 1fr; } .app-chat { position: fixed; inset: 0; top: auto; max-height: 85vh; z-index: 50; } }` |
| **Container queries** | `.app-content { container-type: inline-size; container-name: page; }` — pages reflow based on container width, not viewport. |
| **Route detection** | New convention: pages export `chatMode = "split" | "overlay"` to opt out of the grid split (maps, fullscreen). Default is `"split"`. |
| **Files** | `app/layout.tsx`, `app/FloatingChatContext.tsx`, `app/components/FloatingChatWidget.tsx`, `app/globals.css` (or inline `<style>` in layout) |

#### 1.4 FloatingChatWidget Component

| Item | Detail |
|------|--------|
| **File** | `packages/web/src/app/components/FloatingChatWidget.tsx` |
| **Layout** | A vertical flex container with: header (title bar + close/expand buttons), scrollable body (tabs: Chat | Console), footer (ChatInput). |
| **Chat Tab** | Renders `MessageList` (read-only, scrollable) + `ChatInput` at the bottom. Same streaming hooks as the full chat page. |
| **Console Tab** | Renders `TruthConsole` inline (not as a separate side panel). Shows live agent events. |
| **Header** | "Truthseekers" title, event count badge, `[ _ ]` minimize, `[ X ]` close, `[ ↗ ]` open full chat → navigates to `/chat/[id]`. |
| **Conversation lifecycle** | On first user message: `POST /chat` → get id → stream via `POST /chat/:id/messages`. Store id in `localStorage`. Reuse for subsequent messages. |
| **State** | Reads from `FloatingChatContext` (open/close) and `ChatContext` (events, sending). Manages its own `input`, `streamContent`, `streamBlocks`. |
| **Loading** | Shows a spinner while conversation is being created or streaming. |
| **Empty state** | "Ask me anything about the encyclopedia" with suggested prompts. |
| **Reuses** | `ChatInput` component (with simplified props), `MarkdownRenderer` for messages, `BlockRenderer` for blocks. |

#### 1.5 "Open Full Chat" Flow

| Item | Detail |
|------|--------|
| **What** | A link/button inside the floating widget header: "Open in full chat" |
| **Flow** | Click → `router.push(/chat/${activeConversationId})`. The full chat page loads the existing conversation. If no conversation exists, create one first. |
| **Data** | The floating chat passes `agentEventsRef.current` as query param or via context so the full chat page can restore the Truth Console state. |
| **Files** | `FloatingChatWidget.tsx`, `chat/[id]/page.tsx` (read conversation ID from URL param) |

#### 1.6 SharedHeader Integration

| Item | Detail |
|------|--------|
| **What** | Move `SharedHeader` from individual pages into the root layout. All pages share the same header. |
| **Header content** | Logo, search bar, categories dropdown, "Generate" button, user menu, floating chat toggle button. |
| **Categories dropdown** | A mega-menu or flyout showing the 13 categories. Each links to `/categories/[slug]` (built in Sprint 2). For now, static links. |
| **Chat toggle** | A button in the header (right side) that opens/closes the floating chat. Desktop icon: chat bubble. Mobile icon: same. |
| **Files** | `app/components/SharedHeader.tsx`, `app/layout.tsx`, individual pages that currently render their own header. |
| **Risk** | Some pages might have header variations (login, onboarding). Those can opt-out with a `hideHeader` flag. |

#### 1.7 SharedFooter Integration

| Item | Detail |
|------|--------|
| **What** | Move `Footer` into root layout. Simple legal/copyright bar. |
| **Files** | `app/layout.tsx`, `app/components/Footer.tsx` (if it exists) |

### Acceptance Criteria (Sprint 1)

- [ ] Floating chat toggle button is visible on every page (except login/onboarding)
- [ ] Clicking toggle opens the chat widget
- [ ] **Desktop**: chat panel docks to the right of the page content. Page content shrinks naturally. No overlap.
- [ ] **Mobile**: chat panel slides up as a bottom-sheet (max 85vh, rounded top corners). Page content is visible behind a semi-transparent backdrop.
- [ ] User can type a message in the floating chat widget
- [ ] Message is sent via SSE, response streams into the widget
- [ ] Truth Console is accessible as a tab inside the widget
- [ ] User can minimize (collapse to a small button) and re-open the widget
- [ ] "Open Full Chat" navigates to `/chat/[id]` with the same conversation
- [ ] Chat state survives page navigation (open ChatGPT on the articles page, navigate to an article, chat is still open with same conversation)
- [ ] Chat state survives session (close browser, reopen, chat toggle state is remembered)
- [ ] Keyboard shortcut `Cmd+/` or `Cmd+K` toggles the chat
- [ ] Maps and fullscreen pages correctly use overlay mode (not grid split)
- [ ] `npx tsc --noEmit` passes in web package
- [ ] `npx next build` succeeds

---

## Sprint 2: Category Taxonomy & Browse

**Goal:** Articles are tagged with categories. Browse pages exist for each category. The navigation shows categories. The chat can answer "show me History articles."

**Duration:** 1 sprint

### Epics

#### 2.1 Article Schema — categories Field

| Item | Detail |
|------|--------|
| **Schema change** | Add `categories: [{ type: String, enum: [13 slugs] }]` to `packages/storage/src/db.ts` Article schema. Also add `subcategories: [{ type: String }]` for freeform AI sub-tagging. |
| **Backfill** | Script (`packages/cli/src/scripts/backfill-categories.ts`) that iterates all articles and asks the LLM to assign categories based on title + content preview. |
| **Type update** | Update `Article` type in `packages/core/src/types.ts` to include `categories: string[]` and `subcategories: string[]`. |
| **Validation** | Zod schema on API routes validates category values. |
| **Files** | `packages/storage/src/db.ts`, `packages/core/src/types.ts`, `packages/server/src/routes/article-routes.ts`, `packages/cli/src/scripts/backfill-categories.ts` |

#### 2.2 Pipeline Category Tagging

| Item | Detail |
|------|--------|
| **Phase** | Add category assignment to the Write phase (or a sub-step after content generation). The LLM outputs `categories: ["history-society", "biographies"]` as part of the article metadata. |
| **Prompt update** | Update `WRITER_INSTRUCTIONS` in `packages/core/src/prompts/writer.ts` to include: "Return the most relevant categories from the allowed list." |
| **Storage** | Pipeline's `storePhase` saves categories to the `Article` doc. |
| **Files** | `packages/core/src/prompts/writer.ts`, `packages/core/src/pipeline/orchestrator.ts`, `packages/core/src/pipeline/phases.ts` |

#### 2.3 Category Browse Pages

| Item | Detail |
|------|--------|
| **Route** | `/categories` — lander showing all 13 categories as cards with icon + description + article count. |
| **Detail route** | `/categories/[slug]` — paginated article grid filtered by category. Reuses existing `ArticleCard` / `CardGridSkeleton` components. |
| **API** | `GET /articles?category=history-society` — existing `article-routes.ts` search endpoint with new filter param. |
| **SEO** | Each category page has a unique `title` and `description` in metadata. |
| **Header nav** | The `SharedHeader` categories dropdown links to `/categories/[slug]`. |
| **New components** | `CategoryCard`, `CategoryGrid`, `CategorySidebar` (filter by subcategory). |
| **Files** | `packages/web/src/app/categories/page.tsx`, `packages/web/src/app/categories/[slug]/page.tsx`, `packages/server/src/routes/article-routes.ts`, `packages/web/src/app/components/CategoryCard.tsx`, `packages/web/src/app/components/CategoryGrid.tsx` |

#### 2.4 Category Icons & Design

| Item | Detail |
|------|--------|
| **What** | Each category gets a unique icon (SVG or emoji/icon component). Used in the category lander card, header dropdown, and article metadata badge. |
| **Icons** | History → scroll/columns, Science → atom/flask, Tech → chip, Biographies → person, Animals → paw, Nature → leaf, Geography → globe, Travel → plane, Arts → palette, Culture → mask, ProCon → scale, Money → coin, Games → dice, Quizzes → question, Videos → play, On This Day → calendar, One Good Fact → star, Dictionary → book |
| **Component** | `CategoryIcon slug={string} size={number}` |

### Acceptance Criteria (Sprint 2)

- [ ] All existing articles have `categories` populated (via backfill)
- [ ] New article pipeline assigns categories automatically
- [ ] `/categories` page shows all 13 categories with icons and article counts
- [ ] `/categories/history-society` shows a paginated grid of articles in that category
- [ ] Category pages have proper SEO metadata
- [ ] Header dropdown shows categories, links work
- [ ] `GET /api/articles?category=slug` returns filtered results
- [ ] Chat agent can call `get_articles_by_category(slug)` and return results
- [ ] Build passes

---

## Sprint 3: Special Content — ProCon & Dictionary

**Goal:** Two new content types are fully functional.

**Duration:** 1 sprint

### 3.1 ProCon Article Type

| Item | Detail |
|------|--------|
| **What** | A new article format where content is structured as pro/con arguments by section. |
| **Data model** | Add `ProConBlock` to block types: `{ type: "procon", data: { topic: string, arguments: [{ side: "pro" | "con", title: string, body: string, citations: Citation[] }] } }` |
| **Pipeline** | Agent generates a ProCon article using a dedicated prompt. The `create_article` tool accepts `type: "procon"`. |
| **Renderer** | New component `ProConRenderer` that renders a two-column layout (pro left, con right) with alternating rows on mobile. Each argument has citations. |
| **Page template** | `/article/[slug]` already handles rendering via `BlockRenderer`. Add `ProConRenderer` to the block type registry. |
| **Agent tool** | No new tool needed — `create_article` with `type: "procon"` param. |
| **Files** | `packages/core/src/types.ts` (add `ProConBlock`), `packages/core/src/pipeline/orchestrator.ts` (new phase variant), `packages/web/src/app/components/ProConRenderer.tsx`, `packages/web/src/app/components/BlockRenderer.tsx` (new case) |

### 3.2 Dictionary Page

| Item | Detail |
|------|--------|
| **What** | A standalone `/dictionary` page. Search field at top. Type a word → fetch definition → display. |
| **Data source** | Two-tier: (1) Check if an article with that title exists in our DB → return the first paragraph. (2) Fall back to a free dictionary API (Free Dictionary API, no key needed). (3) Final fallback: LLM generates a definition on the fly. |
| **UI** | Search bar (focused on load). Definition card below with word, phonetic, part of speech, definition(s), example sentence. Links to full article if exists. |
| **API** | `GET /dictionary?word=photosynthesis` — server-side lookup. Or client-side direct fetch + local article lookup. |
| **Agent tool** | `define_word(word: string)` → returns definition + linked article if exists. Used in chat. |
| **Files** | `packages/web/src/app/dictionary/page.tsx`, `packages/server/src/routes/dictionary-routes.ts`, `packages/core/src/tools.ts` (new tool definition) |

### Acceptance Criteria (Sprint 3)

- [ ] User can request "Write a ProCon about remote work" → pipeline generates a ProCon article
- [ ] ProCon article renders correctly: two-column pro/con layout on desktop, stacked on mobile
- [ ] Each argument has a visible citation
- [ ] `/dictionary` page loads with a focused search input
- [ ] Typing a word fetches and displays definition within 2 seconds
- [ ] If an article exists for the word, a link to it appears
- [ ] Chat agent can define words via `define_word` tool
- [ ] Build passes

---

## Sprint 4: Special Content — On This Day, One Good Fact, Quiz

**Goal:** Time-based and interactive content features go live.

**Duration:** 1 sprint

### 4.1 On This Day

| Item | Detail |
|------|--------|
| **Data** | Store historical events with date + year + article link. Initial seed: use Wikipedia's "On This Day" API once to get ~5000 events. Or generate via AI batch jobs. |
| **Storage** | New collection `HistoricalEvent`: `{ date: "2024-06-18", events: [{ year: 1815, title: "Battle of Waterloo", description: "...", articleSlug: "battle-of-waterloo" }] }`. Index on `date`. |
| **Page** | `/on-this-day` — shows today's events by default. A date picker lets user browse any day. Each event is a card with year, title, description, link to full article. |
| **Generation** | A CLI script or API endpoint that pre-generates events for a given date range. Uses the agent to research and format. |
| **Agent tool** | `get_on_this_day(date?: string)` → returns events for today or the given date. Chat can answer "What happened on this day in 1492?" |
| **Files** | `packages/storage/src/db.ts` (new model), `packages/server/src/routes/on-this-day.ts`, `packages/web/src/app/on-this-day/page.tsx`, `packages/core/src/tools.ts` (new tool), `packages/cli/src/scripts/seed-events.ts` |

### 4.2 One Good Fact

| Item | Detail |
|------|--------|
| **What** | A random, surprising, or interesting fact. Shown on the homepage and available via `/one-good-fact`. |
| **Data** | Two sources: (1) Articles tagged `one-good-fact` — short AI-generated micro-articles (2-3 paragraphs). (2) A dedicated `Fact` collection with `{ content, source, category }` — seeded from a public trivia dataset or AI-generated. |
| **Homepage** | A card/section on `/` titled "One Good Fact" with a random fact. Refresh button to get a new one. |
| **Agent tool** | `get_random_fact(category?: string)` → returns a random fact. Chat can share facts on demand. |
| **Daily concept** | A "fact of the day" that changes every 24h (uses the date as a seed for deterministic random selection — so all users see the same fact on the same day). |
| **Files** | `packages/storage/src/db.ts`, `packages/web/src/app/page.tsx` (homepage), `packages/web/src/app/fact/page.tsx`, `packages/core/src/tools.ts` |

### 4.3 Games & Quizzes

| Item | Detail |
|------|--------|
| **What** | Interactive quiz generation on demand. User picks a topic, agent generates questions. |
| **Block type** | `QuizBlock`: `{ type: "quiz", data: { topic: string, questions: [{ question: string, options: string[], correctIndex: number, explanation: string }] } }` |
| **Component** | `QuizBlockRenderer` — renders one question at a time. User selects answer → immediate feedback (correct/incorrect + explanation). Score counter at top. Results screen at end with score + review. |
| **Quiz page** | `/quiz` — input field for topic. Generate button. Quiz renders inline. Results after completion. "Try another topic" button. |
| **Agent tool** | `create_quiz(topic: string, count?: number)` → generates quiz questions via LLM. Returns as a `quiz` block. Used both in chat and on the standalone page. |
| **Storage** | Optional: completed quizzes can be saved to a `QuizResult` collection for user history. But NOT for MVP. |
| **Files** | `packages/core/src/types.ts` (QuizBlock), `packages/web/src/app/components/QuizBlockRenderer.tsx`, `packages/web/src/app/quiz/page.tsx`, `packages/core/src/tools.ts` |

### Acceptance Criteria (Sprint 4)

- [ ] `/on-this-day` shows events for today's date
- [ ] Date picker lets user browse any date in history
- [ ] Each event links to the related article (if exists)
- [ ] Homepage shows "One Good Fact" card
- [ ] Clicking refresh changes the displayed fact
- [ ] `/quiz` page lets user enter a topic
- [ ] Quiz generates 5 questions, shows one at a time
- [ ] Correct/incorrect feedback is immediate
- [ ] Results screen shows score
- [ ] Chat agent can generate and render quizzes inline
- [ ] Build passes

---

## Sprint 5: Agent Tooling & Cross-Session Memory

**Goal:** The chat agent is fully aware of the encyclopedia's content. It can browse, recommend, and remember user preferences across sessions.

**Duration:** 1 sprint

### 5.1 New Agent Tools

| Tool | Signature | Backend | Purpose |
|------|-----------|---------|---------|
| `get_articles_by_category` | `(slug: string, limit?: number)` → `ArticleSummary[]` | Query articles by category | "Show me History articles" |
| `get_todays_events` | `(date?: string)` → `HistoricalEvent[]` | Query HistoricalEvent collection | "What happened on this day?" |
| `get_random_fact` | `(category?: string)` → `{ content, source }` | Random fact from DB | "Tell me a good fact" |
| `create_quiz` | `(topic: string, count?: number)` → QuizBlock | LLM generates questions | "Quiz me on Ancient Rome" |
| `define_word` | `(word: string)` → `{ definition, article? }` | Dictionary API + article check | "What is photosynthesis?" |

**Files:** `packages/core/src/tools.ts` (definitions), `packages/server/src/index.ts` (executors)

### 5.2 Cross-Session Memory

| Item | Detail |
|------|--------|
| **Current state** | `mem_store`/`mem_recall` tools exist in the agent. User can say "remember that I like medieval history" and it's stored in the `Memory` MongoDB collection. But no automatic recall. |
| **Enhancement** | On each chat start, inject relevant memories into the system prompt. Relevance determined by embedding similarity or keyword overlap with the user's message. |
| **Memory injection** | In `chatService.ts`, before calling `Agent.run()`, call `memRecallAll(userId)` to fetch all memories. Filter top 5 by relevance (simple: keyword overlap with the user's message). Append to system prompt as: "User preferences: ...". |
| **Memory UI** | A `/memories` page or section in settings where users can view and delete stored memories. |
| **Files** | `packages/server/src/services/chatService.ts`, `packages/web/src/app/settings/page.tsx`, `packages/server/src/routes/memory-routes.ts` |

### 5.3 Enhanced System Prompts

| Item | Detail |
|------|--------|
| **What** | Update `VERITAS_PREAMBLE` to include information about the encyclopedia's categories, content types, and the chat's ability to browse/generate articles. |
| **Key additions** | Agent should know: it can browse categories, generate ProCon articles, create quizzes, define words, show maps. It should actively suggest encyclopedia content when relevant. |
| **Files** | `packages/core/src/prompts/veritas.ts` |

### Acceptance Criteria (Sprint 5)

- [ ] Chat agent can call `get_articles_by_category("history-society")` and return article cards inline
- [ ] Chat agent can generate and render a quiz for any topic inline
- [ ] Chat agent can look up word definitions inline
- [ ] Chat agent can share historical events or random facts
- [ ] User memories are injected into the conversation automatically
- [ ] User can view/manage memories in settings
- [ ] Agent proactively suggests encyclopedia content when relevant (e.g., "Would you like me to show you a map of that region?")
- [ ] Build passes

---

## Sprint 6: Polish, Performance & Accessibility

**Goal:** The experience is polished, fast, and accessible on all devices.

**Duration:** 1 sprint

### 6.1 Container Queries Audit

| Item | Detail |
|------|--------|
| **What** | Ensure all page-level components use `container-type: inline-size` and respond to their container (not viewport) width. |
| **Pages** | Article page (`article/[slug]`), article grid (`/articles`), category pages, maps, quiz page. |
| **Components** | `BlockRenderer`, `ProConRenderer`, `ArticleCard`, `QuizBlockRenderer`, map containers. |
| **Goal** | When chat opens and page content shrinks from 1200px to 760px, the components reflow naturally (no horizontal scroll, no broken layouts). |

### 6.2 Animation & Transitions

| Item | Detail |
|------|--------|
| **Chat open/close** | Grid split transition (already done in Sprint 1). Add `scale` and `opacity` animation on the chat panel entrance. |
| **Mobile bottom-sheet** | Swipe gesture to dismiss. Drag handle at top of the sheet. `touch-action: pan-y` on the sheet. |
| **Category pages** | Stagger animation on article cards (fade in). |
| **ProCon** | Arguments animate in alternately (left then right). |

### 6.3 Performance

| Item | Detail |
|------|--------|
| **SSR** | Ensure new pages are server-rendered where possible (`export const dynamic = "force-static"` for category pages with revalidation). |
| **Code splitting** | The floating chat widget dynamically imports `ChatInput`, `MessageList`, `TruthConsole` (not loaded until first open). |
| **Image optimization** | Article images use Next.js `Image` component with proper `sizes` attribute for responsive loading. |
| **Bundle analysis** | Run `npx next build` bundle analyzer. Identify large dependencies that are included client-side but shouldn't be. |
| **Quizzes** | Quiz component dynamically imports the LLM call (not loaded on page render, only on "generate" click). |

### 6.4 Accessibility

| Item | Detail |
|------|--------|
| **Keyboard navigation** | Floating chat toggle is focusable and activatable via keyboard (button, not div). Tab order: header → page content → chat toggle → within chat → footer. |
| **Focus management** | When chat opens, focus moves to the input. When chat closes, focus returns to the toggle button. |
| **ARIA** | Chat panel gets `role="dialog"`, `aria-label="Chat"`, `aria-hidden` when closed. Bottom-sheet gets `role="region"`. |
| **Screen reader** | All icons have `aria-label` or `aria-hidden="true"`. Streaming content uses `aria-live="polite"` (already done in `StreamingPreview`). |
| **Color contrast** | Category cards, fact cards, and quiz feedback meet WCAG AA contrast ratios. |

### 6.5 Error & Empty States

| Item | Detail |
|------|--------|
| **Category pages** | Empty state when no articles in category: "No articles yet. Would you like me to generate one?" with a generate button. |
| **Dictionary** | Word not found message with suggestion to ask the chat agent. |
| **Quiz** | Generation failure: "Couldn't create a quiz. Try a different topic." |
| **On This Day** | No events found for this date (edge case for future dates). |
| **One Good Fact** | Generation failure fallback: show a static "fun fact" as backup. |
| **Floating chat** | Offline/reconnection indicator when SSE stream drops. |

### Acceptance Criteria (Sprint 6)

- [ ] All pages reflow correctly when chat opens/closes at any viewport width
- [ ] Mobile bottom-sheet has a drag handle and swipe-to-dismiss gesture
- [ ] Floating chat toggle and panel are fully keyboard accessible
- [ ] `npx next build` succeeds with no warnings
- [ ] Bundle analysis shows no unexpected large client-side modules
- [ ] All error states render correct messages with recover actions
- [ ] All empty states render with calls to action

---

## Future Stretch (Not Yet Scheduled)

- **Videos library page** (`/videos`) — articles with video blocks
- **Interactive timeline component** for history articles (drag-scroll timeline)
- **User profiles** — reading history, saved articles, quiz scores
- **Social features** — share article, quiz challenge with friends
- **Article comments/discussion** per article
- **Mobile app** — PWA with offline reading
- **Multiple AI personas** — user can switch between different agent personalities
- **Article version diff viewer** — compare current vs historical git versions
- **Voice input** for chat (Web Speech API)
- **Template-based article generation** — user fills a form, agent generates structured content

---

## Dependency Graph

```
Sprint 1 (Floating Chat Shell)
    │
    ├── Sprint 2 (Categories) — depends on header nav from Sprint 1
    │
    ├── Sprint 3 (ProCon, Dictionary) — independent of Sprint 2
    │       │
    │       └── Sprint 5 (Agent tooling) — needs tools from Sprint 3
    │
    ├── Sprint 4 (On This Day, Fact, Quiz) — independent of Sprint 2/3
    │       │
    │       └── Sprint 5 (Agent tooling) — needs tools from Sprint 4
    │
    └── Sprint 6 (Polish) — depends on all previous sprints
```

Sprints 2, 3, and 4 can be worked in parallel with separate branches/developers after Sprint 1 merges.

---

## Commit Conventions

```
scope: imperatively describe the change

scopes: floating-chat, categories, procon, dictionary, on-this-day,
        one-good-fact, quiz, agent-tools, memory, polish, a11y, perf

Examples:
  floating-chat: lift ChatContext to root layout
  categories: add category filtering to article API
  quiz: implement QuizBlockRenderer component
```

---

## How to Start Sprint 1

1. Create branch: `git checkout -b sprint/floating-chat`
2. Implement in order:
   - `FloatingChatContext.tsx` (new file, root-level state)
   - Lift `ChatProvider` from `chat/layout.tsx` → `app/layout.tsx`
   - CSS grid layout in `app/layout.tsx`
   - `FloatingChatWidget.tsx` component (basic shell with MessageList + ChatInput)
   - Wire streaming (reuse `useChatStream` hook)
   - Route detection (export `chatMode` from pages)
   - SharedHeader and Footer into root layout
   - "Open Full Chat" navigation
   - Mobile bottom-sheet styles
   - Keyboard shortcut
3. Verify: `npx tsc --noEmit && npx next build`
4. PR → review → merge
