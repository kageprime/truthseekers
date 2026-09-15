# Backend Reliability Audit — Done vs. To Do

Date: 2026-09-14. Scope: `veritas/go-orchestrator` (Go API, agent loop, DAG,
storage) + `docker-compose.yml`. Method: 5 parallel specialist audits, then
fix phases. Verified with `go vet ./...` clean and `go test ./... -count=1`
all green after every phase.

## Done — Phase 0 (hotfixes)

| # | Fix | Files |
|---|-----|-------|
| 1 | `GetTopArticles` selected nonexistent `threed_scenes` (15 cols vs 14 scan dests) — `/articles/top` errored on Postgres. Column dropped from query. | `internal/storage/db.go` |
| 2 | `FindOrCreateUserByEmail` omitted `username, activated` — OTP users locked out on PG (`activated` defaults FALSE) while mock set `true`. `GetUser` had the same gap. Both fixed. | `internal/storage/db.go` |
| 3 | `SearchMaps` interpolated raw input into `ILIKE` — now uses `escapeLIKE + ESCAPE '\'` like `SearchArticles`. | `internal/storage/db.go` |
| 4 | `SaveArticle` did upsert outside the graph-edge tx (partial failure = article without edges). Single tx now. | `internal/storage/db.go` |
| 5 | `DeleteEpistemicDataForArticle` was 6 bare `Exec`s with swallowed errors. Single tx with real errors. | `internal/storage/epistemic.go` |
| 6 | No pool limits (unbounded conns). `SetMaxOpenConns(25)/MaxIdle(5)/Lifetime(5m)`. | `internal/storage/db.go` |
| 7 | Missing indexes on every hot FK. New migration with 7 indexes. | `migrations/013_perf_indexes.sql` |
| 8 | `DELETE /queue/:slug` had no ownership check — any user could cancel anyone's run. Owner-or-admin enforced (trigger-owned sessions with empty `UserID` stay cancellable). | `internal/api/handlers.go` |
| 9 | Gap upvote/submit allowed `anonymous` (ballot-stuffing/spam). Auth required; submit validates `http(s)` URL. | `internal/api/handlers.go` |
| 10 | `/track` trusted raw `X-Forwarded-For`. Now uses `clientIP()` (TRUST_PROXY-gated). | `internal/api/handlers.go` |
| 11 | `transformGeneratedArticle` published LLM failure as a `published` stub (`Derived 0.0`). Now returns `ok=false` → `failArticle`; stub deleted. | `internal/api/generate.go` |
| 12 | Compose backend revalidate hit itself (`NEXT_PUBLIC_API_URL` reused as server-side base). `REVALIDATE_URL=http://frontend:3000` split; code prefers it with fallback. Compose also gains `JWT_SECRET`/key placeholders + healthchecks. | `docker-compose.yml`, `internal/api/generate.go` |

## Done — Phase 1.1 (durable sessions)

| # | Fix | Files |
|---|-----|-------|
| 1 | Sessions were memory-only; restart wiped queue. New `sessions` table; engine writes through on every transition; boot restores non-terminal rows as queued. Dead-letter = `failed` at max retries (queryable, no second table). | `migrations/014_sessions.sql`, `internal/storage/session_store.go`, `internal/session-lifecycle/store.go`, `engine.go`, `internal/api/server.go` |
| 2 | Session retry never fired (processor closure always returned `nil`). `processArticle` returns `error`; closure propagates it. | `internal/api/generate.go`, `internal/api/server.go` |
| 3 | **Found by new test:** sessions could never complete — `Running→Completed` is not a valid transition, so the final transition silently failed and slots leaked. Two-step `Running→Completing→Completed`. | `internal/session-lifecycle/engine.go` |
| 4 | Slot accounting leaked: cancels of queued sessions decremented `active` below zero; two-step completion double-decremented. Decrement only when leaving `provisioning/running`. | `internal/session-lifecycle/engine.go` |
| 5 | Unbounded queue slice. `maxQueue=100` → `ErrQueueFull` → 429. `/queue` capped at 200 rows, exposes `retryCount`+`updatedAt`, returns real `maxQueue`. | `internal/session-lifecycle/engine.go`, `internal/api/handlers.go` |
| 6 | `Stop()` only closed the ticker; 15-min runs died at 15s shutdown. `Stop()` waits via `WaitGroup`; shutdown ctx 15s→60s. | `internal/session-lifecycle/engine.go`, `cmd/server/main.go` |
| 7 | New test `TestProcessorErrorRetries` proves fail→retry→complete. | `internal/session-lifecycle/engine_test.go` |

## Done — Phase 1.2 (DAG resilience)

