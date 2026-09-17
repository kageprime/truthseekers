# Truthseekers (VERITAS)

An LLM-powered interactive encyclopedia — an AI agent-driven knowledge base that produces structured, evidence-grounded articles.

> **Stack note (August 2026):** Backend: pure Go — no Python, no Node, no web framework. Legacy packages (`packages/server`, `packages/storage`, `packages/cli`) are deleted. This file is the central documentation hub. No scattered design docs or analysis files exist outside of `veritas/docs/` (design references) and the root roadmap files.

## Architecture

- **Backend:** Go orchestrator (`veritas/go-orchestrator/`) — std-library `net/http` API gateway on port **4097**, native Go agent loop, and an optimized DAG engine. Zero web frameworks. PostgreSQL via `database/sql` + `lib/pq`.
- **Epistemic Pipeline:** Native Go LLM calls (`internal/agent/pipeline.go`) — 10 nodes (including parallel `generate_media` and conditional `scrutinize` skipping for consensus topics). Epistemic data (claims, evidence, gaps, language flags, scrutiny) is persisted to PostgreSQL and served through the API. No Python dependency.
- **Autonomous CMS Engine:** `VeritasWorker` (`internal/api/autonomous.go`) runs background watchdog tasks (stale article refresh, gap mini-scrutiny, claim graph re-indexing) on a 60-minute cycle with rate limiting (max 5 jobs/hour) and `requireApproval` IAM policy guardrails.
- **Multi-Source Real Photo Scoring:** `MultiSourceImageSearch` (`internal/agent/image_scorer.go`) queries Wikimedia Commons, NASA API, and Met Museum API, evaluating candidates against a 3-tier mathematical rubric ($S_{\text{total}} = 0.40 S_{\text{auth}} + 0.40 S_{\text{rel}} + 0.20 S_{\text{qual}}$). Only items with $S_{\text{total}} \ge 50$ are auto-attached; fallbacks carry `"✦ AI Visual Reconstruction"` badges.
- **Storage:** PostgreSQL with automated migrations on boot (`internal/storage/migrate.go`). Falls back to file-backed mock mode when `DATABASE_URL` is unset.
- **Frontend:** Next.js 15 (`packages/web/`) — deployed to Vercel, calls the Go API via `NEXT_PUBLIC_API_URL`.
- **Layout Architecture:** Global 3-column dual-sidebar grid layout across all pages (`[Left Contents Index] | [Centered Main Reading Canvas] | [Right Epistemic & Veritas Rail]`).
- **State (client):** TanStack React Query 5 for server-state queries/mutations (`hooks/useApi.ts`) + local component state for ephemeral UI state.
- **Real-time:** SSE streaming parser (`app/hooks/useChatStream.ts`) + shared `useArticleProgress` hook for `/articles/:slug/progress`.
- **Containerization:** `docker-compose.yml` — Postgres 15 + Go backend (:4097) + Next.js frontend (:3000).

---

## Repository Layout

| Path | Purpose |
|------|---------|
| `veritas/go-orchestrator/` | Go API gateway, native agent, DAG engine, PostgreSQL storage, autonomous worker |
| `veritas/go-orchestrator/internal/agent/pipeline.go` | Native Go epistemic pipeline (retrieve → extract_claims → … → generate_article & generate_media) with embedded prompts and `SendPromptJSON` LLM calls |
| `veritas/go-orchestrator/internal/agent/image_scorer.go` | Multi-source real photo search & quality scoring engine (Wikimedia, NASA, Met Museum) |
| `veritas/go-orchestrator/internal/api/autonomous.go` | VeritasWorker autonomous CMS background engine, watchdog tasks, audit log, and IAM guardrails |
| `veritas/docs/` | System design, epistemic-layer contract, interactive roadmap |
| `packages/web/` | Next.js frontend (3-column dual-sidebar layout, interactive epistemic workbench, rich block renderers) |
| `packages/core/` | TS types + `articleToBlocks` (consumed by frontend at build/runtime) |

