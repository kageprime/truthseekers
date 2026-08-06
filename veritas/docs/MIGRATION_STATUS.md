# VERITAS Migration Status & Roadmap

**Date:** July 2026  
**Status:** Phase 3 (Global Claim Graph) Completed. Phase 0 (Foundation Hardening) Done.  

This document outlines the work completed during the architectural migration from the TypeScript/Mongoose stack (`packages/core`, `packages/server`) to the new Go architecture under `veritas/`, and sets the roadmap for the next phases.

> **Correction (July 2026):** Earlier versions of this document incorrectly stated the Go storage layer uses MongoDB via `go.mongodb.org/mongo-driver`. The live Go code has **always** used **PostgreSQL via `database/sql` + `lib/pq`** (confirmed by `go.mod` and `internal/storage/db.go`). The `MOONGOSE_CONNECTION_STRING` environment variable name was a legacy typo; the server actually reads `DATABASE_URL`. The live schema applies via `migrations/001_initial_schema.sql`, and `schema.sql` is a reference-only port from the legacy Mongoose models.

---

## 1. What Has Been Completed

### 1.1 Architectural Design & Documentation
- **[VERITAS V1.3 System Design](VERITAS_V1.3_System_Design.md):** Documented the core identity, Claim Graph data model, and orchestration architecture.
- **[Epistemic Layer Contract](Epistemic_Layer_Contract.md):** Detailed the strict requirements for truth-seeking LLM nodes (claim extraction, critique, and resolution).

### 1.2 Data Persistence (PostgreSQL)
- **Driver:** The Go storage adapter (`internal/storage/db.go`) uses `database/sql` with `github.com/lib/pq` (the only runtime DB dependency — see `go.mod`). The schema (`storage/schema.sql`) defines all tables including the full epistemic layer (`claims`, `evidence`, `sources`, `evidence_gaps`, `language_flags`, `scrutiny_assessments`).
- **Mock mode:** If `DATABASE_URL` is unset or the connection fails, `NewDB` returns an in-memory mock that serves hardcoded articles and stores conversations/users in maps — enabling zero-infrastructure local development.
- **Migrations:** Automated on boot via `internal/storage/migrate.go` + numbered SQL files in `migrations/` (`001_initial_schema.sql`).

### 1.3 Orchestration & Execution (Go)
- **DAG Engine:** Implemented a robust Directed Acyclic Graph orchestrator (`internal/dag/engine.go`) featuring Kahn's cycle detection, concurrent goroutines with `sync.RWMutex`, exponential backoff retries, and channel-based progress streaming.
- **API Gateway:** Rebuilt the `packages/server` Hono API entirely in Go (`internal/api/server.go`), carefully preserving exact routes and JSON schemas so the existing Next.js frontend (`packages/web`) requires zero modifications.
- **Python Bridge:** The `internal/nodes/executors.go` Python subprocess bridge was **removed** during the Kortix adoption (see git history). The epistemic pipeline now runs entirely in native Go via `SendPromptJSON` (`internal/agent/pipeline.go`).

### 1.4 Epistemic Pipeline (Native Go)
- **Core Nodes:** All 9 nodes of the truth-seeking pipeline execute as native Go LLM calls:
  - `retrieve`: Information retrieval and categorization.
  - `extract_claims`: Parsing text into atomic claims.
  - `map_evidence`: Linking claims to supporting/contradicting sources.
  - `critique`: Evaluating factual consistency and source reliability.
  - `detect_missing`: Identifying "dogs that didn't bark" (missing expected evidence).
  - `map_language`: Stripping bias and framing from language.
  - `scrutinize`: Evaluating single-source or extraordinary claims.
  - `resolve`: Final confidence scoring.
  - `generate_article`: Final article synthesis.

> **Note:** Epistemic pipeline outputs (claims, evidence, gaps, language flags, scrutiny) are now persisted to PostgreSQL via `internal/storage/epistemic.go` and served through dedicated endpoints (`/articles/:slug/claims`, `/claims/:id/evidence`, `/articles/:slug/gaps`, `/contested`, `/gaps`, `/claim-graph`, `/articles/:slug/claim-graph`).

---

## 2. The Plan Ahead

### Phase 0: Foundation Hardening ✅ (CI/CD remaining)
- **Security:** ✅ Purge committed secrets, add `.gitignore` protections, rotate API keys.
- **Documentation:** ✅ Correct MongoDB/PostgreSQL drift in `AGENTS.md` and this file.
- **Migration system:** ✅ `internal/storage/migrate.go` + `migrations/001_initial_schema.sql`, automated on boot.
- **CI/CD:** ⏳ GitHub Actions workflow for `go test ./...` — not yet added.
- **Tooling:** ✅ Ensure Go is installed and available on all dev machines.

