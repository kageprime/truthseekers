# Truthseekers (VERITAS)

An LLM-powered interactive encyclopedia — an AI agent-driven knowledge base that produces structured, evidence-grounded articles.

> **Stack note (August 2026):** Backend: pure Go — no Python, no Node, no web framework. Legacy packages (`packages/server`, `packages/storage`, `packages/cli`) are deleted. This file is the central documentation hub. No scattered design docs or analysis files exist outside of `veritas/docs/` (design references) and the root roadmap files.

## Architecture

- **Backend:** Go orchestrator (`veritas/go-orchestrator/`) — std-library `net/http` API gateway on port **4097**, native Go agent loop, and a DAG engine. Zero web frameworks. PostgreSQL via `database/sql` + `lib/pq`.
- **Epistemic pipeline:** Native Go LLM calls (`internal/agent/pipeline.go`) — 9 nodes invoked via `SendPromptJSON`. Epistemic data (claims, evidence, gaps, language flags, scrutiny) is persisted to PostgreSQL and served through the API. No Python dependency.
- **Storage:** PostgreSQL with automated migrations on boot (`internal/storage/migrate.go`). Falls back to file-backed mock mode when `DATABASE_URL` is unset.
- **Frontend:** Next.js 15 (`packages/web/`) — deployed to Vercel, calls the Go API via `NEXT_PUBLIC_API_URL`.
- **State (client):** TanStack React Query 5 for server-state queries/mutations (`hooks/useApi.ts`) + local component state for ephemeral UI state.
- **Real-time:** SSE streaming parser (`app/hooks/useChatStream.ts`) + shared `useArticleProgress` hook for `/articles/:slug/progress`.
- **Containerization:** `docker-compose.yml` — Postgres 15 + Go backend (:4097) + Next.js frontend (:3000).

## Repository Layout

| Path | Purpose |
|------|---------|
| `veritas/go-orchestrator/` | Go API gateway, native agent, DAG engine, PostgreSQL storage |
| `veritas/go-orchestrator/internal/agent/pipeline.go` | Native Go epistemic pipeline (retrieve → extract_claims → … → generate_article) with embedded prompts and `SendPromptJSON` LLM calls |
| `veritas/docs/` | System design, epistemic-layer contract, migration status |
| `packages/web/` | Next.js frontend (the only live TS package) |
| `packages/core/` | **Legacy** — TS types + `articleToBlocks`; still consumed by the frontend at runtime |

### Go orchestrator internals

| Package | Path | Purpose |
|---------|------|---------|
| `main` | `cmd/server/main.go` | Boot: load `.env`, connect PostgreSQL (or mock mode), start server on `PORT` (default 4097), graceful shutdown |
| `cmd/test-dag` | `cmd/test-dag/main.go` | CLI that runs the full 9-node DAG end-to-end against a sample topic |
| `api` | `internal/api/` | HTTP layer: routing, CORS, JWT auth, article/job/quota/chat handlers, SSE progress broadcast |
| `agent` | `internal/agent/` | Native Go agent loop (up to 25 iterations, 90k-token budget), OpenAI-compatible streaming LLM client, tool definitions + builtin executors |
| `dag` | `internal/dag/` | Workflow DAG engine: cycle detection, concurrent node execution, exponential-backoff retries, channel-based progress streaming |
| `storage` | `internal/storage/db.go` | PostgreSQL CRUD for articles, jobs, conversations, messages, users, graph edges, maps, memory KV, epistemic tables (claims, evidence, gaps, language flags, scrutiny) |
| `iam` | `internal/iam/` | Role-based authorization (6 fixed roles, action-level permissions, glob matching, agent scope) |
| `executor` | `internal/executor/` | Tool execution gateway: server-side credential resolution, policy engine (allow/block/approval), audit, custom executors |
| `llm-gateway` | `internal/llm-gateway/` | Unified LLM routing: model catalog, usage metering, cost estimation, `GET /v1/llm/models` |
| `session-lifecycle` | `internal/session-lifecycle/` | Generation session state machine (created→→completed), idempotency, backpressure, retry/dead-letter |
| `manifest` | `internal/manifest/` | Optional JSON project config (`veritas.json`) — agents, connectors, pipeline, policies, triggers, sandbox defaults |
| `credstore` | `internal/credstore/` | In-memory credential store with hot-swap via `PATCH /v1/credentials`; no restart for key rotation |
| `registry` | `internal/registry/` | File-system auto-discovery of skills, tools, and commands from `veritas/registry/` |
| `triggers` | `internal/triggers/` | Cron scheduler (60s tick, 5-field expressions) + webhook handler (HMAC-verified POST /webhook/{slug}) |