### Go orchestrator internals

| Package | Path | Purpose |
|---------|------|---------|
| `main` | `cmd/server/main.go` | Boot: load `.env`, connect PostgreSQL (or mock mode), start server on `PORT` (default 4097), graceful shutdown |
| `cmd/test-dag` | `cmd/test-dag/main.go` | CLI that runs the full 10-node DAG end-to-end against a sample topic |
| `api` | `internal/api/` | HTTP layer: routing, CORS, JWT auth, article/job/quota/chat handlers, autonomous worker, SSE progress broadcast |
| `agent` | `internal/agent/` | Native Go agent loop (up to 25 iterations, 90k-token budget), OpenAI-compatible streaming LLM client, tool definitions + builtin executors, image scoring |
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

---

## API Surface (Go)

Routes are registered in `internal/api/server.go` (`setupRoutes`) and dispatched by hand-splitting path segments.

| Route | Methods | Notes |
|-------|---------|-------|
| `/auth/login`, `/auth/me`, `/auth/onboard` | POST / GET / POST | Email login, returns a real HS256 JWT with `role` claim |
| `/chat`, `/chat/:id`, `/chat/:id/messages` | GET/POST/PATCH / POST | Conversations + SSE-streamed agent run |
| `/articles`, `/articles/search`, `/articles/top` | GET | List / search / top |
| `/articles/:slug` | GET | Fetch article |
| `/articles/:slug/{status,progress,generate,refresh,export,resolve,views,graph,claim-graph,claims,gaps,freshness,refresh-diff,epistemic}` | various | Per-article sub-resources; `progress` is SSE; `claim-graph` returns the claim-level force-directed graph; `refresh-diff` summarizes claim version changes; `epistemic` is the composite |
| `/claims/:id/evidence` | GET / POST | Fetch claim details + evidence; submit community counter-evidence to trigger mini-scrutiny |
| `/claims/search` | GET | Claim Finder — substring search over claim text with article slugs (`?q=`, `?limit=`) |
| `/contested` | GET | Public dashboard — most contested claims across the encyclopedia, ranked by contradiction level |
| `/claim-graph` | GET | Global claim graph — top-N most-contested claims + evidence + claim→claim edges (`?limit=`, `?min_contradiction=`) |
| `/api/revalidate` (Next.js) | POST | On-demand revalidation: clears ISR cache for `/article/{slug}` + global pages |
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
| `/paystack/initialize` | POST | Authed: start a tier transaction → `{authorization_url, reference}` |
| `/paystack/verify/:reference` | GET | Authed: confirm payment, upgrade tier |
| `/paystack/webhook` | POST | Paystack HMAC-SHA512 webhook: `charge.success` fulfills, `subscription.disable` downgrades |
| `/webhook/{slug}` | POST | Webhook-triggered article generation with optional HMAC verification |

---

## Agent Tool Loop (Chat)

The native Go agent (`internal/agent/agent.go`) runs a tool-calling loop:

1. **Configure** — system prompt + message history + merged tool set (builtins + server executors).
2. **Iterate** — up to `defaultMaxIterations = 25`. Each iteration calls the streaming LLM, executes tool calls, and feeds results back as `tool`-role messages. A 90k-token budget trims oversized results.
3. **Finalize** — when the LLM returns no tool calls, text and deduplicated blocks stream as the final answer.

Events (`trace`, `text`, `tool_use`, `tool_result`) emit to the SSE client in real time via the `OnEvent` callback.

---

## Tool Registry

Tool definitions live in `internal/agent/tools.go` (16 tools). Builtin executors are in the agent package; server-dependent executors are wired in `internal/api/chat.go` (`createServerToolExecutors`).

