# VERITAS Project Analysis & Strategic Roadmap

**Generated:** 2026-07-14  
**Scope:** Full-stack review of the Truthseekers (VERITAS) encyclopedia platform  
**Backend:** Go orchestrator (`veritas/go-orchestrator/`) — 58 `.go` files, 15 test files  
**Frontend:** Next.js 15 (`packages/web/`) — 112 `.ts/.tsx` files  

---

## 1. Executive Summary

VERITAS is a sophisticated LLM-powered epistemic encyclopedia with a **mature Go backend** and a **rich Next.js frontend**. The architecture has successfully migrated from a legacy TS/Hono stack to a native Go pipeline. The epistemic reasoning engine (9-node DAG) is implemented entirely in Go, with real-time SSE streaming, JWT auth, IAM roles, credential hot-swapping, and a session lifecycle engine.

**The project is functional and impressive** — but has documentation drift, dead schema weight, and untapped potential in its epistemic data layer.

---

## 2. What's Working Well ✅

### 2.1 Backend Architecture
| Feature | Status | Notes |
|---------|--------|-------|
| **Native Go epistemic pipeline** | ✅ Live | 9-node DAG (`retrieve` → `generate_article`) via `SendPromptJSON` |
| **Session lifecycle engine** | ✅ Live | State machine with idempotency, backpressure, retry, dead-letter |
| **JWT authentication** | ✅ Live | Real HS256-signed tokens with `role` claim |
| **IAM authorization** | ✅ Live | 6 roles, action-level permissions, glob matching |
| **Executor gateway** | ✅ Live | Credential isolation, policy engine, audit sink |
| **LLM gateway** | ✅ Live | Model catalog, usage metering, unified completions proxy |
| **Credential hot-swap** | ✅ Live | `PATCH /v1/credentials` — no restart needed |
| **Rate limiting** | ✅ Live | Per-IP token buckets (auth/chat/API tiers) |
| **SSE streaming** | ✅ Live | Article progress + chat agent events |
| **Registry auto-discovery** | ✅ Live | Filesystem scan of `veritas/registry/` |
| **Cron + webhook triggers** | ✅ Live | HMAC-verified webhooks, cron scheduler |
| **Agent tool loop** | ✅ Live | 25-iteration cap, concurrent execution, dedup cache, context trimming |
| **Mock mode** | ✅ Live | Zero-infrastructure local dev when DB is unreachable |
| **Graph edges** | ✅ Live | Populated from `Article.Crossrefs` on save |
| **Memory TTL** | ✅ Live | `expires_at` column with cleanup query |

### 2.2 Frontend
| Feature | Status | Notes |
|---------|--------|-------|
| **Article CRUD** | ✅ Wired | List, search, single view with block renderer |
| **Chat + streaming** | ✅ Wired | ReadableStream SSE parser, auto-scroll, tool event rendering |
| **Generation progress** | ✅ Wired | `GenerationBar` + `ProcessViewer` with phase timeline |
| **Model catalog** | ✅ Wired | Dynamic model selector from `/v1/llm/models` |
| **Admin dashboard** | ✅ Wired | Credentials, connectors, usage stats, settings |
| **Maps** | ✅ Wired | Leaflet 2D + React Three Fiber 3D |
| **Auth (login/me/onboard)** | ✅ Wired | Cookie-based JWT, onboarding persistence |
| **Custom state management** | ✅ Live | `useSyncExternalStore` pub/sub — zero external deps |
| **3D map viewer** | ✅ Wired | `ThreeDMapViewer` with R3F |
| **Interactive timeline** | ✅ Wired | `InteractiveTimeline` component |
| **Mermaid diagrams** | ✅ Wired | `MermaidDiagram` renderer |

---

## 3. Critical Findings 🔍

### 3.1 Documentation Drift (High Priority)

**Both `AGENTS.md` and `MIGRATION_STATUS.md` incorrectly state the storage layer uses MongoDB.**