## API Surface (Go)

Routes are registered in `internal/api/server.go` (`setupRoutes`) and dispatched by hand-splitting path segments.

| Route | Methods | Notes |
|-------|---------|-------|
| `/auth/login`, `/auth/me`, `/auth/onboard` | POST / GET / POST | Email login, returns a real HS256 JWT with `role` claim |
| `/chat`, `/chat/:id`, `/chat/:id/messages` | GET/POST/PATCH / POST | Conversations + SSE-streamed agent run |
| `/articles`, `/articles/search`, `/articles/top` | GET | List / search / top |
| `/articles/:slug` | GET | Fetch article |
| `/articles/:slug/{status,progress,generate,refresh,export,resolve,views,graph,claim-graph,claims,gaps,freshness,refresh-diff,epistemic}` | various | Per-article sub-resources; `progress` is SSE; `claim-graph` returns the claim-level force-directed graph (claims + evidence nodes, typed edges); `refresh-diff` summarizes claim version changes from the last refresh; `epistemic` is the composite — claims + gaps + freshness + refresh_diff + claim_graph in one round-trip |
| `/contested` | GET | Public dashboard — most contested claims across the encyclopedia, ranked by contradiction level |
| `/claim-graph` | GET | Global claim graph — top-N most-contested claims + their evidence + claim→claim edges, `?limit=` (default 150, max 500) and `?min_contradiction=` (default 0) filters; each claim node carries `article_slug` so the frontend can link back |
| `/api/revalidate` (Next.js) | POST | On-demand revalidation: clears ISR cache for `/article/{slug}` + global pages; called by Go via `X-Revalidate-Secret` after every article completion (env: `REVALIDATE_SECRET`, `NEXT_PUBLIC_API_URL`) |
| `/gaps` | GET | All open evidence gaps, enriched with claim text + upvote count |
| `/gaps/:id/upvote` | POST | Community upvote on a gap (idempotent per user) |
| `/gaps/:id/submit` | POST | Submit community evidence (URL + note) for a gap |
| `/stale` | GET | Articles ranked by evidence freshness ascending (stalest first) |
| `/quota`, `/queue`, `/track` | GET / GET / POST | Mock quota, mock queue, view tracking |
| `/v1/executor/call` | POST | Tool execution gateway (credential isolation, policy, audit) |
| `/v1/executor/connectors` | GET | List available connectors |
| `/v1/llm/models` | GET | Model catalog with capabilities and limits |
| `/v1/llm/completions` | POST | Unified LLM completion proxy with usage metering |
| `/v1/llm/usage` | GET | Usage stats per user |
| `/v1/credentials` | PATCH | Hot-swap an API token: `{"service":"groq","token":"new-key"}` |
| `/webhook/{slug}` | POST | Webhook-triggered article generation with optional HMAC verification |

### Frontend ↔ Backend Integration

