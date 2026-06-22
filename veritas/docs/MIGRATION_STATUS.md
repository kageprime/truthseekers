# VERITAS Migration Status & Roadmap

**Date:** June 2026
**Status:** Phase 2 (Implementation) Completed

This document outlines the work completed during the architectural migration from the TypeScript/Mongoose stack (`packages/core`, `packages/server`) to the new Go/Python stack (`veritas/`), and sets the roadmap for the next phases.

> **Correction (June 2026):** An earlier version of this document stated the Go storage layer uses PostgreSQL via `database/sql`. That is **not accurate** — the live Go code uses **MongoDB via `go.mongodb.org/mongo-driver`** (see `go.mod` and `internal/storage/db.go`). `storage/schema.sql` and the Postgres service in `docker-compose.yml` are scaffolded but **not wired into the Go server**. The PostgreSQL migration is a future phase (see §2, Phase 6).

---

## 1. What Has Been Completed

### 1.1 Architectural Design & Documentation
- **[VERITAS V1.3 System Design](VERITAS_V1.3_System_Design.md):** Documented the core identity, Claim Graph data model, and orchestration architecture.
- **[Epistemic Layer Contract](Epistemic_Layer_Contract.md):** Detailed the strict requirements for truth-seeking LLM nodes (claim extraction, critique, and resolution).

### 1.2 Data Persistence (MongoDB)
- **Driver:** The Go storage adapter (`internal/storage/db.go`) uses `go.mongodb.org/mongo-driver` (the only runtime DB dependency — see `go.mod`). It is a near-straight port of the old Mongoose models (`Article`, `GraphEdge`, `MapEntry`, `Job`, `User`, `Conversation`, `MemoryEntry`, …), preserving the same JSON field names so the Next.js frontend needs no changes.
- **Mock mode:** If `MOONGOSE_CONNECTION_STRING` is unset or the connection fails, `NewDB` returns an in-memory mock that serves hardcoded articles and stores conversations/users in maps — enabling zero-infrastructure local development.
- **Known hardening items (pending):** the database name is hardcoded to `"test"` (`db.go`); the connection-string env var retains the legacy `MOONGOSE_CONNECTION_STRING` typo; collection indexes are not yet created in `NewDB`.
- **PostgreSQL (future):** `storage/schema.sql` and the Postgres service in `docker-compose.yml` are scaffolded (with Claim Graph tables for `claims`, `evidence`, `sources`, and epistemic logs) but are **not** wired into the Go server. Migrating from MongoDB to PostgreSQL is Phase 6.

### 1.3 Orchestration & Execution (Go)
- **DAG Engine:** Implemented a robust Directed Acyclic Graph orchestrator (`internal/dag/engine.go`) featuring Kahn's cycle detection, concurrent goroutines with `sync.RWMutex`, exponential backoff retries, and channel-based progress streaming.
- **Python Bridge:** Developed `internal/nodes/executors.go` which spawns Python subprocesses and exchanges strongly-typed JSON over STDIN/STDOUT. Includes a mock-data fallback system if Python is unavailable, ensuring development isn't blocked.
- **API Gateway:** Rebuilt the `packages/server` Hono API entirely in Go (`internal/api/server.go`), carefully preserving exact routes and JSON schemas so the existing Next.js frontend (`packages/web`) requires zero modifications.

### 1.4 Epistemic Reasoning Workers (Python)
- **Core Nodes:** Built out the independent, stateless Python scripts that execute the truth-seeking pipeline:
  - `retrieve.py`: Information retrieval and categorization.
  - `extract_claims.py`: Parsing text into atomic claims.
  - `map_evidence.py`: Linking claims to supporting/contradicting sources.
  - `critique.py`: Evaluating factual consistency and source reliability.
  - `detect_missing.py`: Identifying "dogs that didn't bark" (missing expected evidence).
  - `map_language.py`: Stripping bias and framing from language.
  - `scrutinize.py`: Evaluating single-source or extraordinary claims.
  - `resolve.py`: Final confidence scoring.
  - `generate_article.py`: Final article synthesis.

---

## 2. The Plan Ahead (Next Steps)

With the foundational code and architecture complete, we are ready to move from implementation to integration, testing, and eventual cutover.

### Phase 3: Infrastructure & Environment Setup ✅ largely done
- **Dockerization:** `Dockerfile`s exist for the Go orchestrator (`veritas/Dockerfile`) and Next.js frontend (`packages/web/Dockerfile`). `docker-compose.yml` wires up Postgres + Go backend (:4097) + Next.js frontend (:3000); the `Makefile` wraps `up/down/build/logs`. ⚠️ The compose stack points the backend at `DATABASE_URL` (Postgres), but the Go server reads `MOONGOSE_CONNECTION_STRING` (Mongo) — these are inconsistent until Phase 6 lands.
- **Environment Configuration:** `.env.example` documents the Go/Python env vars. Production secret management is still pending.

### Phase 4: Frontend Integration & End-to-End Validation
- **API Contract Verification:** Verify all routes (`/articles`, `/chat`, progress SSE streams) correctly feed the Next.js components (`ProcessViewer`, `GenerationBar`). ⚠️ Known gaps: `/maps`, `/admin/settings`, and `/stripe/*` sub-routes are not yet implemented in Go and will 404; the `quota` response is missing the `remaining` field; onboarding is not persisted. These are tracked as Phase B work.
- **Wire the real generate path:** `handleGenerateArticle` → `processArticleStub` currently sleeps through phases and writes mock blocks. Wire it to the real DAG engine + Python nodes and stream `ProgressUpdate`s over SSE.

### Phase 5: Epistemic Tuning & Real-World Testing
- **LLM Connectivity:** Ensure Python workers are successfully calling the LLM endpoints via `llm/client.py`.
- **Quality Assurance:** Run the pipeline against a complex, controversial topic (e.g., JFK Assassination) to evaluate the strictness of the `critique` and `resolve` nodes.
- **Latency Optimization:** Profile the Python subprocess startup times and Go goroutine concurrency.

### Phase 6: Storage Migration to PostgreSQL & Old-Code Deprecation
- **Storage migration:** Port `internal/storage/db.go` from the MongoDB driver to `database/sql` + the existing `storage/schema.sql`, including Claim Graph tables (`claims`, `evidence`, `sources`, epistemic logs). Reconcile `docker-compose.yml`/`.env.example` (`DATABASE_URL`) with what the Go server actually reads.
- **Data migration scripts:** If necessary, write a script to port existing MongoDB records into the new PostgreSQL schema.
- **Deprecation:** Retire and delete `packages/server` and the legacy portions of `packages/core` (the frontend's runtime dependency on `@encarta/core` — `articleToBlocks` and the TS types — must be preserved or relocated first).
- **Production Deployment:** Deploy the Go binary, Next.js static site, and database to production (e.g., Fly.io and Vercel).
