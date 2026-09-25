# Frontend Gap Audit — backend vs `2000s-retro-web-page/`

Date: 2026-09-25. Backend: Go orchestrator (`veritas/go-orchestrator`, :4097, Postgres via Heroku). Frontend: Next.js 15 (`2000s-retro-web-page/`, :3000).
Method: every `s.mux.Handle` route diffed against `lib/api.ts` exports and `app/` usage. `curl`-verified where noted.

## 1. Fully wired (backend → lib/api → UI) — do not regress

Health · articles list/search/fetch · featured (home hero) · claims search/contested/evidence GET+submit · gaps list + upvote · maps list · chat create + SSE messages · generate/refresh/contest + progress SSE · all auth flows (OTP/password/signup/onboard/logout/session) · CORS allowlist + credential-free public GETs.

## 2. In lib/api but unused in any page

| Function | Backend | Fix |
|---|---|---|
| `fetchAllGaps` | `GET /gaps` (claim text, upvotes) | Gaps page (P1) |
| `fetchArticleClaimGraph` | `GET /articles/:slug/claim-graph` (200, ~21KB, fast) | Per-article graph tab (P1) |
| `trackView` | `POST /track` → `GET .../views` | Call on article view (P0) |
| `fetchArticleEpistemic` | `GET .../epistemic` — HANGS, do not use | Delete once [slug] split lands (P0, in progress) |

Missing fn (no caller possible): `submitGapEvidence` for `POST /gaps/:id/submit`.

## 3. Backend exists, zero frontend coverage

### P0 — article completeness
- [ ] Section `media[]` images never rendered (not even typed). Backend ships them (e.g. timbuktu 2+1). `GET /images/{name}` serves files.
- [ ] `crossrefs` typed but never rendered — no related-articles section.
- [ ] `blocks` untyped/unrendered (backend sends none today; type defensively).
- [ ] `trackView` never called (see §2).
- [ ] `GET .../export` (markdown + JSON) — no download button.

### P1 — epistemic depth
- [ ] Gaps page: list (`fetchAllGaps`), upvote, submit (`submitGapEvidence` — write fn first).
- [ ] Per-article claim-graph tab (`fetchArticleClaimGraph` exists, fast).
- [ ] Stale dashboard (`GET /stale`), global graph (`GET /claim-graph`), contested dashboard (claims page only uses top-up).
- [ ] `GET .../refresh-diff` — no version-change UI.
- [ ] `GET .../graph` (crossref force-graph) — merge into claim-graph tab or skip.

### P2 — chat depth
- [ ] Conversation list/history/rename (`GET /chat`, `GET/PATCH /chat/:id`).
- [ ] Stop button (`POST /chat/:id/stop`).
- [ ] Model picker (`GET /v1/llm/models`), `pageContext` + `time_machine_era` params.

### P3 — account/billing
- [ ] `GET /quota` usage meter. Paystack init/verify tiers UI (needs product decision).
- [ ] Profile update — BLOCKED, needs backend `PUT /auth/me` (handler is read-only; §5.2).

### P4 — admin/ops (only if this frontend serves admins)
- [ ] `/admin/settings`, `/seed/*`, `/coordinator/*`, `/v1/credentials`, `/v1/llm/usage`, `/v1/executor/*`.

### Never (legacy/ops, no UI)
`/stripe/*` stubs · `POST .../resolve` HITL stub (unless behavior defined) · `POST /webhook/:slug` (ops) · `GET /live/now` + `.../live` presence (revisit if presence UI wanted).

## 4. Maps gaps
- [ ] `interactive` half of `GET /maps` dropped (`fetchMaps` reads only `data`).
- [ ] `GET /maps/search` — no `searchMaps` fn.
- [ ] `GET /maps/:slug` — no detail route/page.
- [ ] `GET /maps` returns `[]` — no seed data; atlas is static pins until seeded.

## 5. Backend gaps (frontend cannot use these yet)
1. **`/epistemic` and `/freshness` hang** (curl 000 @30s). UI works around with 8s-timeout split endpoints. Needs Go-side profiling (likely N+1 or missing index).
2. **`PUT /auth/me` unsupported** — `handleAuthMe` (server.go:1449) is read-only; profile edits silently no-op.
3. **`/featured` returns `[]`** — no curation UI; home falls back to latest.
4. **429/quota UX** — contest surfaces `busy`; generate/refresh don't. ETag/304 support exists, unused by frontend.

## 6. Fix order (agreed: top-down, one at a time)
P0 → P1 → P2 → P3 → (P4 iff admins in scope) → backend fixes on a parallel track.
Progress log below — append rows as items land.

| # | Item | Status |
|---|------|--------|
| P0.1 | Section media/images | done — hero + per-section figures w/ AI badges, verified in HTML |
| P0.2 | Crossrefs section | done — Related entries w/ relationship labels |
| P0.3 | trackView wiring | done — fires on ArticleShell mount |
| P0.4 | Export button | done — rail Export .md link, endpoint 200 |
| P0.5 | Delete dead fetchArticleEpistemic | done — removed from lib/api |
| P1.1 | Gaps page | done — `/gaps` list + filter + upvote + file-evidence + article links; `submitGapEvidence` fn added; `GapRow` shared w/ article shell; header nav gains Open gaps |
| P1.2 | Per-article claim-graph tab | done — lazy toggle + two-column SVG (claims × evidence), click-through to ?claim=, verified in HTML. NOTE: endpoint takes ~20s (backend perf); never in SSR path |
| P1.3 | Stale / contested / global-graph dashboards | todo |