- **Reality:** The Go backend uses **PostgreSQL** via `database/sql` + `lib/pq`
- **Evidence:** `go.mod` only lists `github.com/lib/pq` (no mongo driver). `internal/storage/db.go` uses `sql.DB`, `sql.NullFloat64`, `sql.NullString`, and Postgres-specific `ON CONFLICT` clauses.
- **Impact:** Onboarding confusion, `docker-compose.yml` inconsistency, misleading architecture docs.
- **Action:** Update both documents. Remove MongoDB references. Align `docker-compose.yml` env vars (`DATABASE_URL` vs `MOONGOSE_CONNECTION_STRING` typo).

### 3.2 The Epistemic Data Layer Is Write-Only

The schema defines 7 rich epistemic tables (`claims`, `sources`, `evidence`, `evidence_gaps`, `language_flags`, `scrutiny_assessments`, `article_claims`) but **the Go pipeline stores nothing in them**. The entire DAG is ephemeral — only the final `articles` row persists.

**What this means:**
- No audit trail of how an article's claims were resolved
- No cross-article claim reuse (e.g., "moon landing" claim shared across 5 articles)
- No evidence gap tracking over time
- No way to show readers *why* the encyclopedia scored a claim as "disputed"

This is the **single biggest missed opportunity** in the codebase. The epistemic schema is beautifully designed but unpopulated.

### 3.3 Dead Code Analysis is Partially Stale

The `DEAD_CODE_ANALYSIS.md` (July 14) lists several issues that have **already been fixed**:
- `GetTopArticles` — **FIXED**: now joins `article_views` and sorts by view count (`db.go:906-948`)
- `graph_edges` population — **FIXED**: `SaveArticle` now populates from `Crossrefs` (`db.go:701-722`)
- `MemStore` TTL — **FIXED**: `expires_at` column and `MemDeleteExpired` exist (`db.go:516-558`)

**Still valid issues:**
- `Article.Blocks` column is never written (frontend uses `articleToBlocks` at runtime)
- `User.Avatar` stored but never used
- `SiteSetting` struct defined but unused
- No database migration system (`schema.sql` is reference-only)
- 7 epistemic tables are orphaned

### 3.4 Secrets & Artifacts in Repo

| File | Risk |
|------|------|
| `packages/web/.env.local` | **Secrets committed** |
| `packages/web/Client ID` | **OAuth secret committed** |
| `veritas/go-orchestrator/server.exe` | Binary artifact |
| `veritas/go-orchestrator/server_test.exe` | Binary artifact |
| `packages/web/tsconfig.tsbuildinfo` | Build artifact |
| `veritas/go-orchestrator/agent_trace.log` | Log file |

---

## 4. Suggestions — Tactical Fixes

### 4.1 Immediate (This Week)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **Fix docs**: Replace MongoDB references with PostgreSQL in `AGENTS.md` and `MIGRATION_STATUS.md` | 30 min | High |
| 2 | **Add `.gitignore`**: Exclude `.env.local`, `*.exe`, `*.log`, `tsbuildinfo` | 15 min | High |
| 3 | **Rotate secrets**: The committed `.env.local` and `Client ID` are compromised — rotate API keys | 1 hr | Critical |
| 4 | **Update `DEAD_CODE_ANALYSIS.md`**: Mark fixed items (GetTopArticles, graph_edges, Mem TTL) | 30 min | Medium |
| 5 | **Install Go**: The workspace has no `go` command — tests can't run. Add to PATH or use `winget install Go` | 10 min | High |

### 4.2 Short-Term (This Month)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 6 | **Add migration system**: Adopt `golang-migrate/migrate` or `pressly/goose`. Version `schema.sql` as `001_initial.up.sql` | 4 hrs | High |
| 7 | **Fix `User.Avatar`**: Either drop the column or add Gravatar integration (`https://www.gravatar.com/avatar/{md5(email)}`) | 2 hrs | Low |
| 8 | **Drop or populate `Article.Blocks`**: Either remove the unused JSONB column, or pre-compute blocks in `transformGeneratedArticle` so the DB serves render-ready data | 2 hrs | Medium |
| 9 | **Add composite indexes**: `(user_id, updated_at DESC)` on conversations, `(conversation_id, created_at)` on messages, GIN on `to_tsvector` for articles | 2 hrs | Medium |
| 10 | **Add `conversations.user_id` FK**: `REFERENCES users(id) ON DELETE SET NULL` | 1 hr | Low |