| Backend Feature | Frontend Status |
|----------------|-----------------|
| Auth (login, me, onboard) | WIRED — login page, profile, JWT in cookies |
| IAM roles | WIRED — role decoded from JWT payload, exposed on `User` as `user.role` |
| Article CRUD | WIRED — list, search, single article pages |
| Article generation + SSE | WIRED — generate button, progress via EventSource |
| Chat + agent streaming | WIRED — full chat UI with ReadableStream SSE parser |
| Model catalog (`/v1/llm/models`) | WIRED — replaces hardcoded model list in chat selector |
| Credential hot-swap (`/v1/credentials`) | WIRED — admin page credential management section |
| Connector list (`/v1/executor/connectors`) | WIRED — admin page debug section |
| LLM usage stats (`/v1/llm/usage`) | WIRED — admin page usage dashboard |
| Maps, Quota, Queue, Tracking | WIRED — existing integrations |
| Webhook (`/webhook/{slug}`) | NOT WIRED — no frontend UI (backend-only, for external callers) |
| Executor call (`/v1/executor/call`) | NOT WIRED — gateway is for agent internal routing, not frontend |

> **Known gaps vs. the frontend:** `/maps`, `/admin/settings`, and `/stripe/*` sub-routes are now implemented in Go. The internal epistemic pipeline fully persists claims, evidence, gaps, language flags, and scrutiny assessments.

## Agent Tool Loop (Chat)

The native Go agent (`internal/agent/agent.go`) runs a tool-calling loop:

1. **Configure** — system prompt + message history + merged tool set (builtins + server executors).
2. **Iterate** — up to `defaultMaxIterations = 25`. Each iteration calls the streaming LLM, executes any tool calls, and feeds results back as `tool`-role messages. A 90k-token budget trims/summarizes oversized tool results.
3. **Finalize** — when the LLM returns no tool calls, the accumulated text and deduplicated blocks are streamed as the final answer.

Events (`trace`, `text`, `tool_use`, `tool_result`) are emitted to the SSE client in real time via the `OnEvent` callback.

## Tool Registry

Tool definitions live in `internal/agent/tools.go` (14 tools). Builtin executors (4) are also in the agent package; server-dependent executors (9) are wired in `internal/api/chat.go` (`createServerToolExecutors`).

| Tool | Executor Location | Purpose |
|------|-------------------|---------|
| `web_search` | Builtin (agent) | Web search via Tavily or Firecrawl; when gateway is active, routes through `/v1/executor/call` for credential isolation |
| `render_blocks` | Builtin (agent) | Returns `output.blocks` for rich rendering |
| `webfetch` | Builtin (agent) | Fetch URL content, strip HTML |
| `verify_citation` | Builtin (agent) | LLM verdict on whether a source supports a claim |
| `get_article` | Server (chat.go) | Fetch article by slug |
| `create_article` | Server (chat.go) | Queue article generation through session lifecycle engine |
| `article_search` | Server (chat.go) | Search articles by query |
| `get_map` | Server (chat.go) | Fetch map by slug |
| `generate_image` | Builtin (agent) | Image generation; writes PNGs to `ENCARTA_IMAGE_DIR` / `public/images` |
| `generate_video` | Server (chat.go) | *(stubbed — not available)* |
| `suggest_related` | Server (chat.go) | Outgoing + incoming graph edges |
| `task` | Server (chat.go) | Delegate to a sub-agent with a limited tool set |
| `mem_store` | Server (chat.go) | Store a key-value preference |
| `mem_recall` | Server (chat.go) | Recall a stored preference |

## IAM & Authorization

Roles (`internal/iam/role-perms.go`): 6 fixed roles — `owner > admin > member` (account), `manager > editor > viewer` (project). Actions follow `<resource>.<verb>` pattern (e.g., `article.read`, `project.deploy`, `admin.settings.write`). Glob matching supports `*` at any position. `Authorize()` checks account role + optional project role against a target resource.

JWT tokens (`internal/api/jwt.go`) now carry a `role` claim. The `userAuthFromRequest()` helper returns both userID and role for route-level authorization.

## Executor Gateway

All tool calls can optionally route through the executor gateway (`internal/executor/`) for credential isolation, policy enforcement, and audit. The gateway:
1. Resolves the connector definition (Tavily, Firecrawl, etc.) from server-side config
2. Loads the stored credential **server-side only**
3. Checks policies (glob-based allow/block/require_approval)
4. Executes the call (HTTP) with credential attached
5. Records an audit entry