| Tool | Executor Location | Purpose |
|------|-------------------|---------|
| `web_search` | Builtin (agent) | Web search via Tavily or Firecrawl; routes through executor gateway when active |
| `render_blocks` | Builtin (agent) | Returns `output.blocks` for rich rendering (includes maps, compare sliders, interactive calcs, diagrams) |
| `webfetch` | Builtin (agent) | Fetch URL content, strip HTML |
| `verify_citation` | Builtin (agent) | LLM verdict on whether a source supports a claim |
| `get_article` | Server (chat.go) | Fetch article by slug |
| `create_article` | Server (chat.go) | Queue article generation through session lifecycle engine |
| `article_search` | Server (chat.go) | Search articles by query |
| `get_map` | Server (chat.go) | Fetch map by slug |
| `generate_image` | Builtin (agent) | Image generation; writes PNGs to `ENCARTA_IMAGE_DIR` / `public/images` |
| `web_image_search` | Builtin (agent) | Multi-source real photo search (Wikimedia, NASA, Met) with automated quality scoring ($S_{\text{total}} \ge 50$) |
| `generate_video` | Server (chat.go) | *(stubbed — not available)* |
| `suggest_related` | Server (chat.go) | Outgoing + incoming graph edges |
| `task` | Server (chat.go) | Delegate to a sub-agent with a limited tool set |
| `mem_store` | Server (chat.go) | Store a key-value preference |
| `mem_recall` | Server (chat.go) | Recall a stored preference |
| `get_platform_status` | Server (chat.go) | Get real-time CMS metrics, active sessions, open gaps, contested claims, and platform health |
| `get_autonomous_summary` | Server (chat.go) | Get summary of background actions taken by VeritasWorker while user was away |

---

## Session Lifecycle & DAG Pipeline

### State Machine
```
created → queued → provisioning → running → completing → completed | failed | stopped
```

### 10-Node DAG Pipeline
```
                    ┌──► critique ──────┐
                    │                   │
retrieve ──► extract_claims ──► map_evidence ──► scrutinize* ──► resolve ──┬──► generate_article
                    │                   │                         │
                    ├──► detect_missing ┘                         └──► generate_media
                    │                   │
                    └──► map_language ──┘
```
*\*`scrutinize` node is dynamically skipped when `map_evidence` finds 0 contested claims and no reader contestation note is present.*
*\*`generate_media` runs in parallel with `generate_article` as soon as `resolve` completes.*

---

## Frontend Architecture & Components

Next.js 15 App Router under `packages/web/src/app/`.

### Unified 3-Column Layout (`RetroShell.tsx`)
- **Column 1 (Left Sidebar)**: `RetroContentsNav` (Spine, Living Encyclopedia, Create, Account, Time Machine, Word of the Day). Full-width LFEI link styling.
- **Column 2 (Center Canvas)**: Centered single main reading canvas (flat editorial style, no cards-inside-cards).
- **Column 3 (Right Sidebar)**: `GlobalRightSidebar` (Veritas status, active job ticker, top contested claims, open gaps, "Ask Veritas" chat link).

### Epistemic Workbench & Interactivity Components
- **EpistemicInspectorDrawer** — sentence-level claim provenance, confidence rating, language precision upgrades, and community evidence submission.
- **PanoramicMapViewer** — ultra-wide historical cartography & topographical map viewer with drag-pan, zoom, hotspot pins, and time-comparison slider.
- **MapCompareViewer** — before/after split slider for Leaflet 2D / Three Fiber 3D maps.
- **InteractiveCalcWidget** — live formula playground with parameter sliders for math, physics, and economics.
- **Archival Photo Lightbox Metadata** (`MediaImage.tsx`) — lightbox drawer for high-res downloads, institution attributions, and license details.
- **EpistemicGraphWidget** & **InteractiveChart** — force-directed contested claim widget and dynamic SVG chart renderer.

---

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

### Testing
```bash
cd veritas/go-orchestrator && go test ./...  # Backend tests
cd packages/web && npx tsc --noEmit           # Frontend TS check
```