### 4.3 Medium-Term (Next 2 Months)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 11 | **Persist epistemic pipeline data**: Store DAG node outputs to `claims`, `evidence`, `sources`, `article_claims` tables. This unlocks the Claim Graph. | 2-3 weeks | **Massive** |
| 12 | **Build Claim Graph API**: `GET /articles/{slug}/claims` — return resolved claims with confidence vectors, evidence links, and gap annotations | 1 week | High |
| 13 | **Frontend: Claim Graph viewer**: Interactive D3/Canvas visualization showing claims → evidence → sources, with confidence coloring | 1 week | High |
| 14 | **Article freshness cron**: Compute staleness scores, flag articles needing refresh based on evidence age or new web results | 3 days | Medium |
| 15 | **Add PostgreSQL to docker-compose**: Wire `DATABASE_URL` into the Go server, remove the MongoDB service or rename it | 1 day | Medium |

---

## 5. Brainstorms — Strategic Directions 🧠

### 5.1 The "Transparent Encyclopedia" Differentiator

**The core insight:** Most LLM encyclopedias (Perplexity, ChatGPT) give you an answer. VERITAS has the *machinery* to show its work — but doesn't expose it.

**Idea: Claim Transparency Mode**
- Every paragraph in an article gets hoverable "provenance chips"
- Hover → see the claim ID, confidence vector, supporting/contradicting evidence
- Click → open a sidebar showing the full epistemic chain: source → extraction → critique → resolution
- This is **unprecedented in consumer AI products**. It turns VERITAS from "another AI wiki" into "the only encyclopedia that shows you *why* it believes what it believes."

**Implementation path:**
1. Persist epistemic data (Task 11)
2. Add `claim_id` anchors to generated article sections (modify `generate_article` prompt)
3. Build `ClaimPopover` React component
4. API: `GET /articles/{slug}/claims/{claim_id}`

### 5.2 Cross-Article Claim Deduction

**Observation:** The `claims` table has no article-scoping. A claim like "The CIA operated Project MKUltra" could appear in 20 articles.

**Idea: Global Claim Graph**
- When generating an article, the `extract_claims` node first queries the global claims DB for existing claims on this topic
- Existing claims are *re-evaluated* with new evidence, not re-created
- The graph becomes a living knowledge base, not just a per-article pipeline
- Articles become **views** onto the claim graph, not isolated documents

**Database change:** Add `global_claim_id` to `claims` table. Implement claim similarity search (embeddings or trigram index).

### 5.3 Evidence Gap as a Feature

**Current behavior:** `detect_missing` node finds gaps, but they disappear after generation.

**Idea: "Open Questions" Dashboard**
- Persist evidence gaps with severity scores
- Public page: `/gaps` showing top unresolved gaps across all articles
- Community signal: readers can "upvote" a gap or submit new evidence
- Turns VERITAS into a **crowd-assisted investigation platform** — like Wikipedia's "citation needed" but structured and AI-detected

### 5.4 Real-Time Article Refresh

**Current behavior:** Articles are generated once. Freshness is never computed.

**Idea: Living Articles**
- Cron job (or webhook-triggered) re-runs `retrieve` + `critique` on published articles
- If new web evidence contradicts existing claims, flag article for refresh
- Frontend shows "Last verified: 3 days ago" with traffic-light freshness indicator
- Subscription: "Notify me when this article's confidence score changes"

### 5.5 The Epistemic API as a Product

**Observation:** The pipeline is hardcoded for encyclopedia articles, but the 9-node epistemic engine is domain-agnostic.

**Idea: Veritas Engine SaaS**
- Expose the DAG as a generic API: `POST /v1/analyze` with any topic
- Returns: claims, evidence map, critique, confidence scores — but *no article*
- Use cases: due diligence, legal discovery, journalism, academic literature review
- Pricing: per-node execution cost + LLM usage

### 5.6 DSML as a Standard