### Phase 1A: Epistemic Data Persistence ✅
- **Storage layer:** ✅ CRUD in `internal/storage/db.go` + `epistemic.go` for `claims`, `evidence`, `sources`, `evidence_gaps`, `language_flags`, `scrutiny_assessments`, `article_claims`.
- **Persistence hook:** ✅ DAG node outputs intercepted and persisted on generate/refresh.
- **Claim tracking:** ✅ `generate_article` emits claim anchors embedded in article text.
- **API additions:** ✅ `GET /articles/:slug/claims`, `GET /claims/:id/evidence`, `GET /articles/:slug/gaps`.

### Phase 1B: Claim Transparency Mode ✅
- **Frontend:** ✅ `ProvenanceChip` and `ClaimPopover` components. Parse `[claim:xxx]` anchors in article content.
- **UX:** ✅ Hover over a chip → see claim status, confidence vector, evidence list, and a 6-axis `ConfidenceRadar`.

### Phase 2: Global Claim Graph ✅ (claim-level graph + relationships delivered)
- **Deduplication:** ✅ Claim signature hashing for cross-article claim merging (`GetClaimBySignature` wired in `generate.go`, works in file mode too).
- **Claim relationships:** ✅ The `resolve` node now emits `claim_relationships` (supports/contradicts/related) which are persisted (previously dead `SaveClaimRelationship`), surfacing typed claim→claim edges.
- **Graph API:** ✅ `GET /articles/:slug/claim-graph` returns claim/evidence nodes + typed edges (claim-level, distinct from the article crossref `/graph`).
- **Visualization:** ✅ Frontend `ClaimGraphViewer` (dependency-free canvas force-directed layout) on the article page + `ConfidenceRadar` in provenance chips.
- **Contested dashboard:** ✅ `GET /contested` + `/contested` page ranking disputed/weak claims by contradiction level.

### Phase 3: Living Articles & Open Questions ⏳
- **Freshness scoring:** ✅ Evidence age scoring; `GET /stale` ranks articles by freshness ascending; per-article `/articles/:slug/freshness` + `refresh-diff` endpoints.
- **Gap dashboard:** ✅ Public `/gaps` page with community upvote (`/gaps/:id/upvote`) and evidence submission (`/gaps/:id/submit`).
- **Auto-refresh cron:** ⏳ The `triggers` package ships a 60s-tick cron scheduler (5-field expressions) + HMAC webhooks, but a daily stale-article auto-reverify job is not wired.

### Phase 4: Engine SaaS & Ecosystem ⏳
- **API product:** `POST /v1/analyze` — generic epistemic analysis for any topic.
- **DSML standard:** Open specification for the block-based article format.
- **Developer portal:** API keys, usage metering, interactive playground.

---

## 3. Environment Variable Reference

| Variable | Status | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | ✅ Live | PostgreSQL connection string (e.g., `postgres://user:pass@localhost:5432/veritas`) |
| `PORT` | ✅ Live | Go API port (default `4097`) |
| `CORS_ORIGIN` | ✅ Live | Allowed CORS origin |
| `MODEL_ACCESS_KEY` | ✅ Live | DigitalOcean Inference API key |
| `GROQ_API_KEY` | ✅ Live | Groq API key |
| `OPENAI_API_KEY` | ✅ Live | OpenAI key (fallback for LLM gateway) |
| `FIRECRAWL_API_KEY` / `TAVILY_API_KEY` | ✅ Live | Web-search backend |
| `ENCARTA_IMAGE_DIR` | ✅ Live | Output dir for generated images |
| `NEXT_PUBLIC_API_URL` | ✅ Live | API URL for frontend |
| `MOONGOSE_CONNECTION_STRING` | ❌ Deprecated | Legacy typo — do not use. Use `DATABASE_URL`. |

---

## 4. Legacy Code Status

| Path | Status | Notes |
|------|--------|-------|
| `packages/server/` | ✅ Deleted | Old Hono API — fully replaced by Go |
| `packages/storage/` | ✅ Deleted | Old Mongoose models — fully replaced |
| `packages/cli/` | ✅ Deleted | Old admin CLI |
| `packages/core/` | 🟡 Partially retained | TS types + `articleToBlocks` still consumed by frontend |
| `veritas/go-orchestrator/internal/nodes/` | 🔴 Removed | Python subprocess bridge removed; pipeline is native Go |

---

*Last updated: 2026-08-06*
