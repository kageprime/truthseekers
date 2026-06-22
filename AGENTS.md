# Truthseekers (VERITAS)

An LLM-powered interactive encyclopedia — an AI agent-driven knowledge base that produces structured, evidence-grounded articles.

> **Stack note (June 2026):** The backend has migrated from the legacy TypeScript/Hono stack (`packages/server`, `packages/core`) to a Go + Python architecture under `veritas/`. The Go orchestrator is the live API gateway; the legacy Node packages are retained for reference and pending removal (see `veritas/docs/MIGRATION_STATUS.md`).

## Architecture

- **Backend:** Go orchestrator (`veritas/go-orchestrator/`) — std-library `net/http` API gateway on port **4097**, native Go agent loop, and a DAG engine. No web framework.
- **Epistemic workers:** Python (`veritas/python-workers/`) — 9 stateless LLM nodes invoked by the Go orchestrator via a subprocess bridge (JSON over STDIN/STDOUT), with mock-data fallback when Python is absent.
- **Storage:** MongoDB via the `go.mongodb.org/mongo-driver`. The DB falls back to an in-memory **mock mode** when `MOONGOSE_CONNECTION_STRING` is unset or unreachable, so the server runs with zero infrastructure.
- **Frontend:** Next.js app (`packages/web/`) — deployed to Vercel, calls the Go API via `NEXT_PUBLIC_API_URL`.
- **Containerization:** `docker-compose.yml` wires up Postgres + Go backend + Next.js frontend; the `Makefile` wraps `up/down/build/logs`.

## Repository Layout

| Path | Purpose |
|------|---------|
| `veritas/go-orchestrator/` | Go API gateway, native agent, DAG engine, MongoDB storage |
| `veritas/python-workers/` | Python epistemic pipeline nodes (retrieve → extract_claims → … → generate_article) |
| `veritas/docs/` | System design, epistemic-layer contract, migration status |
| `packages/web/` | Next.js frontend (the only live TS package) |
| `packages/core/` | **Legacy** — TS types + `articleToBlocks`; still consumed by the frontend at runtime |
| `packages/server/`, `packages/storage/`, `packages/cli/` | **Legacy** — old Hono server, Mongoose storage, admin CLI; pending deletion |

### Go orchestrator internals

| Package | Path | Purpose |
|---------|------|---------|
| `main` | `cmd/server/main.go` | Boot: load `.env`, connect Mongo (or mock mode), start server on `PORT` (default 4097), graceful shutdown |
| `cmd/test-dag` | `cmd/test-dag/main.go` | CLI that runs the full 9-node DAG end-to-end against a sample topic |
| `api` | `internal/api/` | HTTP layer: routing, CORS, mock JWT auth, article/job/quota/chat handlers, SSE progress broadcast |
| `agent` | `internal/agent/` | Native Go agent loop (up to 15 iterations, 90k-token budget), OpenAI-compatible streaming LLM client, 14 tool definitions + builtin executors |
| `dag` | `internal/dag/` | Workflow DAG engine: cycle detection, concurrent node execution, exponential-backoff retries, channel-based progress streaming |
| `nodes` | `internal/nodes/executors.go` | Python subprocess bridge (`RunPythonNode`) with per-node mock fallback |
| `storage` | `internal/storage/db.go` | MongoDB CRUD for articles, jobs, conversations, messages, users, graph edges, maps, memory KV |

## API Surface (Go)

Routes are registered in `internal/api/server.go` (`setupRoutes`) and dispatched by hand-splitting path segments.

| Route | Methods | Notes |
|-------|---------|-------|
| `/auth/login`, `/auth/me`, `/auth/onboard` | POST / GET / POST | Email login, returns a (currently unsigned, dev-only) JWT |
| `/chat`, `/chat/:id`, `/chat/:id/messages` | GET/POST/PATCH / POST | Conversations + SSE-streamed agent run |
| `/articles`, `/articles/search`, `/articles/top` | GET | List / search / top |
| `/articles/:slug` | GET | Fetch article |
| `/articles/:slug/{status,progress,generate,refresh,export,resolve,views,graph}` | various | Per-article sub-resources; `progress` is SSE |
| `/quota`, `/queue`, `/track` | GET / GET / POST | Mock quota, mock queue, view tracking |

> **Known gaps vs. the frontend:** `/maps`, `/admin/settings`, and `/stripe/*` sub-routes are not yet implemented in Go — see the migration roadmap.

## Agent Tool Loop (Chat)

The native Go agent (`internal/agent/agent.go`) runs a tool-calling loop:

1. **Configure** — system prompt + message history + merged tool set (builtins + server executors).
2. **Iterate** — up to `defaultMaxIterations = 15`. Each iteration calls the streaming LLM, executes any tool calls, and feeds results back as `tool`-role messages. A 90k-token budget trims/summarizes oversized tool results.
3. **Finalize** — when the LLM returns no tool calls, the accumulated text and deduplicated blocks are streamed as the final answer.

Events (`trace`, `text`, `tool_use`, `tool_result`) are emitted to the SSE client in real time via the `OnEvent` callback.

## Tool Registry

Tool definitions live in `internal/agent/tools.go` (14 tools). Builtin executors (4) are also in the agent package; server-dependent executors (9) are wired in `internal/api/chat.go` (`createServerToolExecutors`).