The `web_search` tool has been migrated: when `agent.GatewaySearch` is set (done in `NewServer`), searches route through the gateway instead of reading env vars directly.

## LLM Gateway

The LLM gateway (`internal/llm-gateway/`) provides a unified model catalog (`/v1/llm/models`), completion proxy (`/v1/llm/completions`), and usage metering (`/v1/llm/usage`). The model catalog replaces the hardcoded `resolveModel()` switch in `llm.go` with a data-driven lookup. Usage is tracked per-user in memory (ring buffer, 10k records).

## Session Lifecycle Engine

Article generation sessions (`internal/session-lifecycle/`) now follow a formal state machine:
```
created → queued → provisioning → running → completing → completed | failed | stopped
```
Features: idempotency keys (prevent double-generation), slug dedup, backpressure (queues at ≥3 active sessions), automatic drain when slots free, retry (up to 5 attempts, then dead-letter).

## Article Generation Pipeline

The epistemic pipeline is a 9-node DAG executed by `internal/dag/engine.go`, with each node implemented as a native Go LLM call via `SendPromptJSON` in `internal/agent/pipeline.go`:

`retrieve → extract_claims → map_evidence → critique → detect_missing → map_language → scrutinize → resolve → generate_article`

Each node calls the LLM directly with the inherited system prompt and its own embedded node prompt. The DAG is wired into both the chat agent (as tools) and the article generation HTTP path (`internal/api/generate.go`). Progress streams to the frontend via `BroadcastProgress` over the `/articles/:slug/progress` SSE endpoint.

## LLM Providers

The streaming client (`internal/agent/llm.go`) routes models to two OpenAI-compatible providers:

- **DigitalOcean Inference** (`https://inference.do-ai.run/v1`, key `MODEL_ACCESS_KEY`) — default model `gemma-4-31B-it`.
- **Groq** (`https://api.groq.com/openai/v1`, key `GROQ_API_KEY`) — chat default `deepseek-4-flash`.

Both pipelines default to the `epistemic_model` (qwen/qwen3-32b) via `SendPromptJSON`.

## Security

- Bearer-token auth via HS256-signed JWT (`internal/api/jwt.go`) with `role` claim in the payload. Default signing key is `veritas-dev-secret-change-me`; panics if unset in production (`VERITAS_ENV=production`).
- CORS allowing all origins (configurable via `CORS_ORIGIN`).
- Rate limiting (in-memory token bucket per IP, 3 tiers: auth 10/min, chat 30/min, API 60/min).
- Graceful shutdown on SIGINT/SIGTERM.
- The `run_command` tool executes arbitrary shell commands — gated off in production (`VERITAS_ENV=production`); explicit opt-in via `ENABLE_RUN_COMMAND=1`. Sandbox or remove for hostile deployments.

> **Note:** Real JWT signing, rate limiting, and input validation are now implemented. Remaining hardening items: `run_command` sandboxing, `randID` crypto hardening, rate limiter cleanup goroutine.

## Quick Start (Local)

### Go backend

```bash
cd veritas/go-orchestrator
go run ./cmd/server            # API on http://localhost:4097 (mock-mode DB if no DATABASE_URL)
```

### Full stack (Docker)

```bash
make up                        # Postgres + Go backend (:4097) + Next.js frontend (:3000)
```

### Frontend only

```bash
npm install
npm run dev                    # from repo root, runs the Next.js app
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string for the Go storage layer (unset → mock mode) |
| `PORT` | Go API port (default `4097`) |
| `CORS_ORIGIN` | Allowed CORS origin |
| `MODEL_ACCESS_KEY` | DigitalOcean Inference API key |
| `GROQ_API_KEY` | Groq API key |
| `OPENAI_API_KEY` | OpenAI key (fallback for LLM gateway) |
| `FIRECRAWL_API_KEY` / `TAVILY_API_KEY` | Web-search backend for the `web_search` tool |
| `ENCARTA_IMAGE_DIR` | Output dir for generated images (default `public/images`) |
| `NEXT_PUBLIC_API_URL` | API URL for the frontend (default `http://localhost:4097`) |
| `VERITAS_ENV` | `production` panics on missing `JWT_SECRET` and disables `run_command` |
| `ENABLE_RUN_COMMAND` | `1` re-enables the `run_command` tool (prod opt-in, default off) |

