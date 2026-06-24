# Loading States, Error Handling & Navigation Audit

## 1. `loading` conflates `isLoading` / `isFetching`

**File:** `packages/web/src/app/hooks/useApi.ts:12`

The single `loading` boolean merges "no data yet" and "refreshing existing data". Every page shows a full spinner on tab-refocus because `refetchOnWindowFocus` triggers `isFetching` but the code can't distinguish it from `isLoading`.

**Fix:** Split into `isLoading: result.isLoading` and `isRefetching: result.isFetching`. Pages show skeleton on first load, subtle indicator on refetch.

---

## 2. No `loading.tsx` route shells

The app has zero `loading.tsx` files. Navigating between pages blanks the content area entirely — no skeleton, no shell, no transition.

**Fix:** Add `loading.tsx` at key route segments (`/articles`, `/chat/[id]`, `/maps`, `/article/[slug]`) with layout-matching skeletons.

---

## 3. No error boundaries at route/section level

One global `ErrorBoundary` in `layout.tsx`. Any render error anywhere brings down the entire app with the same fallback. No per-route or per-section boundaries.

**Fix:** Add `error.tsx` at route segments. Wrap independent UI regions (sidebar, chat panel, article body) in their own error boundaries.

---

## 4. No optimistic mutations

All mutations (create chat, delete conversation, generate article) wait for server confirmation before updating UI. Conversations linger in the sidebar during deletion. New chat creation shows a spinner before navigation.

**Fix:** Add TanStack Query `onMutate` rollback to `useCreateChat`, chat deletion, and `useGenerateArticle`/`useRefreshArticle`.

---

## 5. Silent error swallowing

**Files:**
- `FloatingChatWidget.tsx:209` — `onError: () => {}`
- `queue/page.tsx` — 5 empty `catch {}` blocks
- `AuthProvider.tsx:99` — `catch { return null; }`

Errors in streaming, queue operations, and auth are silently dropped. No user feedback, no logging, no retry.

**Fix:** Surface errors to user or at minimum console.warn. Remove empty catch blocks.

---

## 6. Dual conversation-creation paths

`chat/[id]/page.tsx` and `FloatingChatWidget.tsx` both manage their own `convId`, `sending`, and `loading` state independently while sharing `ChatContext.agentEvents`. Creates race conditions and state inconsistency.

**Fix:** Consolidate conversation lifecycle into `ChatContext` or the `useChatStream` hook. Single source of truth for active conversation state.

---

## 7. No prefetching on navigation targets

`<Link>` components use default Next.js viewport prefetch but no data-level prefetching. Clicking a chat/ article/ map link shows a spinner while data loads.

**Fix:** Use `queryClient.prefetchQuery()` in `onMouseEnter` handlers on sidebar links and navigation cards.

---

## 8. No page transition animations

The app switches between routes with no transition. Content area blanks then appears. No View Transitions API usage.

**Fix:** Add CSS `@view-transition { navigation: auto; }` for cross-document transitions. Add Framer Motion `pageVariants` for route exit/enter animations.

---

## 9. Inline CSS spinner in 15+ places

The `border-2 animate-spin borderTopColor: var(--accent)` pattern is repeated across 15 components. No shared spinner component.

**Fix:** Create a shared `Spinner` component. One source of truth for loading indicator styling.

---

## 10. No Skeleton component for predictable layouts

Card grids, article layouts, and sidebar lists all use spinners or inline skeleton divs. No reusable `Skeleton` component with variants.

**Fix:** Create a shared `Skeleton` component with `text`/`card`/`circle`/`rect` variants. Use in predictable-layout pages instead of spinners.

---

## Priority Order

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | Split `loading` → `isLoading` / `isRefetching` | Small | High |
| 2 | Add `loading.tsx` route shells | Medium | High |
| 3 | Add `error.tsx` at route segments | Medium | High |
| 9 | Shared `Spinner` component | Small | Medium |
| 10 | Shared `Skeleton` component | Small | Medium |
| 4 | Optimistic mutations | Medium | Medium |
| 7 | Data prefetching on hover | Medium | Medium |
| 8 | Page transition animations | Medium | Low |
| 5 | Fix silent error swallowing | Small | Medium |
| 6 | Consolidate conversation state | Large | Medium |