**Observation:** The project has a custom DSML (Document Structure Markup Language) for rich blocks.

**Idea: Open DSML Specification**
- Document the DSML schema (`heading`, `text`, `timeline`, `map_2d`, etc.)
- Publish `@encarta/dsml` as an npm package with parser + validator
- Other projects could render VERITAS articles, or produce DSML-compatible content
- Positions the project as building **infrastructure**, not just an app

### 5.7 Structured Debate Mode

**Idea: Dissenting Perspectives UI**
- The `generate_article` prompt already asks for `dissenting_perspectives`
- Build a toggle: "Show consensus view" ↔ "Show all perspectives"
- In "all perspectives" mode, display claims grouped by `status` (`supported` / `disputed` / `weak`)
- Color-code paragraphs by confidence level
- Add a "debate view": side-by-side comparison of contradictory claims with evidence

### 5.8 Agent Memory as User Profiles

**Observation:** `mem_store`/`mem_recall` exist but are primitive key-value.

**Idea: Epistemic User Model**
- Store not just preferences, but the user's *epistemic stance* — what sources they trust, topics they've researched, claims they've challenged
- The chat agent can reference this: "You've previously questioned claims from Source X; here's an alternative analysis."
- Privacy-preserving: user model stays server-side, exportable/deletable

---

## 6. Technical Debt Register

| Debt Item | Severity | Current Cost | Payoff if Fixed |
|-----------|----------|--------------|-----------------|
| No DB migrations | 🔴 High | Schema changes are manual, error-prone | Deploy confidence, team scaling |
| Orphaned epistemic schema | 🔴 High | Beautiful data model generating no value | Transparency features, user trust, differentiation |
| Secrets in git history | 🔴 High | Security exposure | Compliance, safe open-sourcing |
| Docs say MongoDB, code says Postgres | 🟡 Medium | Onboarding confusion, bad decisions | Accurate architecture decisions |
| `Article.Blocks` unused column | 🟢 Low | Minor storage waste | Cleaner schema |
| No Go on build machine | 🟡 Medium | Can't run tests in CI/dev | Quality assurance |
| Python bridge referenced in docs but removed | 🟢 Low | Confusing architecture docs | Accurate docs |
| Dead code analysis partially stale | 🟢 Low | Wasted review time on fixed issues | Focus on real problems |

---

## 7. Recommended Next Steps (Priority Order)

1. **🔐 Security first**: Rotate committed secrets, add `.gitignore`, purge from git history (`git filter-repo` or BFG)
2. **📝 Fix docs**: Update `AGENTS.md`, `MIGRATION_STATUS.md`, `DEAD_CODE_ANALYSIS.md` to reflect PostgreSQL reality
3. **🧪 Enable testing**: Install Go, run `go test ./...`, add CI workflow (GitHub Actions)
4. **🏗️ Migrations**: Add `golang-migrate`, create `migrations/` directory, seed initial schema
5. **🧠 Persist epistemic data**: Modify `processArticle` to store DAG outputs to the 7 epistemic tables
6. **✨ Build Claim Graph UI**: Once data persists, build the transparency features that differentiate VERITAS

---

## 8. Project Health Score

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Architecture** | 9/10 | Clean Go packages, proper separation of concerns, sophisticated patterns |
| **Feature Completeness** | 7/10 | Core loop works, but epistemic data layer is dormant, some stubs remain |
| **Code Quality** | 8/10 | Well-commented, good error handling, concurrent-safe, tests exist |
| **Documentation** | 4/10 | Significant drift between docs and code (MongoDB vs Postgres, Python vs Go) |
| **Security** | 5/10 | JWT is real, but secrets committed, no input validation tags enforced, no DB FKs |
| **Frontend Polish** | 8/10 | Rich components, good UX patterns, SSE streaming, responsive design |
| **Differentiation** | 6/10 | Pipeline is unique, but the *user-visible* epistemic features are hidden |

**Overall: 6.7/10** — A strong technical foundation with significant untapped potential. The gap between what's built and what's exposed to users is the primary opportunity.

---

*End of Analysis*
