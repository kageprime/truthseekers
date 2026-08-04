# VERITAS Strategic Roadmap: From Hidden Engine to Transparent Encyclopedia

**Version:** 1.0  
**Date:** 2026-07-14  
**Status:** Draft — Ready for Review  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 0: Foundation](#3-phase-0-foundation--week-1)
4. [Phase 1: The Engine Upgrade — Persist Epistemic Data](#4-phase-1-the-engine-upgrade--weeks-2-4)
5. [Phase 2: Claim Transparency Mode](#5-phase-2-claim-transparency-mode--weeks-5-6)
6. [Phase 3: Global Claim Graph](#6-phase-3-global-claim-graph--weeks-7-9)
7. [Phase 4: Living Articles](#7-phase-4-living-articles--weeks-10-11)
8. [Phase 5: Open Questions Dashboard](#8-phase-5-open-questions-dashboard--weeks-12-13)
9. [Phase 6: Veritas Engine SaaS](#9-phase-6-veritas-engine-saas--weeks-14-16)
10. [Phase 7: DSML Standard & Ecosystem](#10-phase-7-dsml-standard--ecosystem--week-17)
11. [Appendix A: File Maps](#appendix-a-file-maps)
12. [Appendix B: Schema Evolution](#appendix-b-schema-evolution)
13. [Appendix C: API Additions](#appendix-c-api-additions)

---

## 1. Executive Summary

This roadmap transforms VERITAS from a **functional AI encyclopedia** into the **world's first transparent epistemic platform** — where every factual assertion is traceable, every claim is auditable, and every article is a living document.

### The Central Thesis

The 9-node epistemic DAG (`retrieve` → `extract_claims` → `map_evidence` → `critique` → `detect_missing` → `map_language` → `scrutinize` → `resolve` → `generate_article`) produces **rich structured data** at every step. Currently, only the final `generate_article` output is persisted. The rest is ephemeral.

**Persisting this data unlocks every other feature in this roadmap.** Without it, we have no audit trail, no claim reuse, no transparency, no gap tracking.

### The Roadmap at a Glance

| Phase | Name | Duration | Key Deliverable | Business Value |
|-------|------|----------|-----------------|----------------|
| 0 | Foundation | 1 week | Secure, documented, migratable codebase | Team velocity, security |
| 1 | Engine Upgrade | 3 weeks | Epistemic data persisted to 7 tables | Audit trail, data asset |
| 2 | Transparency Mode | 2 weeks | Hoverable provenance chips on every paragraph | **Killer differentiator** |
| 3 | Global Claim Graph | 3 weeks | Cross-article claim deduplication & graph | Knowledge network effect |
| 4 | Living Articles | 2 weeks | Auto-refresh + freshness indicators | Recurring engagement |
| 5 | Open Questions | 2 weeks | Public gap dashboard + crowd signals | Community & UGC |
| 6 | Engine SaaS | 3 weeks | `POST /v1/analyze` API product | New revenue stream |
| 7 | DSML Standard | 1 week | Open specification + npm package | Ecosystem & thought leadership |

**Total timeline: ~17 weeks (4 months) for full vision.**

---

## 2. Architecture Overview

### Current Data Flow (Ephemeral)

```
User Request
     ↓
[Session Engine] queues job
     ↓
[DAG Engine] executes 9 nodes in parallel/sequence
     ↓
Node outputs flow through channels (in-memory only)
     ↓
[generate_article] produces {article: {...}}
     ↓
[transformGeneratedArticle] → storage.Article
     ↓
[SaveArticle] → INSERT INTO articles (...)
     ↓
Done. All intermediate data lost.
```

### Target Data Flow (Persistent Epistemic Layer)

```
User Request
     ↓
[Session Engine] queues job
     ↓
[DAG Engine] executes 9 nodes
     ↓
┌─────────────────────────────────────────────────────────┐
│  EPISTEMIC PERSISTENCE HOOK (new — runs after each node) │
│  • retrieve        → documents (for now, ephemeral)       │
│  • extract_claims  → INSERT INTO claims                   │
│  • map_evidence    → INSERT INTO evidence                 │
│  • critique        → INSERT INTO scrutiny_assessments     │
│  • detect_missing  → INSERT INTO evidence_gaps            │
│  • map_language    → INSERT INTO language_flags           │
│  • scrutinize      → INSERT INTO scrutiny_assessments     │
│  • resolve         → UPDATE claims SET confidence_vector  │
│  • generate_article→ INSERT INTO articles                  │
│                      + INSERT INTO article_claims          │
└─────────────────────────────────────────────────────────┘
     ↓
[Claim Graph API] serves claims/evidence/gaps per article
     ↓
[Frontend] renders article + provenance chips + graph viz
```

### Where Each Feature Fits

```
┌──────────────────────────────────────────────────────────────────────┐
│                         VERITAS ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────┤
│  FRONTEND (Next.js 15)                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ Article View │ │ Claim Popover│ │  Gap Board   │ │  Graph Viz   ││
│  │ + Prov.Chips │ │  (Phase 2)   │ │  (Phase 5)   │ │  (Phase 3)   ││
│  │   Phase 2    │ │              │ │              │ │              ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│  │Living Article│ │   DSML SDK   │ │ Engine SaaS  │                  │
│  │   Phase 4    │ │   Phase 7    │ │   Phase 6    │                  │
│  └──────────────┘ └──────────────┘ └──────────────┘                  │
├──────────────────────────────────────────────────────────────────────┤
│  API GATEWAY (Go)                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │  /articles   │ │/articles/{s} │ │   /claims    │ │  /analyze    ││
│  │   CRUD       │ │ /claims      │ │   /gaps      │ │   (SaaS)     ││
│  │              │ │  Phase 2     │ │   Phase 5    │ │   Phase 6    ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│  │   /chat      │ │  /webhook    │ │/v1/llm/*    │                  │
│  │  streaming   │ │   triggers   │ │   gateway   │                  │
│  └──────────────┘ └──────────────┘ └──────────────┘                  │
├──────────────────────────────────────────────────────────────────────┤
│  ORCHESTRATION LAYER (Go)                                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  DAG Engine  ←──  Epistemic Persistence Hook  (Phase 1)        │  │
│  │  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐         │  │
│  │  │retrieve│───→│extract │───→│  map   │───→│critique│         │  │
│  │  │        │    │claims  │    │evidence│    │        │         │  │
│  │  └────────┘    └────────┘    └────────┘    └────────┘         │  │
│  │       ↓            ↓              ↓            ↓               │  │
│  │  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐         │  │
│  │  │detect  │    │map     │    │scruti- │───→│resolve │         │  │
│  │  │missing │    │language│    │nize    │    │        │         │  │
│  │  └────────┘    └────────┘    └────────┘    └────────┘         │  │
│  │                     ↓                         ↓                │  │
│  │              ┌──────────────────────────────────┐             │  │
│  │              │        generate_article          │             │  │
│  │              └──────────────────────────────────┘             │  │
│  └────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  STORAGE (PostgreSQL)                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │articles│ │ claims │ │evidence│ │ sources│ │  gaps  │ │scrutiny│  │
│  │        │ │        │ │        │ │        │ │        │ │        │  │
│  │article_│ │language│ │ graph_ │ │  jobs  │ │  maps  │ │  users │  │
│  │claims  │ │_flags  │ │_edges  │ │        │ │        │ │        │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 0: Foundation (~ Week 1)

> *"You can't build a cathedral on a swamp."*

### 3.1 Security: Purge Committed Secrets

**Problem:** `.env.local` and `Client ID` contain live secrets in git history.

**Files to modify:**
- `.gitignore` — add patterns
- Git history — purge with BFG or `git filter-repo`

```bash
# .gitignore additions
packages/web/.env.local
packages/web/Client ID
*.exe
*.log
*.tsbuildinfo
veritas/go-orchestrator/agent_trace.log
veritas/go-orchestrator/server.exe
veritas/go-orchestrator/server_test.exe
```

**Steps:**
1. Rotate all API keys in `.env.local` (Groq, DigitalOcean, Tavily, Firecrawl)
2. Rotate the OAuth Client ID
3. Purge from git history:
   ```bash
   git filter-repo --path packages/web/.env.local --invert-paths
   git filter-repo --path 'packages/web/Client ID' --invert-paths
   ```
4. Force-push to remote (coordinate with team)
5. Add `.env.local.example` with placeholder values as a template

**Effort:** 1 day  
**Risk:** High — coordinate to avoid disrupting other devs  
**Owner:** DevOps / Security lead

---

### 3.2 Documentation: Align with Reality

**Problem:** `AGENTS.md` and `MIGRATION_STATUS.md` incorrectly state MongoDB.

**Files to modify:**
- `AGENTS.md` — replace all MongoDB references with PostgreSQL
- `veritas/docs/MIGRATION_STATUS.md` — same, plus update Phase 6 description
- `veritas/go-orchestrator/DEAD_CODE_ANALYSIS.md` — mark fixed items

**Key corrections:**
| Document | Current (Wrong) | Correct |
|----------|-----------------|---------|
| `AGENTS.md` | "MongoDB via go.mongodb.org/mongo-driver" | "PostgreSQL via database/sql + lib/pq" |
| `AGENTS.md` | "MOONGOSE_CONNECTION_STRING" | "DATABASE_URL (PostgreSQL connection string)" |
| `MIGRATION_STATUS.md` | "MongoDB driver… see go.mod" | "lib/pq in go.mod; no MongoDB dependency" |
| `MIGRATION_STATUS.md` | Phase 6: "Port from MongoDB to PostgreSQL" | Phase 6: "Wire docker-compose DATABASE_URL to Go server, add migrations" |

**Effort:** 1/2 day  
**Owner:** Any developer

---

### 3.3 Tooling: Install Go + Enable CI

**Problem:** `go` is not on PATH. Tests can't run.

**Steps:**
1. Install Go 1.22+ on the dev machine
2. Run `go test ./...` in `veritas/go-orchestrator/`
3. Fix any failing tests
4. Add GitHub Actions workflow (`.github/workflows/test.yml`):

```yaml
name: Test
on: [push, pull_request]
jobs:
  go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - run: cd veritas/go-orchestrator && go test ./...
```

**Effort:** 1/2 day  
**Owner:** Any developer

---

### 3.4 Database: Migration System

**Problem:** `schema.sql` is reference-only. No migration tooling.

**Decision:** Use `pressly/goose` (lightweight, Go-native, no dependencies).

**Steps:**
1. Add to `go.mod`:
   ```bash
   go get github.com/pressly/goose/v3
   ```
2. Create `veritas/go-orchestrator/migrations/` directory
3. Convert `schema.sql` into numbered migrations:
   ```
   migrations/
   ├── 001_initial_schema.sql      (current schema.sql contents)
   ├── 002_epistemic_indexes.sql   (GIN, composite indexes)
   └── 003_fk_constraints.sql      (conversations.user_id FK)
   ```
4. Add migration runner to `cmd/server/main.go` boot sequence:
   ```go
   // After DB connection, before route setup
   if err := goose.Up(db.DB(), "migrations"); err != nil {
       log.Fatalf("migration failed: %v", err)
   }
   ```
5. Add `make migrate` target to root `Makefile`

**Effort:** 1 day  
**Owner:** Backend lead

---

### Phase 0 Deliverables Checklist

- [ ] `.env.local` and `Client ID` purged from git history; keys rotated
- [ ] `.gitignore` updated with new patterns
- [ ] `AGENTS.md` corrected (MongoDB → PostgreSQL)
- [ ] `MIGRATION_STATUS.md` updated
- [ ] `DEAD_CODE_ANALYSIS.md` stale items marked fixed
- [ ] Go installed; `go test ./...` passes
- [ ] GitHub Actions CI workflow active
- [ ] `goose` migration system installed; `make migrate` works
- [ ] `docker-compose.yml` env vars aligned (`DATABASE_URL` used consistently)

---

## 4. Phase 1: The Engine Upgrade (~ Weeks 2-4)

> *"This is the load-bearing wall. Everything else hangs on it."*

### 4.1 The Core Problem

The 9-node DAG produces structured JSON at every step:
- `extract_claims` → `{claims: [{claim_id, text, source_doc_id, passage}]}`
- `map_evidence` → `{claim_evidence_map: [{claim_id, supporting, contradicting, missing_expected}]}`
- `critique` → `{evaluation: {factual_consistency, source_reliability, reasoning_validity}}`
- `detect_missing` → `{gaps: [{evidence_id, gap_type, expected_artifact, ...}]}`
- `map_language` → `{language_flags: [{claim_id, source_phrase, precision_upgrade, ...}]}`
- `scrutinize` → `{risk_assessments: [{claim_id, risk_factors, risk_score, ...}]}`
- `resolve` → `{resolved_claims: [{claim_id, status, confidence_vector, derived_confidence, provenance}]}`

**None of this is persisted.** We need to capture it.

### 4.2 Design: The Epistemic Persistence Hook

We introduce a **persistent DAG wrapper** that intercepts node outputs and writes them to the database. This is cleaner than modifying every node executor.

```go
// internal/epistemic/store.go — NEW FILE
package epistemic

import (
    "context"
    "encoding/json"
    "fmt"
    "github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

type Store struct {
    db *storage.DB
}

func NewStore(db *storage.DB) *Store { return &Store{db: db} }

// PersistNodeOutput is called by the DAG engine after each node completes.
// It routes the output to the appropriate storage method based on node ID.
func (s *Store) PersistNodeOutput(ctx context.Context, articleSlug string, nodeID string, output interface{}) error {
    raw, _ := json.Marshal(output)
    switch nodeID {
    case "extract_claims":
        return s.persistClaims(ctx, articleSlug, raw)
    case "map_evidence":
        return s.persistEvidence(ctx, raw)
    case "critique":
        return s.persistCritique(ctx, raw)
    case "detect_missing":
        return s.persistGaps(ctx, raw)
    case "map_language":
        return s.persistLanguageFlags(ctx, raw)
    case "scrutinize":
        return s.persistScrutiny(ctx, raw)
    case "resolve":
        return s.persistResolvedClaims(ctx, raw)
    default:
        return nil // retrieve, generate_article — no epistemic storage
    }
}
```

### 4.3 Schema Additions for Claim Tracking

The existing `schema.sql` has the tables but needs small additions:

```sql
-- Add article_id to claims for traceability (alternative: use article_claims junction)
-- We already have article_claims junction table — sufficient.

-- Add generation_run_id for tracking multiple generations of the same article
ALTER TABLE claims ADD COLUMN generation_run_id UUID;
ALTER TABLE evidence ADD COLUMN generation_run_id UUID;
ALTER TABLE evidence_gaps ADD COLUMN generation_run_id UUID;
ALTER TABLE scrutiny_assessments ADD COLUMN generation_run_id UUID;
ALTER TABLE language_flags ADD COLUMN generation_run_id UUID;

-- Index for efficient claim lookup by article
CREATE INDEX idx_article_claims_article ON article_claims(article_id);
CREATE INDEX idx_article_claims_claim ON article_claims(claim_id);

-- Index for claim text search
CREATE INDEX idx_claims_text_gin ON claims USING gin(to_tsvector('english', text));

-- Add slug reference to claims for direct lookup before article ID is known
ALTER TABLE claims ADD COLUMN article_slug TEXT;
CREATE INDEX idx_claims_slug ON claims(article_slug);
```

### 4.4 Files to Modify

| File | Change |
|------|--------|
| `internal/epistemic/store.go` | **NEW** — Persistence layer for DAG outputs |
| `internal/epistemic/types.go` | **NEW** — Typed structs for node outputs |
| `internal/storage/db.go` | Add `SaveClaim`, `SaveEvidence`, `SaveGap`, `SaveLanguageFlag`, `SaveScrutiny`, `LinkArticleClaim`, `GetClaimsByArticle`, `GetEvidenceByClaim`, `GetGapsByArticle` methods |
| `internal/api/generate.go` | Modify `processArticle` to instantiate `epistemic.Store` and call `PersistNodeOutput` after each DAG node completes |
| `internal/dag/engine.go` | Add optional `OnNodeComplete` callback to `Workflow` so callers can hook persistence without modifying the engine core |
| `migrations/004_epistemic_tracking.sql` | **NEW** — Schema additions for generation_run_id, indexes |

### 4.5 DAG Engine Callback Hook

Minimal change to `internal/dag/engine.go`:

```go
type Workflow struct {
    Nodes           []Node
    OnNodeComplete  func(nodeID string, output interface{}) // NEW: optional hook
}

// In Execute(), after node completes:
if err == nil {
    completed[n.ID] = output
    mu.Unlock()
    if w.OnNodeComplete != nil { // NEW
        w.OnNodeComplete(n.ID, output) // fire-and-forget; don't block
    }
    progressCh <- ProgressUpdate{...}
}
```

### 4.6 Wiring It Together

In `internal/api/generate.go`:

```go
func (s *Server) processArticle(slug string, persona string) {
    // ... existing setup ...
    
    epistemicStore := epistemic.NewStore(s.db)
    
    workflow := buildArticleWorkflow()
    workflow.OnNodeComplete = func(nodeID string, output interface{}) {
        if err := epistemicStore.PersistNodeOutput(ctx, slug, nodeID, output); err != nil {
            log.Printf("[epistemic] failed to persist %s: %v", nodeID, err)
            // Non-fatal: don't fail the article if persistence fails
        }
    }
    
    updates, err := workflow.Execute(ctx, string(queryJSON))
    // ... rest unchanged ...
}
```

### 4.7 Data Normalization Strategy

**Challenge:** Node outputs use `claim_id` as UUIDs generated by the LLM. We need stable IDs across generations.

**Solution:** Use the LLM-generated `claim_id` as the primary key. On re-generation of the same article, `INSERT … ON CONFLICT (id) DO UPDATE` will upsert claims. This naturally creates a claim history.

**For cross-article deduplication (Phase 3):** We'll add a `claim_signature` field (hash of normalized text) to detect identical claims across articles.

### 4.8 Testing Strategy

```go
// internal/epistemic/store_test.go
func TestPersistClaims(t *testing.T) {
    db := storage.NewTestDB(t)
    store := NewStore(db)
    
    output := map[string]interface{}{
        "claims": []map[string]interface{}{
            {"claim_id": "abc-123", "text": "The moon landing occurred in 1969", "type": "factual"},
        },
    }
    
    err := store.PersistNodeOutput(context.Background(), "moon-landing", "extract_claims", output)
    assert.NoError(t, err)
    
    claims, err := db.GetClaimsByArticle("moon-landing")
    assert.NoError(t, err)
    assert.Len(t, claims, 1)
    assert.Equal(t, "The moon landing occurred in 1969", claims[0].Text)
}
```

### Phase 1 Deliverables

- [ ] `internal/epistemic/` package with `store.go`, `types.go`, tests
- [ ] `internal/storage/db.go` extended with epistemic CRUD methods
- [ ] `internal/dag/engine.go` has `OnNodeComplete` callback
- [ ] `processArticle` persists all 7 node output types
- [ ] Migration `004_epistemic_tracking.sql` applied
- [ ] Integration test: generate an article, verify claims/evidence/gaps exist in DB

---

## 5. Phase 2: Claim Transparency Mode (~ Weeks 5-6)

> *"Show your work. No other AI product does."*

### 5.1 The User Experience

When reading any article, every paragraph gets **provenance chips** — small, subtle indicators showing the epistemic status of claims within.

**Visual Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ The Apollo 11 mission landed on the Moon on July 20, 1969.  │
│ [● supported] Buzz Aldrin and Neil Armstrong became the     │
│ first humans to walk on the lunar surface. [● supported]    │
│                                                             │
│ The mission was the culmination of the Space Race, [●       │
│ disputed] a competition between the United States and the    │
│ Soviet Union that some historians argue was primarily a     │
│ propaganda exercise. [○ weak]                               │
└─────────────────────────────────────────────────────────────┘
     ↑
  Hover over [● supported] → sidebar slides in:
  ┌────────────────────────────────────┐
  │ Claim #apollo-11-claim-3           │
  │ Status: supported                  │
  │ Confidence: 0.94                   │
  │ ─────────────────────────────────  │
  │ Evidence:                          │
  │ • NASA Mission Report (primary)    │
  │ • Armstrong radio transcript       │
  │ • Lunar Reconnaissance Orbiter     │
  │   imagery (corroboration)          │
  │ ─────────────────────────────────  │
  │ Confidence Vector:                 │
  │ • evidence_strength: 0.97 ▓▓▓▓▓   │
  │ • corroboration_index: 0.95 ▓▓▓▓▓ │
  │ • source_diversity: 0.88 ▓▓▓▓▓    │
  │ • contradiction_level: 0.02 ░░░░░ │
  └────────────────────────────────────┘
```

### 5.2 Backend: Claim-Enriched Article Generation

**Modify the `generate_article` prompt** (`internal/agent/pipeline.go:363-412`) to embed claim references:

```
SUPPLEMENTAL INSTRUCTIONS (addition):
- Every factual statement in the article MUST be traceable to a claim_id.
- Insert claim anchors in the markdown using the format: [claim:{claim_id}]
- Example: "The mission launched on July 16, 1969. [claim:abc-123]"
- Do NOT add claim anchors to interpretive or speculative statements.
```

**Example output change:**
```json
{
  "article": {
    "sections": [
      {
        "id": "launch",
        "title": "Launch",
        "content": "Apollo 11 launched from Kennedy Space Center on July 16, 1969. [claim:launch-date-001] The Saturn V rocket was the most powerful vehicle ever flown. [claim:saturn-v-002]"
      }
    ]
  }
}
```

### 5.3 Backend: New API Endpoints

```go
// internal/api/handlers.go additions

// GET /articles/:slug/claims
func (s *Server) handleArticleClaims(w http.ResponseWriter, r *http.Request) {
    slug := extractSlug(r.URL.Path)
    claims, err := s.db.GetClaimsByArticle(slug)
    if err != nil { http.Error(w, ..., 500); return }
    json.NewEncoder(w).Encode(map[string]interface{}{"claims": claims})
}

// GET /claims/:id/evidence
func (s *Server) handleClaimEvidence(w http.ResponseWriter, r *http.Request) {
    claimID := extractClaimID(r.URL.Path)
    evidence, err := s.db.GetEvidenceByClaim(claimID)
    if err != nil { http.Error(w, ..., 500); return }
    json.NewEncoder(w).Encode(map[string]interface{}{"evidence": evidence})
}

// GET /articles/:slug/gaps
func (s *Server) handleArticleGaps(w http.ResponseWriter, r *http.Request) {
    slug := extractSlug(r.URL.Path)
    gaps, err := s.db.GetGapsByArticle(slug)
    if err != nil { http.Error(w, ..., 500); return }
    json.NewEncoder(w).Encode(map[string]interface{}{"gaps": gaps})
}
```

**Route registration in `setupRoutes()`:**
```go
s.mux.Handle("/articles/", chain(apiLimiter.middleware, s.authMiddleware)(http.HandlerFunc(s.handleArticlesDynamicRoute)))
// handleArticlesDynamicRoute needs to route sub-paths:
// /articles/:slug → get article
// /articles/:slug/claims → get claims
// /articles/:slug/gaps → get gaps
// /articles/:slug/progress → SSE (existing)
```

### 5.4 Frontend: Provenance Chip System

**New files:**

```typescript
// packages/web/src/app/components/ProvenanceChip.tsx
"use client";

import { useState } from "react";

interface ClaimStatus {
  claim_id: string;
  status: "supported" | "disputed" | "weak" | "unknown";
  derived_confidence: number;
  confidence_vector: Record<string, number>;
}

export function ProvenanceChip({ claim }: { claim: ClaimStatus }) {
  const [open, setOpen] = useState(false);
  const color = {
    supported: "var(--green)",
    disputed: "var(--red)",
    weak: "var(--amber)",
    unknown: "var(--muted)",
  }[claim.status];

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border"
        style={{ color, borderColor: color + "40", background: color + "10" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {claim.status}
      </button>
      {open && <ClaimPopover claim={claim} onClose={() => setOpen(false)} />}
    </span>
  );
}
```

```typescript
// packages/web/src/app/components/ClaimPopover.tsx
"use client";

import { useEffect, useRef } from "react";

export function ClaimPopover({ claim, onClose }: { claim: ClaimStatus; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 w-80 p-4 rounded-lg shadow-xl border"
      style={{
        top: "100%",
        left: 0,
        background: "var(--surface-elevated)",
        borderColor: "var(--border-light)",
      }}
    >
      <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--ink)" }}>
        Claim {claim.claim_id.slice(0, 8)}
      </h4>
      <div className="space-y-2">
        {Object.entries(claim.confidence_vector || {}).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[10px] capitalize w-24" style={{ color: "var(--muted)" }}>
              {k.replace(/_/g, " ")}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${(v as number) * 100}%`, background: "var(--accent)" }}
              />
            </div>
            <span className="text-[10px] tabular-nums w-8 text-right">{(v as number).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Modify `BlockRenderer` or `ArticleClient`:**

Parse `[claim:xxx]` markers in section content and render them as `ProvenanceChip` components:

```typescript
// packages/web/src/lib/claim-parser.ts
const CLAIM_REGEX = /\[claim:([a-f0-9-]+)\]/g;

export function parseClaimAnchors(text: string, claimsMap: Map<string, ClaimStatus>): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  while ((match = CLAIM_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const claimId = match[1];
    const claim = claimsMap.get(claimId);
    parts.push(claim ? <ProvenanceChip key={claimId} claim={claim} /> : null);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
```

### 5.5 Fallback for Legacy Articles

Articles generated before Phase 1 won't have persisted claims. For these, show a "Legacy Article" badge with a "Re-verify" button that re-runs the pipeline and populates the epistemic layer.

### Phase 2 Deliverables

- [ ] `generate_article` prompt includes `[claim:xxx]` anchor instructions
- [ ] API: `GET /articles/:slug/claims`, `GET /claims/:id/evidence`, `GET /articles/:slug/gaps`
- [ ] Frontend: `ProvenanceChip`, `ClaimPopover` components
- [ ] Frontend: `claim-parser.ts` utility
- [ ] `ArticleClient` fetches claims on load and renders chips
- [ ] Legacy article fallback badge
- [ ] Demo article showing full provenance chain

---

## 6. Phase 3: Global Claim Graph (~ Weeks 7-9)

> *"Articles are views. The claim graph is the database."*

### 6.1 The Concept

Instead of each article having isolated claims, maintain a **global claim graph** where identical claims across articles are merged. This creates:

1. **Cross-article consistency** — if Article A and Article B both claim "X", they reference the same claim node
2. **Evidence accumulation** — evidence from all articles contributes to the same claim's confidence
3. **Graph navigation** — users can traverse from claim → articles → related claims → evidence

### 6.2 Schema Changes

```sql
-- Add claim signature for deduplication
ALTER TABLE claims ADD COLUMN signature TEXT;
CREATE UNIQUE INDEX idx_claims_signature ON claims(signature);

-- Add global claim status (independent of any article)
ALTER TABLE claims ADD COLUMN global_status TEXT 
  CHECK (global_status IN ('confirmed', 'contested', 'under_review'));

-- Track which generation run produced which version
CREATE TABLE claim_versions (
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    generation_run_id UUID NOT NULL,
    confidence_vector JSONB,
    derived_confidence FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (claim_id, generation_run_id)
);

-- Cross-claim relationships (derived from evidence overlap)
CREATE TABLE claim_relationships (
    source_claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    target_claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    relationship_type TEXT CHECK (relationship_type IN ('supports', 'contradicts', 'related')),
    strength FLOAT,
    PRIMARY KEY (source_claim_id, target_claim_id)
);
```

### 6.3 Claim Signature Algorithm

```go
// internal/epistemic/signature.go
package epistemic

import (
    "crypto/sha256"
    "fmt"
    "strings"
    "unicode"
)

// normalizeClaimText strips punctuation, lowercases, removes extra spaces.
// "The CIA operated Project MKUltra." → "the cia operated project mkultra"
func normalizeClaimText(text string) string {
    var b strings.Builder
    for _, r := range strings.ToLower(text) {
        if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSpace(r) {
            b.WriteRune(r)
        }
    }
    return strings.Join(strings.Fields(b.String()), " ")
}

func ClaimSignature(text string) string {
    normalized := normalizeClaimText(text)
    sum := sha256.Sum256([]byte(normalized))
    return fmt.Sprintf("%x", sum[:16]) // 32-char hex
}
```

### 6.4 Deduplication on Insert

In `epistemic.Store.PersistNodeOutput` for `extract_claims`:

```go
for _, c := range payload.Claims {
    sig := ClaimSignature(c.Text)
    // Try to find existing claim with same signature
    existing, err := s.db.GetClaimBySignature(sig)
    if err == nil && existing != nil {
        // Link to existing claim; don't create duplicate
        s.db.LinkArticleClaim(articleSlug, existing.ID)
        // Still record this generation's version
        s.db.SaveClaimVersion(existing.ID, runID, c.ConfidenceVector, c.DerivedConfidence)
    } else {
        // Create new claim
        claimID := c.ClaimID // or generate new UUID
        s.db.SaveClaim(&storage.Claim{
            ID: claimID, Text: c.Text, Signature: sig, ...
        })
        s.db.LinkArticleClaim(articleSlug, claimID)
    }
}
```

### 6.5 Graph Visualization Frontend

```typescript
// packages/web/src/app/components/ClaimGraph.tsx
"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3"; // or use a lighter force-graph library

interface GraphNode {
  id: string;
  type: "claim" | "article" | "evidence";
  label: string;
  status?: string;
  confidence?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: "supports" | "contradicts" | "contains" | "cites";
}

export function ClaimGraph({ articleSlug }: { articleSlug: string }) {
  // Fetch graph data from API, render with D3 force simulation
  // Claims as nodes, evidence as nodes, articles as nodes
  // Color by status: green=supported, red=disputed, amber=weak
  // Size by confidence
}
```

**New API endpoint:**
```go
// GET /articles/:slug/graph
func (s *Server) handleArticleGraph(w http.ResponseWriter, r *http.Request) {
    slug := extractSlug(r.URL.Path)
    // Return nodes + edges for D3/force-graph
    // Nodes: claims in this article + their evidence + linked articles
    // Edges: claim-evidence links, article-claim links, cross-claim relationships
}
```

### 6.6 UI Integration

Add a "View Claim Graph" toggle on article pages:
- Default: normal article reading view (Phase 2 provenance chips)
- Toggle on: full-screen or sidebar force-directed graph
- Click a claim node → highlight it in the article text
- Click an evidence node → show source details

### Phase 3 Deliverables

- [ ] `signature.go` with claim normalization + hashing
- [ ] Schema migrations for `signature`, `global_status`, `claim_versions`, `claim_relationships`
- [ ] Deduplication logic in `extract_claims` persistence
- [ ] API: `GET /articles/:slug/graph` returning D3-compatible graph JSON
- [ ] Frontend: `ClaimGraph` component with force-directed layout
- [ ] Toggle between "Reading View" and "Graph View" on article pages

---

## 7. Phase 4: Living Articles (~ Weeks 10-11)

> *"An encyclopedia that knows when it's getting stale."*

### 7.1 The Concept

Articles are generated once and never updated. We add:
1. **Freshness scoring** — how old is the evidence? Have new sources emerged?
2. **Auto-refresh triggers** — cron job re-runs `retrieve` + `critique` on published articles
3. **Frontend freshness indicator** — traffic-light system showing article health

### 7.2 Freshness Algorithm

```go
// internal/article/freshness.go
package article

import "time"

type FreshnessScore struct {
    Score       float64 // 0-1, 1 = very fresh
    LastChecked time.Time
    Factors     []FreshnessFactor
}

type FreshnessFactor struct {
    Name   string
    Weight float64
    Value  float64 // 0-1
    Reason string
}

func CalculateFreshness(article *storage.Article, claims []*storage.Claim, evidence []*storage.Evidence) FreshnessScore {
    factors := []FreshnessFactor{
        {"evidence_age", 0.3, evidenceAgeScore(evidence), "Average age of supporting evidence"},
        {"claim_stability", 0.25, claimStabilityScore(claims), "How much claims have changed across generations"},
        {"source_diversity", 0.2, sourceDiversityScore(evidence), "Number of independent source types"},
        {"web_activity", 0.25, webActivityScore(article.Slug), "Recent web mentions of topic"},
    }
    
    var total float64
    for _, f := range factors {
        total += f.Weight * f.Value
    }
    return FreshnessScore{Score: total, Factors: factors, LastChecked: time.Now()}
}
```

### 7.3 Auto-Refresh Cron

```go
// internal/triggers/cron.go — extend existing scheduler

func StartArticleRefreshCron(db *storage.DB, engine *sessionlifecycle.Engine) {
    // Run daily at 3 AM
    ticker := time.NewTicker(24 * time.Hour)
    go func() {
        for range ticker.C {
            refreshStaleArticles(db, engine)
        }
    }()
}

func refreshStaleArticles(db *storage.DB, engine *sessionlifecycle.Engine) {
    // Find articles with freshness < 0.5 or last_checked > 7 days ago
    articles, _ := db.ListArticlesNeedingRefresh(7)
    for _, art := range articles {
        // Re-run only retrieve + critique (not full regeneration)
        // Or queue a full refresh via the session engine
        engine.CreateSession(sessionlifecycle.CreateCommand{
            Slug:    art.Slug,
            Persona: "veritas-refresh",
            Source:  "trigger:freshness",
        })
    }
}
```

### 7.4 Frontend: Freshness Indicator

```typescript
// packages/web/src/app/components/FreshnessBadge.tsx

interface FreshnessData {
  score: number; // 0-1
  lastChecked: string;
  factors: { name: string; value: number; reason: string }[];
}

export function FreshnessBadge({ data }: { data: FreshnessData }) {
  const { color, label } =
    data.score > 0.8 ? { color: "var(--green)", label: "Fresh" } :
    data.score > 0.5 ? { color: "var(--amber)", label: "Aging" } :
                       { color: "var(--red)", label: "Stale" };
  
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
         style={{ color, background: color + "12", border: `1px solid ${color}30` }}>
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
      {label} · {Math.round(data.score * 100)}%
    </div>
  );
}
```

Add to article header in `ArticleClient.tsx`:
```tsx
<header className="mb-12 text-center">
  <FreshnessBadge data={article.freshness} />
  <h1>...</h1>
</header>
```

### 7.5 Schema

```sql
-- Add freshness to articles
ALTER TABLE articles ADD COLUMN freshness_score FLOAT DEFAULT 1.0;
ALTER TABLE articles ADD COLUMN freshness_checked_at TIMESTAMP;
ALTER TABLE articles ADD COLUMN freshness_factors JSONB DEFAULT '{}';

-- Index for refresh queries
CREATE INDEX idx_articles_freshness ON articles(freshness_score, freshness_checked_at);
```

### Phase 4 Deliverables

- [ ] `internal/article/freshness.go` with scoring algorithm
- [ ] Daily cron for stale article detection
- [ ] API: `GET /articles/:slug/freshness`
- [ ] Frontend: `FreshnessBadge` component
- [ ] Migration for freshness columns
- [ ] Article refresh mode (lightweight re-verify vs full regeneration)

---

## 8. Phase 5: Open Questions Dashboard (~ Weeks 12-13)

> *"The gaps are as interesting as the facts."*

### 8.1 The Concept

The `detect_missing` node finds evidence gaps. Instead of burying them in article generation logs, expose them as a **public dashboard** where:
- Researchers can see what VERITAS couldn't verify
- Users can "upvote" a gap (signal importance)
- Users can submit new evidence for a gap
- The platform tracks gap resolution over time

### 8.2 Schema

```sql
-- Extend evidence_gaps for public visibility
ALTER TABLE evidence_gaps ADD COLUMN is_public BOOLEAN DEFAULT true;
ALTER TABLE evidence_gaps ADD COLUMN upvotes INT DEFAULT 0;
ALTER TABLE evidence_gaps ADD COLUMN status TEXT DEFAULT 'open' 
  CHECK (status IN ('open', 'investigating', 'resolved', 'closed'));
ALTER TABLE evidence_gaps ADD COLUMN resolved_by TEXT; -- claim_id or user note
ALTER TABLE evidence_gaps ADD COLUMN submitted_evidence JSONB DEFAULT '[]'::jsonb;

-- User submissions for gaps
CREATE TABLE gap_submissions (
    id UUID PRIMARY KEY,
    gap_id UUID REFERENCES evidence_gaps(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('upvote', 'evidence', 'comment')),
    content TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 8.3 API

```go
// GET /gaps — public list of all open gaps
func (s *Server) handleListGaps(w http.ResponseWriter, r *http.Request) {
    gaps, _ := s.db.ListPublicGaps(r.URL.Query().Get("topic"), r.URL.Query().Get("status"))
    json.NewEncoder(w).Encode(map[string]interface{}{"gaps": gaps})
}

// POST /gaps/:id/upvote
func (s *Server) handleUpvoteGap(w http.ResponseWriter, r *http.Request) { ... }

// POST /gaps/:id/submit — submit evidence/comment
func (s *Server) handleSubmitGapEvidence(w http.ResponseWriter, r *http.Request) { ... }

// GET /articles/:slug/gaps — gaps specific to article (already in Phase 2)
```

### 8.4 Frontend: Gap Board

```typescript
// packages/web/src/app/gaps/page.tsx — NEW PAGE
"use client";

export default function GapsPage() {
  const [gaps, setGaps] = useState<EvidenceGap[]>([]);
  const [filter, setFilter] = useState("open");
  
  return (
    <PageLayout maxWidthClass="max-w-4xl">
      <h1>Open Questions</h1>
      <p>Evidence gaps detected by VERITAS across all articles.</p>
      
      <div className="grid gap-4 mt-8">
        {gaps.map(gap => (
          <GapCard key={gap.id} gap={gap} />
        ))}
      </div>
    </PageLayout>
  );
}

function GapCard({ gap }: { gap: EvidenceGap }) {
  return (
    <div className="p-4 rounded-lg border" style={{ borderColor: "var(--border-light)" }}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            {gap.gap_type}
          </span>
          <h3 className="font-medium mt-1">{gap.expected_artifact}</h3>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Expected: {gap.expected_artifact} · From: {gap.article_slug}
          </p>
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
                style={{ background: "var(--surface-glass)" }}>
          ▲ {gap.upvotes}
        </button>
      </div>
    </div>
  );
}
```

### Phase 5 Deliverables

- [ ] Schema: gap visibility, upvotes, submissions
- [ ] API: `/gaps`, `/gaps/:id/upvote`, `/gaps/:id/submit`
- [ ] Frontend: `/gaps` page with filtering
- [ ] Frontend: `GapCard` component
- [ ] Integration: Article page shows "3 open gaps" badge linking to gaps

---

## 9. Phase 6: Veritas Engine SaaS (~ Weeks 14-16)

> *"The pipeline is the product."*

### 9.1 The Concept

Expose the 9-node epistemic pipeline as a **standalone API** — not for generating articles, but for analyzing *any topic* and returning structured epistemic data.

**Target customers:**
- Investigative journalists (fact-check a story)
- Due diligence firms (verify claims about a company)
- Academic researchers (literature review with confidence scoring)
- Legal teams (evaluate evidence strength)

### 9.2 API Design

```http
POST /v1/analyze
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "topic": "Did the 2020 US election have widespread voter fraud?",
  "depth": "full",        // "quick" | "full" | "deep"
  "persona": "neutral",   // "neutral" | "adversarial" | "defensive"
  "output_format": "claims", // "claims" | "article" | "both"
  "sources": ["web", "academic"], // optional source filters
  "max_tokens": 50000
}
```

**Response:**
```json
{
  "analysis_id": "anal_abc123",
  "status": "completed",
  "topic": "Did the 2020 US election have widespread voter fraud?",
  "claims": [
    {
      "claim_id": "claim_001",
      "text": "There were 47,000 duplicate votes in Georgia",
      "status": "disputed",
      "derived_confidence": 0.12,
      "confidence_vector": {
        "evidence_strength": 0.15,
        "corroboration_index": 0.08,
        "source_diversity": 0.10,
        "contradiction_level": 0.89
      },
      "evidence": [...],
      "gaps": [...]
    }
  ],
  "evidence_gaps": [...],
  "language_flags": [...],
  "scrutiny_assessments": [...],
  "article": { /* only if output_format includes "article" */ },
  "cost": {
    "input_tokens": 12500,
    "output_tokens": 8400,
    "total_cost_usd": 0.047
  }
}
```

### 9.3 Implementation

The existing DAG engine already does all the work. We just need:

1. **New handler** (`internal/api/analyze.go`):
   ```go
   func (s *Server) handleAnalyze(w http.ResponseWriter, r *http.Request) {
       var req AnalyzeRequest
       json.NewDecoder(r.Body).Decode(&req)
       
       // Run the DAG
       workflow := buildArticleWorkflow()
       ctx := context.WithTimeout(context.Background(), 10*time.Minute)
       updates, _ := workflow.Execute(ctx, req.Topic)
       
       // Collect outputs (same as generate, but skip article transform)
       var result EpistemicResult
       for u := range updates { ... }
       
       json.NewEncoder(w).Encode(result)
   }
   ```

2. **API Key system** — extend existing JWT or add dedicated API keys:
   ```sql
   CREATE TABLE api_keys (
       key_hash TEXT PRIMARY KEY,
       user_id TEXT REFERENCES users(id),
       name TEXT,
       rate_limit INT DEFAULT 100,
       usage_count INT DEFAULT 0,
       created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Usage metering** — integrate with existing `llm-gateway` meter:
   ```go
   s.llmGateway.Meter.Record(userID, model, tokens)
   ```

4. **Pricing tiers**:
   | Tier | Price | Includes |
   |------|-------|----------|
   | Free | $0 | 5 analyses/month, basic depth |
   | Pro | $49/mo | 100 analyses, full depth, API access |
   | Enterprise | $499/mo | Unlimited, custom models, SLA |

### 9.4 Frontend: Developer Portal

```typescript
// packages/web/src/app/api/page.tsx — NEW PAGE
export default function ApiPage() {
  return (
    <PageLayout>
      <h1>Veritas Engine API</h1>
      <p>Structured epistemic analysis for any topic.</p>
      
      {/* Pricing cards */}
      {/* API key management (if logged in) */}
      {/* Interactive playground: enter topic → see live analysis */}
      {/* Code examples: curl, Python, Node */}
    </PageLayout>
  );
}
```

### Phase 6 Deliverables

- [ ] API: `POST /v1/analyze` with full request/response spec
- [ ] API key system with rate limiting
- [ ] Usage metering + billing integration
- [ ] Developer portal page (`/api`)
- [ ] Interactive API playground
- [ ] Documentation site (Swagger/OpenAPI)

---

## 10. Phase 7: DSML Standard & Ecosystem (~ Week 17)

> *"Standards are force multipliers."*

### 10.1 The Concept

VERITAS uses a custom block format (`heading`, `text`, `timeline`, `map_2d`, etc.) for article rendering. Document this as **DSML (Document Structure Markup Language)** and publish tools.

### 10.2 The Specification

```markdown
# DSML 1.0 Specification

## Block Types

### heading
```json
{
  "type": "heading",
  "data": { "level": 1, "text": "Apollo 11" }
}
```

### text
```json
{
  "type": "text",
  "data": { "text": "Apollo 11 was the spaceflight..." }
}
```

### timeline
```json
{
  "type": "timeline",
  "data": { "events": [{"year": 1969, "event": "Launch"}] }
}
```

### citation
```json
{
  "type": "citation",
  "data": { "title": "NASA Report", "url": "...", "relevance": "primary" }
}
```

### claim (NEW — Phase 2)
```json
{
  "type": "claim",
  "data": {
    "claim_id": "abc-123",
    "text": "The mission launched July 16, 1969",
    "status": "supported",
    "confidence": 0.97
  }
}
```
```

### 10.3 NPM Package

```
packages/dsml/
├── src/
│   ├── types.ts       # TypeScript interfaces for all blocks
│   ├── validator.ts   # Runtime validation (zod schemas)
│   ├── renderer.tsx   # React components for each block type
│   └── parser.ts      # Parse markdown/JSON → DSML blocks
├── package.json
└── README.md
```

### 10.4 Ecosystem Benefits

1. **Other projects** can render VERITAS articles natively
2. **Content pipelines** can produce DSML-compatible output
3. **Academic publishers** can adopt DSML for structured papers
4. **VERITAS becomes infrastructure**, not just an app

### Phase 7 Deliverables

- [ ] `packages/dsml/` package with types, validator, parser, renderer
- [ ] DSML 1.0 specification document
- [ ] README with examples
- [ ] Integration: `@encarta/web` uses `@encarta/dsml` instead of inline block types

---

## Appendix A: File Maps

### New Files by Phase

```
veritas/go-orchestrator/
├── internal/
│   ├── epistemic/
│   │   ├── store.go              (Phase 1)
│   │   ├── types.go              (Phase 1)
│   │   ├── signature.go          (Phase 3)
│   │   └── store_test.go         (Phase 1)
│   ├── article/
│   │   └── freshness.go          (Phase 4)
│   └── api/
│       └── analyze.go            (Phase 6)
├── migrations/
│   ├── 001_initial_schema.sql    (Phase 0)
│   ├── 002_epistemic_indexes.sql (Phase 0)
│   ├── 003_fk_constraints.sql    (Phase 0)
│   ├── 004_epistemic_tracking.sql (Phase 1)
│   ├── 005_claim_dedup.sql       (Phase 3)
│   └── 006_freshness.sql         (Phase 4)

packages/web/src/
├── app/
│   ├── components/
│   │   ├── ProvenanceChip.tsx    (Phase 2)
│   │   ├── ClaimPopover.tsx      (Phase 2)
│   │   ├── ClaimGraph.tsx        (Phase 3)
│   │   ├── FreshnessBadge.tsx    (Phase 4)
│   │   └── GapCard.tsx           (Phase 5)
│   ├── gaps/
│   │   └── page.tsx              (Phase 5)
│   └── api/
│       └── page.tsx              (Phase 6)
├── lib/
│   ├── claim-parser.ts           (Phase 2)
│   └── dsml.ts                   (Phase 7)
└── app/components/
    └── truth-console/
        └── (already exists — extend for gap visualization)

packages/dsml/                    (Phase 7 — NEW PACKAGE)
```

### Modified Files by Phase

```
veritas/go-orchestrator/
├── internal/
│   ├── agent/
│   │   └── pipeline.go           (Phase 2: add claim anchor instructions)
│   ├── api/
│   │   ├── server.go             (Phase 1-6: route registration)
│   │   ├── generate.go           (Phase 1: add epistemic store hook)
│   │   └── handlers.go           (Phase 2-5: new handlers)
│   ├── dag/
│   │   └── engine.go             (Phase 1: add OnNodeComplete callback)
│   ├── storage/
│   │   └── db.go                 (Phase 1-5: new CRUD methods)
│   └── triggers/
│       └── cron.go               (Phase 4: add article refresh cron)
├── cmd/server/main.go            (Phase 0: add migration runner)
├── go.mod                        (Phase 0: add goose)
└── Makefile                      (Phase 0: add migrate target)

packages/web/src/
├── app/
│   ├── article/[slug]/
│   │   └── ArticleClient.tsx     (Phase 2-4: add chips, graph toggle, freshness)
│   └── components/
│       └── BlockRenderer.tsx     (Phase 2: render claim anchors)
├── lib/
│   └── api.ts                    (Phase 2-6: new API calls)
└── package.json                  (Phase 3,7: add d3, @encarta/dsml)
```

---

## Appendix B: Schema Evolution

### Phase 0 (Foundation)
- No schema changes — add migration tooling only
- Clean up: consider dropping `articles.blocks` if truly unused

### Phase 1 (Engine Upgrade)
```sql
ALTER TABLE claims ADD COLUMN generation_run_id UUID;
ALTER TABLE claims ADD COLUMN article_slug TEXT;
ALTER TABLE evidence ADD COLUMN generation_run_id UUID;
ALTER TABLE evidence_gaps ADD COLUMN generation_run_id UUID;
ALTER TABLE scrutiny_assessments ADD COLUMN generation_run_id UUID;
ALTER TABLE language_flags ADD COLUMN generation_run_id UUID;
CREATE INDEX idx_article_claims_article ON article_claims(article_id);
CREATE INDEX idx_article_claims_claim ON article_claims(claim_id);
CREATE INDEX idx_claims_text_gin ON claims USING gin(to_tsvector('english', text));
CREATE INDEX idx_claims_slug ON claims(article_slug);
```

### Phase 3 (Global Claim Graph)
```sql
ALTER TABLE claims ADD COLUMN signature TEXT;
ALTER TABLE claims ADD COLUMN global_status TEXT;
CREATE UNIQUE INDEX idx_claims_signature ON claims(signature);
CREATE TABLE claim_versions (...);
CREATE TABLE claim_relationships (...);
```

### Phase 4 (Living Articles)
```sql
ALTER TABLE articles ADD COLUMN freshness_score FLOAT DEFAULT 1.0;
ALTER TABLE articles ADD COLUMN freshness_checked_at TIMESTAMP;
ALTER TABLE articles ADD COLUMN freshness_factors JSONB DEFAULT '{}';
CREATE INDEX idx_articles_freshness ON articles(freshness_score, freshness_checked_at);
```

### Phase 5 (Open Questions)
```sql
ALTER TABLE evidence_gaps ADD COLUMN is_public BOOLEAN DEFAULT true;
ALTER TABLE evidence_gaps ADD COLUMN upvotes INT DEFAULT 0;
ALTER TABLE evidence_gaps ADD COLUMN status TEXT DEFAULT 'open';
ALTER TABLE evidence_gaps ADD COLUMN resolved_by TEXT;
ALTER TABLE evidence_gaps ADD COLUMN submitted_evidence JSONB DEFAULT '[]'::jsonb;
CREATE TABLE gap_submissions (...);
```

### Phase 6 (SaaS)
```sql
CREATE TABLE api_keys (...);
```

---

## Appendix C: API Additions

| Phase | Method | Path | Description |
|-------|--------|------|-------------|
| 1 | — | — | No new public APIs (internal persistence only) |
| 2 | GET | `/articles/:slug/claims` | All claims for an article |
| 2 | GET | `/claims/:id/evidence` | Evidence for a specific claim |
| 2 | GET | `/articles/:slug/gaps` | Evidence gaps for an article |
| 3 | GET | `/articles/:slug/graph` | D3-compatible graph JSON |
| 4 | GET | `/articles/:slug/freshness` | Freshness score + factors |
| 4 | POST | `/articles/:slug/refresh` | (exists, but now triggers re-verify) |
| 5 | GET | `/gaps` | Public gap listing |
| 5 | POST | `/gaps/:id/upvote` | Upvote a gap |
| 5 | POST | `/gaps/:id/submit` | Submit evidence for a gap |
| 6 | POST | `/v1/analyze` | Generic epistemic analysis |
| 6 | GET | `/v1/usage` | (exists — extend for analyze API) |

---

## Appendix D: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM outputs are too variable for reliable claim extraction | Medium | High | Add validation layer; fall back to no-claims mode |
| Database size grows rapidly with epistemic data | Medium | Medium | Add retention policy; archive old generations |
| Claim deduplication false positives | Medium | Medium | Tune signature algorithm; manual review for disputed merges |
| API abuse if SaaS opens to public | Medium | High | Rate limiting already exists; add API key tiering |
| Frontend performance with large claim graphs | Low | Medium | Paginate graph; use Web Workers for layout |
| Team bandwidth for 4-month roadmap | High | High | Phase 0-2 are non-negotiable; 3-7 can be parallelized or deferred |

---

## Appendix E: Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 0 | CI passes | `go test ./...` green, no secrets in repo |
| 1 | Claims persisted | >90% of generated articles have ≥5 claims in DB |
| 2 | Chip engagement | >30% of article readers click at least 1 provenance chip |
| 3 | Graph usage | >10% of article viewers switch to graph view |
| 4 | Refresh rate | >20% of articles auto-refreshed monthly |
| 5 | Gap contributions | >50 user submissions/month |
| 6 | API revenue | First paying customer within 2 months of launch |
| 7 | DSML adoption | 1 external project using `@encarta/dsml` |

---

*End of Roadmap*