| # | Fix | Files |
|---|-----|-------|
| 1 | DAG `Retry`/`Timeout` existed in the engine but `buildArticleWorkflow` set neither — one LLM flake killed a 15-min job. Shared `nodeRetry{3, 1s, 8s}` + per-node timeouts (90s–5m, heaviest for `generate_article`). | `internal/api/generate.go` |
| 2 | Linear backoff with no jitter (9 nodes retrying in lockstep thunder the provider). ±20% jitter. Covered by existing `TestWorkflow_Execute_Retry`. | `internal/dag/engine.go` |
| 3 | Pipeline used `context.Background` — SIGTERM orphaned LLM spend. `Server.runCtx` parents all pipelines; `Shutdown` cancels first. | `internal/api/server.go`, `internal/api/generate.go` |

## Done — Phase 1.3 (CI + generation test)

| # | Fix | Files |
|---|-----|-------|
| 1 | `Server.workflowBuilder` seam (defaults to `buildArticleWorkflow`, nil-safe fallback in `processArticle`) so tests run the real 9-node shape with instant fake nodes — no LLM keys, no network. | `internal/api/server.go`, `internal/api/generate.go` |
| 2 | `generate_test.go`: happy path completes end to end (~10ms); malformed writer output fails loudly (stub-publish regression); PG persistence test gated on `TEST_DATABASE_URL` (skips locally, runs in CI). | `internal/api/generate_test.go` |
| 3 | `ci.yml`: `go vet` + `go test -count=1` on push/PR with Postgres 15 service. | `.github/workflows/ci.yml` |

## Done — Phase 1.4 (SSE resume)

| # | Fix | Files |
|---|-----|-------|
| 1 | All four fan-out maps (`progressChannels`, `progressRing`, `liveStates`/`liveSubs`, `globalSubs`/`activity`) moved from package globals into per-`Server` `sseHub`; stopped on `Shutdown`. Producers call `s.sse.broadcast`. | `internal/api/sse.go` (new), `server.go`, `handlers.go`, `live.go`, `generate.go`, `images.go` |
| 2 | Frames carry monotonic per-slug `id:`; handler honors `Last-Event-ID` (garbage → full replay). Ring always written, even with zero subscribers. Anonymous replays stay completion-only. No frontend change: `EventSource` consumes `id:` natively. | `internal/api/sse.go`, `internal/api/handlers.go` |
| 3 | `liveStates` TTL: 60s sweeper evicts entries idle >10m plus their rings when unsubscribed. Ring survives zero watchers until then (deleting it on last-unsubscribe was the old bug). | `internal/api/sse.go` |
| 4 | Tests `TestSSEResume` (replay cursor + anon filter) and `TestSSESweepReclaimsIdle`. | `internal/api/sse_test.go` |

## Done — Phase 1.5 (config validation)

Phase 1 complete. `internal/config` loads once at boot: panics on missing/short (<32B) `JWT_SECRET` without `ALLOW_DEV_AUTH=1`, warns on mock-mode / dead revalidate / missing LLM-search-paystack keys, logs one greppable `CONFIG:` summary line. `main.go` consumes it (port, DB URL, migrations dir). JWT floor also enforced in `jwtSecret()`. Tests cover panic/dev-allow/defaults. (`os.Getenv` call sites migrate one by one when touched — not bulk-rewired.)

| Files | `internal/config/config.go` + `config_test.go` (new), `cmd/server/main.go`, `internal/api/jwt.go` |

## Done — Phase 2.1 (chat deadlines)

| # | Fix | Files |
|---|-----|-------|
| 1 | `LLMCaller` takes `ctx` first; `SendPromptStream`/`doLLMRequest` derive the 300s per-attempt timeout from the caller ctx instead of `Background`. Retry backoff selects on `ctx.Done` — no sleeping into a dead client. | `internal/agent/agent.go`, `internal/agent/llm.go` |
| 2 | `Run` wraps `AgentConfig.Ctx` (nil = Background) in a 10-min overall deadline; dead ctx returns before the first LLM call. `finalize` takes the run ctx. Chat passes `r.Context()` — tab close now cancels in-flight tokens, not just the abort flag after the fact. | `internal/agent/agent.go`, `internal/agent/types.go`, `internal/api/chat.go` |
| 3 | Test `TestRun_DeadContextFailsFast` (zero LLM calls burned). Only test fake (`scriptedLLM`) updated for the new signature. | `internal/agent/agent_test.go` |

## Done — Phase 2.2 (rate-limit identity)

| # | Fix | Files |
|---|-----|-------|
| 1 | All 429s carry `Retry-After` (window seconds) — blind rejects caused reconnect storms. Shared `userKey` helper (user bucket, IP fallback). | `internal/api/server.go` |
| 2 | Per-user `writeLimiter` (10/min) enforced on generate/refresh/contest — the shared 60/min IP bucket never bound 15-minute pipelines. | `internal/api/server.go`, `handlers.go`, `contest.go` |
| 3 | `contested`/`stale` `limit` capped at 100 (were unbounded full-table scans on demand). | `internal/api/handlers.go` |
| 4 | Test `TestWriteBudgetRejectsWithRetryAfter` (10 allowed, 11th 429 + header). | `internal/api/validate_test.go` |