| Tool | Executor Location | Purpose |
|------|-------------------|---------|
| `web_search` | Builtin (agent) | Web search via Tavily or Firecrawl |
| `render_blocks` | Builtin (agent) | Returns `output.blocks` for rich rendering |
| `webfetch` | Builtin (agent) | Fetch URL content, strip HTML |
| `verify_citation` | Builtin (agent) | LLM verdict on whether a source supports a claim |
| `get_article` | Server (chat.go) | Fetch article by slug |
| `create_article` | Server (chat.go) | Queue article generation *(currently stubbed)* |
| `article_search` | Server (chat.go) | Search articles by query |
| `get_map` | Server (chat.go) | Fetch map by slug |
| `generate_image` | Builtin (agent) | Image generation; writes PNGs to `ENCARTA_IMAGE_DIR` / `public/images` |
| `generate_video` | Server (chat.go) | *(stubbed — not available)* |
| `suggest_related` | Server (chat.go) | Outgoing + incoming graph edges |
| `task` | Server (chat.go) | Delegate to a sub-agent with a limited tool set |
| `mem_store` | Server (chat.go) | Store a key-value preference |
| `mem_recall` | Server (chat.go) | Recall a stored preference |

## Article Generation Pipeline

The epistemic pipeline is a 9-node DAG executed by `internal/dag/engine.go`, with each node implemented as a Python script under `veritas/python-workers/nodes/`:

`retrieve → extract_claims → map_evidence → critique → detect_missing → map_language → scrutinize → resolve → generate_article`

Each node reads JSON from STDIN and writes JSON to STDOUT. The Go bridge (`internal/nodes/executors.go`) spawns `python3 <node>.py` and falls back to schema-compliant mock output if Python is missing, so the pipeline runs in any environment. Progress streams to the frontend via `BroadcastProgress` over the `/articles/:slug/progress` SSE endpoint.

> **Status:** The DAG engine and Python nodes are complete, but the HTTP generate path (`handleGenerateArticle` → `processArticleStub`) is currently a stub that sleeps through phases and writes mock blocks. Wiring the real DAG into the HTTP path is pending — see `veritas/docs/MIGRATION_STATUS.md`.

## LLM Providers

The streaming client (`internal/agent/llm.go`) routes models to two OpenAI-compatible providers:

- **DigitalOcean Inference** (`https://inference.do-ai.run/v1`, key `MODEL_ACCESS_KEY`) — default model `gemma-4-31B-it`.
- **Groq** (`https://api.groq.com/openai/v1`, key `GROQ_API_KEY`) — chat default `deepseek-4-flash`.

The Python workers default to Groq (`llama-3.1-8b-instruct`) with their own mock mode.

## Security

- Bearer-token auth via (currently unsigned, dev-only) JWT — `internal/api/server.go:mockJWT`.
- CORS allowing all origins (configurable via `CORS_ORIGIN`).
- Graceful shutdown on SIGINT/SIGTERM.

> **Note:** Real JWT signing, rate limiting, and input validation are not yet implemented in the Go backend — tracked in the migration roadmap.

## Quick Start (Local)

### Go backend

```bash
cd veritas/go-orchestrator
go run ./cmd/server            # API on http://localhost:4097 (mock-mode DB if no Mongo)
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
| `MOONGOSE_CONNECTION_STRING` | MongoDB URI for the Go storage layer (sic — legacy typo; unset → mock mode) |
| `PORT` | Go API port (default `4097`) |
| `CORS_ORIGIN` | Allowed CORS origin |
| `MODEL_ACCESS_KEY` | DigitalOcean Inference API key |
| `GROQ_API_KEY` | Groq API key |
| `OPENAI_API_KEY` | OpenAI key (Python workers / fallback) |
| `FIRECRAWL_API_KEY` / `TAVILY_API_KEY` | Web-search backend for the `web_search` tool |
| `ENCARTA_IMAGE_DIR` | Output dir for generated images (default `public/images`) |
| `NEXT_PUBLIC_API_URL` | API URL for the frontend (default `http://localhost:4097`) |
| `DATABASE_URL` | Postgres URL — currently referenced by docker-compose but **not** wired into the Go storage layer |

## Streaming Transparency

- **Server side:** `BroadcastProgress` (`internal/api/handlers.go`) fans SSE events to all subscribers on a slug's channel; chat runs emit `agent_event` frames from the agent's `OnEvent` callback (`internal/api/chat.go`).
- **SSE endpoints:** `/articles/:slug/progress` emits `progress`, `article_complete`, and `heartbeat` events; `/chat/:id/messages` emits `agent_event` (with inner `type` of `text`/`tool_use`/`tool_result`/`done`).
- **Frontend:** `useChatStream.ts` parses `data:` lines; `ProcessViewer` / `GenerationBar` render live tool activity and phase progress.

## Frontend Components

- **PageLayout** — universal layout with SharedHeader + footer
- **SharedHeader** — search, generate button, nav links
- **GenerationBar** — expandable progress bar with phase timeline + `ProcessViewer`
- **ProcessViewer** — collapsible panel showing live tool_use, tool_result, text, and status events
- **BlockRenderer** — renders structured blocks (re-exports `articleToBlocks` from `@encarta/core`)
- **ThreeDMapViewer** — React Three Fiber 3D map viewer
- **MapViewer** — Leaflet-based 2D interactive map
- **InteractiveTimeline** — timeline visualization
- **MermaidDiagram** — Mermaid.js diagram renderer
