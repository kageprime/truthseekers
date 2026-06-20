# Architectural Debt — Fix List

## ~~P1. Frontend `lib/api.ts` type duplication~~ ✓ DONE

- Added `ArticleSummary`, `QuotaInfo`, `ConversationSummary`, `ConversationDetail` to `core/src/types.ts`
- Removed local type redefinitions from `api.ts`, `ArticleCard.tsx`, `articles/page.tsx`
- Moved `BASE` to `lib/constants.ts`, updated all 10 consumers
- `api.ts` now imports all types from `@encarta/core` — 0 local type definitions
- Fetch functions remain in `api.ts` (would need hook conversion to delete file)

---

## ~~P2. Server `index.ts` route modules~~ ✓ DONE (pre-existing)

Routes already split across 7 modules (`article-routes.ts`, `chat-routes.ts`, `map-routes.ts`, `health-routes.ts`, `admin-routes.ts`, `auth-routes.ts`, `stripe.ts`). `index.ts` is 130 lines of setup/mounting only.

---

## P2b. Route modules still contain inline business logic

- `article-routes.ts` (226 lines) — progress SSE, generation, image generation, job handling
- `chat-routes.ts` (189 lines) — chat loop, tool executors, SSE streaming, message conversion

**Fix:** Extract shared logic (tool executors, SSE helpers, message conversion) into `lib/` modules, slim route handlers to wiring only.

---

## ~~P3. Type duplication / missing exports from `@encarta/core`~~ ✓ DONE

All 14 BlockData types already exported from core. Both `packages/core` and `packages/web` compile clean with no type errors. No action needed.

---

## ~~P4. In-memory fallbacks in server~~ ✓ DONE

- Removed all `try { db } catch { mem }` branching from all 4 chat endpoints
- Removed `memConversations`, `memMessages`, `memAddMessage`, `tsMsgToAgentMsg` from `shared.ts`
- Chat routes now fail-fast on DB errors (caught by Hono's error middleware)

---

## ~~P5. No service layer — routes call storage directly~~ ✓ NOT A PROBLEM

Auth middleware already exists and applies to all routes (`auth.ts`). Routes call storage helpers directly (thin CRUD), which is fine. Adding a service layer would be YAGNI.

---

## ~~P6. `useApiQuery`/`useApiMutation` wrappers~~ ✓ DONE

- Inlined `useApiQuery`/`useApiMutation` into `useApi.ts` as private helpers — same return shapes, zero component changes
- Deleted `useApiQuery.ts` and `useApiMutation.ts`
- Removed re-exports from `hooks/index.ts`
- Kept `{ data, loading, error, refetch }` / `{ data, loading, error, mutate }` to avoid breaking 15+ consumers