Skipped: true token-bucket (fixed-window is fine at this scale), trusted-proxy hop validation, per-route read budgets — revisit when 429s appear in logs.

## Done — Phase 2.3 (read-path caching)

| # | Fix | Files |
|---|-----|-------|
| 1 | Shared `serveETag` helper + `cache60` (`public, max-age=60`, matches ISR). Article gets exact ETag from `UpdatedAt` (regeneration bumps it, zero extra queries); `handleGetMap` deduped onto the helper. Epistemic gets Cache-Control only — freshness scores decay with wall-clock, so an ETag would lie. | `internal/api/handlers.go`, `maps.go` |
| 2 | `Cache-Control: max-age=60` on list, claim-graph, contested, top, stale. `top` limit also capped at 100. | `internal/api/handlers.go` |
| 3 | Article page is composite-only: 4 widgets take optional composite slices (fetch skipped when provided) and mount only once the composite lands (or while generating, when it is disabled) — 5 round-trips collapse to 2 with no UX change (widgets already rendered null/loading until data). `ClaimGraphViewer` already had the `data` override; now the fetch is actually skipped. | `ArticleClient.tsx`, `FreshnessBadge.tsx`, `RefreshDiffBanner.tsx`, `ArticleGapsPanel.tsx`, `ClaimGraphViewer.tsx` |
| 4 | Tests `TestServeETag304`; frontend `typecheck` (api-boundary + tsc) green. | `internal/api/validate_test.go` |

Skipped: `RetroArticle` keeps its own `useRefreshDiff` (standalone surface, no composite loaded there); CDN/`stale-while-revalidate` — revisit with traffic data.

## Done — Phase 2.4 (billing hardening)

| # | Fix | Files |
|---|-----|-------|
| 1 | Webhook event dedup: `webhook_events` ledger keyed `event:id` (fallback ref/email); replays ack `{"duplicate":true}` instead of re-firing fulfillment or re-downgrading. Dedup key released on transient failure so Paystack retries reprocess. | `migrations/015_billing_dedup_usage.sql`, `internal/storage/db.go`, `internal/api/paystack.go` |
| 2 | Transient vs permanent webhook responses: transport/provider-5xx/DB-write failures → 502/503 (Paystack retries); amount/plan/tier rejects → 200 + loud log. `errPaystackTransient` sentinel via `errors.Is`. | `internal/api/paystack.go` |
| 3 | Real daily quota: `daily_usage` table, atomic check-and-increment upsert (no overshoot under concurrency), enforced on generate/refresh/contest (free 10/day, pro 100/day, enterprise unlimited, fail-open on ledger error, 429 + Retry-After till midnight). Burns only on real enqueues. `/quota` reports real used/remaining. | `internal/storage/db.go`, `internal/api/handlers.go`, `contest.go` |
| 4 | Mock ledger parity: payments, usage, webhook keys in memory — file mode no longer double-fulfills or ignores quota. | `internal/storage/db.go` |
| 5 | Tests `TestMockBillingLedger` (ledger idempotency + quota + dedup) and `TestPaystackWebhookReplayDeduped`. | `internal/storage/billing_test.go`, `internal/api/paystack_test.go` |

Skipped: subscription-grace windows on disable, plan-change proration — needs product decisions first.

## Done — Phase 2.5 (Search + Graph Scale)

| # | Fix | Files |
|---|-----|-------|
| 1 | Trigram GIN indexes created on `articles.title`, `articles.abstract`, and `maps.title` for fast pattern matching. Expression index added for JSONB `contradiction_level`. | `migrations/016_perf_gin_and_expression_indexes.sql` |
| 2 | `GetRefreshDiff` uses `ROW_NUMBER() OVER` window function query to eliminate 1+N DB calls. | `internal/storage/epistemic.go` |

## Done — Phase 2.6 (Router Guarding & Reliability)

| # | Fix | Files |
|---|-----|-------|
| 1 | Reserved keyword guards (`top`, `search`) added to `handleArticlesDynamicRoute` preventing route ambiguity and 404/wrong-slug fallbacks. | `internal/api/server.go` |

## Done — Phase 2.7 (Observability & Diagnostics)

| # | Fix | Files |
|---|-----|-------|
| 1 | Active DB ping check added to `/health` with a 2s context timeout, returning status `ok` or `unreachable` with appropriate HTTP status codes (200 / 533). | `internal/storage/db.go`, `internal/api/server.go` |
| 2 | Fixed `agent_trace.log` overwriting behavior by implementing `appendAgentTrace` using append file flags (`O_APPEND|O_CREATE|O_WRONLY`). | `internal/api/chat.go` |
| 3 | Added `Duration` tracking per DAG node in `ProgressUpdate` struct. | `internal/dag/engine.go` |

