# Agent-First Encyclopedia — Implementation Plan

## Vision

Transform Truthseekers from a web encyclopedia into an **agent-first** knowledge platform. The chat agent is the primary interface. Articles surface as rich, immersive "discoveries" within the conversation stream, with switchable reading modes.

---

## Phase 1 ✓ — Chat as the Shell

**Goal:** App opens to chat. Header is minimal. Articles are secondary.

### Changes
| File | What |
|------|------|
| `page.tsx` | Replaced 219-line homepage with 3-line redirect to `/chat/new` |
| `AppShell.tsx` | Removed `useHeaderSearch`, `max-w-[1400px]` wrapper, stripped `SharedHeader` props |
| `chat/[id]/page.tsx` | Removed sidebar (chat list, nav, user profile, theme toggle, queue, console toggle). 435→290 lines |
| `SharedHeader.tsx` | Stripped categories rail and search bar. 95→30 lines. Just wordmark + nav links |
| `ArticleClient.tsx` | Back link changed from `/articles` → `/chat/new` |

### State
- [x] Homepage redirects to `/chat/new`
- [x] Header is minimal (no categories, no search)
- [x] Chat page is full-width, no sidebar
- [x] Article pages link back to chat

---

## Phase 2 ✓ — Rich Article Blocks in Chat

**Goal:** When the agent produces an article, it appears as an immersive discovery card with expand/collapse, not bare inline blocks.

### Changes
| File | What |
|------|------|
| `ArticleBlock.tsx` | **New.** Extracts title (first heading), image (first image), abstract (first text) from blocks. Renders as card with thumbnail, title, abstract, gold rule, action buttons. Expand/collapse to see all blocks. |
| `ChatMessage.tsx` | Blocks >4 render as `ArticleBlock` instead of raw `BlockRenderer`. Small responses (≤4 blocks) stay inline. |

### State
- [x] Article-length responses render as discovery cards in chat
- [x] "Read in chat" expand/collapse toggle
- [x] "Explore" and "Newspaper" button stubs
- [x] Short responses (maps, timelines, etc.) still render inline

---

## Phase 3 ✓ — Explore View (Journal Mode)

**Goal:** Clicking "Explore" opens a full-screen journal reading experience with the existing aged-paper aesthetic.

### Changes
| File | What |
|------|------|
| `ArticleViewContext.tsx` | **New.** Shared context for current article + view mode. `open(title, blocks)`, `close()`, `setMode(mode)`. |
| `ExploreView.tsx` | **New.** Full-viewport overlay. Shows article in journal layout: title in Playfair, gold rule, `BlockRenderer` with drop-cap, `Fleuron` divider. "Back to Chat" button, Escape key closes. Fade-in animation. |
| `ArticleBlock.tsx` | "Explore" button now calls `open()` from context, which renders ExploreView. |
| `AppShell.tsx` | Mounts `<ExploreView />` (renders when context has an article). |
| `layout.tsx` | Wraps children in `<ArticleViewProvider>`. |
| `globals.css` | Added `@keyframes fade-in` + `.animate-fade-in`. |

### State
- [x] "Explore" button opens article in full-screen journal overlay
- [x] Journal layout with editorial typography
- [x] "Back to Chat" closes overlay
- [x] Escape key closes
- [x] Fade-in entry animation
- [x] `ArticleViewContext` ready for Phase 4+5 wiring

---

## Phase 4 ✓ — Press View (Newspaper Flip)

**Goal:** Clicking "Newspaper" opens a page-flip reading experience with newspaper column layout.

### Changes
| File | What |
|------|------|
| `PressView.tsx` | Full-screen newspaper overlay using `react-pageflip` (StPageFlip library) for realistic page-curl physics with shadows. Splits blocks into pages by heading sections. 2-column newspaper layout. Arrow key + click navigation. |
| `ArticleViewContext.tsx` | `open()` accepts optional `initialMode` param. "Newspaper" button passes `"press"`. |
| `ArticleBlock.tsx` | "Newspaper" button calls `open(title, blocks, "press")`. |
| `AppShell.tsx` | Mounts `<PressView />`. |
| `ExploreView.tsx` | Now checks `mode !== "explore"` to avoid conflicting with PressView. |
| `globals.css` | Added newspaper column CSS (`.newspaper-columns`, `.press-headline`). Removed manual 3D flip CSS (replaced by library). |

### State
- [x] "Newspaper" button opens article in full-screen page-flip overlay
- [x] Articles split into pages by heading sections
- [x] 2-column newspaper column layout
- [x] Realistic page-curl physics via react-pageflip (shadows, drag, corner curl)
- [x] Left/right arrows + keyboard navigation
- [x] Page counter (1 / N)
- [x] Dark-toned chrome framing cream-colored pages

---

## Phase 5 ✓ — View Switcher

**Goal:** Toggle between Stream / Explore / Press while reading an article.

### Changes
| File | What |
|------|------|
| `ViewSwitcher.tsx` | **New.** Pill/tab toggle with three modes: Stream, Explore, Press. Highlights active mode. Calls `setMode` from context. |
| `ExploreView.tsx` | Replaced "Explore · {title}" label with `<ViewSwitcher />` in top bar. |
| `PressView.tsx` | Replaced "Press · {title}" label with `<ViewSwitcher />` in top bar. |
| `AppShell.tsx` | Renders floating `<ViewSwitcher />` when `mode === "stream"` (overlay closed, article still in view). |

### State
- [x] Switch between Stream / Explore / Press while reading
- [x] Pill toggle in ExploreView and PressView top bars
- [x] Floating pill when in stream mode (no overlay)
- [x] `setMode` moves between views without reloading article

---

## Phase 6 ✓ — Chat Sidebar

**Goal:** Show conversation history sidebar on the chat page for switching between chats.

### Changes
| File | What |
|------|------|
| `ChatSidebar.tsx` | **New.** Left sidebar listing all conversations via `useChats()` hook. Active chat highlighted. "New Chat" button. Click to navigate. |
| `chat/[id]/page.tsx` | Added `<ChatSidebar />` to left of chat area. Layout changed from single column to row: `sidebar \| chat-content`. |

### State
- [x] Sidebar showing conversation history
- [x] Active conversation highlighted
- [x] "New Chat" button at top
- [x] Click to switch conversations

---

## Backlog

- [ ] Admin CMS: `fetchFeaturedArticles` needs to resolve slugs against `listArticles` instead of `fetchArticle` (avoids fetching full article bodies for list display)
- [ ] ChatMessage feedback (thumbs up/down) persists to server
- [ ] Dynamic follow-up suggestions from agent
