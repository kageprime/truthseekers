# Encarta-Me

An LLM-powered interactive encyclopedia SDK — build your own AI agent-driven knowledge base.

## Architecture

- Monorepo with npm workspaces
- Agent loop via `@opencode-ai/sdk` (OpenCode server)
- TypeScript throughout
- SQLite for serving, git for version history
- Next.js web frontend

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| @encarta-me/sdk | packages/core | B2B SDK — agent client, pipeline, queue, types |
| @encarta-me/storage | packages/storage | SQLite DB, git versioning, vector index |
| @encarta-me/server | packages/server | Hono API server (reference implementation) |
| @encarta-me/web | packages/web | Next.js demo app |
| @encarta-me/cli | packages/cli | Admin CLI (seed, generate) |

## B2B SDK Positioning

Encarta-Me is an SDK for building AI-powered encyclopedias. Third parties integrate the SDK to create their own agentic knowledge bases. The web app and API server are reference implementations showing what the SDK can do.

## Concurrency

- SQLite-backed persistent job queue (survives restarts)
- Worker pool for parallel article generation
- Session pool limits (max 5 concurrent OpenCode sessions)
- SSE connection cap (100 concurrent)

## Security

- API key authentication on all endpoints
- Rate limiting (20 req/min per IP, 100 req/min per key)
- Zod input validation on all routes
- Parameterized SQL queries (no injection)
- Sanitized error responses
- Configurable CORS per tenant

## Quick Start

```bash
npm install
npm run dev
```

## Environment Variables

- `FIRECRAWL_API_KEY` — for web search during research
- `OPENAI_API_KEY` — for DALL-E image generation (Milestone 3)
- `OPENCODE_SERVER_URL` — OpenCode server URL (default: http://localhost:4096)

## Data Flow

1. User requests article via web UI or CLI
2. Request enters async queue
3. Agent pipeline (Research → Write → Store) runs per article
4. Article stored in SQLite + committed to git
5. Web UI polls/SSE for progress, serves article when ready