## Streaming Transparency

- **Server side:** `BroadcastProgress` (`internal/api/handlers.go`) fans SSE events to all subscribers on a slug's channel; chat runs emit `agent_event` frames from the agent's `OnEvent` callback (`internal/api/chat.go`).
- **SSE endpoints:** `/articles/:slug/progress` emits `progress`, `article_complete`, and `heartbeat` events; `/chat/:id/messages` emits `agent_event` (with inner `type` of `text`/`tool_use`/`tool_result`/`done`).
- **Frontend:** `useChatStream.ts` parses `data:` lines; `ProcessViewer` / `GenerationBar` render live tool activity and phase progress.

## Frontend State & Hooks

| Path | Purpose |
|------|---------|
| `hooks/useApi.ts` | React Query hook layer — useQuery/useMutation wrappers over `lib/api.ts` (the only sanctioned fetch layer) |

## Frontend Routes

Next.js App Router under `packages/web/src/app/`. Public reads are public; writes (generate/refresh/resolve) require auth via the `optionalAuthMiddleware` pattern. Articles use `force-static`-friendly ISR (`revalidate: 60`) and opt into `generateMetadata` for OG tags.

| Route | Source | Notes |
|-------|--------|-------|
| `/` | `app/page.tsx` | Marketing landing — hero, bento, accordion, testimonials, CTA |
| `/articles`, `/articles/page.tsx` | Browse all articles with filters |
| `/article/new` | `app/article/new/page.tsx` | Generate a new article (auth required) |
| `/article/[slug]` | `app/article/[slug]/page.tsx` | Read an article; SSR with ISR; injects `ClaimReview` JSON-LD per claim |
| `/chat` | redirects to `/chat/new` | |
| `/chat/new`, `/chat/[id]` | `app/chat/[id]/page.tsx` | SSE-streamed agent chat with truth console side panel |
| `/claim-graph` | `app/claim-graph/page.tsx` | Global force-directed claim graph; limit + min-contradiction filters |
| `/contested`, `/gaps`, `/stale` | Public dashboards for the "Living Encyclopedia" surfaces |
| `/maps`, `/maps/[slug]` | Static + interactive maps (Leaflet + Three Fiber) |
| `/admin`, `/settings`, `/queue`, `/pricing`, `/onboarding`, `/login`, `/style-guide` | Auth-gated / utility pages |
| `/sitemap.xml`, `/robots.txt` | `app/sitemap.ts` (1h revalidate, 5000 article limit) + `app/robots.ts` |
| `/api/revalidate` | `app/api/revalidate/route.ts` | Receives `X-Revalidate-Secret` from Go after article completion |

## Header (FloatIslandNav)

`packages/web/src/app/components/FloatIslandNav.tsx` — single source of truth for the top nav.

| Group | Links |
|-------|-------|
| **Spine** (top nav) | Chat, Articles, Maps, Claim Graph |
| **Living Encyclopedia** (dropdown) | Contested, Open Questions, Stale |
| **More** (dropdown) | Pricing, Style Guide |
| **Right** | Theme toggle, Settings, Avatar (auth) |
| **Mobile** | Hamburger → morph-X sidebar (same groups, stacked vertically) |

## Frontend Components
- **SharedHeader** — search, generate button, nav links
- **GenerationBar** — expandable progress bar with phase timeline + `ProcessViewer`
- **ProcessViewer** — collapsible panel showing live tool_use, tool_result, text, and status events
- **BlockRenderer** — renders structured blocks (re-exports `articleToBlocks` from `@encarta/core`)
- **ThreeDMapViewer** — React Three Fiber 3D map viewer
- **MapViewer** — Leaflet-based 2D interactive map
- **InteractiveTimeline** — timeline visualization
- **MermaidDiagram** — Mermaid.js diagram renderer
