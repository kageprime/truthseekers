# Truthseekers

An LLM-powered interactive encyclopedia SDK — build your own AI agent-driven knowledge base.

## Current Sprint

Sprint roadmap lives in `ROADMAP.md`. Currently on **Sprint 1: Floating Chat Shell & Responsive Layout**.

## Architecture

- Monorepo with npm workspaces
- Agent loop via `@opencode-ai/sdk` (OpenCode server)
- TypeScript throughout
- MongoDB for serving, git for version history
- Next.js web frontend (deployed to Vercel)
- Hono API server (deployed to Fly.io)

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| @encarta-me/sdk | packages/core | B2B SDK — agent client, pipeline, queue, types |
| @encarta-me/storage | packages/storage | MongoDB, git versioning, vector index |
| @encarta-me/server | packages/server | Hono API server (reference implementation) |
| @encarta-me/web | packages/web | Next.js demo app |
| @encarta-me/cli | packages/cli | Admin CLI (seed, generate) |

## B2B SDK Positioning

Truthseekers is an SDK for building AI-powered encyclopedias. Third parties integrate the SDK to create their own agentic knowledge bases. The web app and API server are reference implementations showing what the SDK can do.

## Deployment Architecture

- **API (Fly.io):** `truthseeker` — Hono API server on port 4097, MongoDB on persistent volume
- **Web (Vercel):** `truthseeker-web` — Next.js static app, calls API via `NEXT_PUBLIC_API_URL`
- **CORS:** API locked to `https://truthseeker-web.vercel.app` (update to `terranet.tech` when domain ready)

## Agent Tool Loop (Chat)

The chat agent uses a tool-calling loop with a **planning phase** before execution:

| Phase | Description |
|-------|-------------|
| 3a. Plan | LLM outputs a JSON array of tool names in execution order. Plan injected as system message. First `n` iterations use `tool_choice` to force the planned tool. |
| 3b. Execute | Up to `MAX_TOOL_ITERATIONS` iterations. Each iteration calls `sendPromptStream` with tools, executes tool results via `toolExecutors` record, and feeds back as `tool` role messages. |
| 3c. Finalize | When LLM returns no tool calls, response text is streamed as final answer. |

## Tool Registry

All tool definitions live in `core/src/tools.ts` (13 tools). Built-in executors (4) also in core; server-dependent executors (9) in `server/src/index.ts`.

| Tool | Executor Location | Purpose |
|------|-------------------|---------|
| `web_search` | Core (built-in) | Searches the web via search API |
| `webfetch` | Core (built-in) | Fetches URL content, strips HTML |
| `verify_citation` | Core (built-in) | LLM verdict on whether source supports claim |
| `render_blocks` | Core (built-in) | Returns `output.blocks` for rich rendering |
| `get_article` | Server | Fetches article by slug, returns blocks |
| `create_article` | Server | Queues full article generation |
| `article_search` | Server | Searches articles by query |
| `get_map` | Server | Fetches map by slug, returns `map_2d` block |
| `generate_image` | Server | DALL-E image generation via `imageGen.ts` |
| `suggest_related` | Server | Returns outgoing + incoming graph edges |
| `task` | Server | Delegates to sub-agent with limited tool set |
| `mem_store` | Server | Stores key-value preference in MongoDB `Memory` model |
| `mem_recall` | Server | Recalls stored key-value preference |

## Pipeline Phases (Article Generation)

The article generation pipeline has 8 sequential phases, each streaming real-time event data:

| Phase | Duration | Purpose |
|-------|----------|---------|
| Research | 30-90s | Web search, fact extraction |
| Outline | 15-30s | Structure sections, categories |
| Write | 60-120s | Full article generation |
| Verify | 15-30s | Cross-check citations, flag issues |
| Correct | 15-30s | Apply fixes if confidence < 80% |
| Media | 20-40s | DALL-E prompts, diagram code |
| Images | 10-30s | Generate DALL-E images (if required) |
| Store | 2-5s | Persist to MongoDB + git commit |

## Concurrency

- In-memory job queue (survives restarts via MongoDB backup)
- Worker pool for parallel article generation (max 3 concurrent)
- Session pool limits (max 5 concurrent OpenCode sessions)
- SSE connection cap (100 concurrent)

## Security

- API key authentication on all endpoints
- Rate limiting (20 req/min per IP, 100 req/min per key)
- Zod input validation on all routes
- Mongoose schemas for data validation and injection prevention
- Sanitized error responses
- Configurable CORS per tenant

## Quick Start (Local)

```bash
npm install
npm run dev
```

## Environment Variables

- `FIRECRAWL_API_KEY` — for web search during research
- `OPENAI_API_KEY` — for DALL-E image generation (Milestone 3)
- `OPENCODE_SERVER_URL` — OpenCode server URL (default: http://localhost:4096)
- `NEXT_PUBLIC_API_URL` — API URL for frontend (default: http://localhost:4097)
- `CORS_ORIGIN` — Allowed origin for API CORS (e.g., https://truthseeker-web.vercel.app)

## Data Flow

1. User requests article via web UI or CLI
2. Request enters async queue
3. Agent pipeline (Research → Outline → Write → Verify → Correct → Media → 3D Model → Store) runs per article
4. Article stored in SQLite + committed to git
5. Web UI SSE streams both phase progress & real-time agent activity (tool calls, search results, text deltas)

## Streaming Transparency

Each pipeline phase streams granular agent activity to the frontend in real-time:

- **Server side:** `sendPromptStream` in `agent.ts` uses `promptAsync` + `/session/{id}/events` SSE to capture tool calls, search results, and text deltas. Falls back to message polling if SSE unavailable.
- **Queue bridge:** `emitAgentEvent()` / `subscribeAgentEvents()` pass events through the queue's subscriber system.
- **Frontend:** `ProcessViewer` component renders a live, auto-scrolling panel showing tool use cards, result snippets, and text deltas per phase.
- **SSE events:** Endpoint `/articles/:slug/progress` emits both `progress` (phase changes) and `agent_event` (granular tool activity) events.

## Frontend Components

- **PageLayout** — universal layout with SharedHeader + footer (all pages)
- **SharedHeader** — search, generate button, nav links
- **GenerationBar** — expandable progress bar with phase timeline + `ProcessViewer`
- **ProcessViewer** — collapsible panel showing live tool_use, tool_result, text, and status events
- **CardSkeleton/CardGridSkeleton** — shimmer loading skeletons
- **ThreeDMapViewer** — React Three Fiber 3D map viewer (terrain, buildings, annotations)
- **MapViewer** — Leaflet-based 2D interactive map
- **InteractiveTimeline** — timeline visualization component
- **MermaidDiagram** — Mermaid.js diagram renderer
