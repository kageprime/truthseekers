# VERITAS Agentica Upgrade — Implementation Plan

> **Date:** July 2026
> **Source:** Agentica backend architecture (cross-system analysis)
> **Goal:** Production-harden Truthseekers by adopting Agentica's patterns for security, reliability, and extensibility.

## Status (July 11 2026)

| Phase | Status | Tests |
|-------|--------|-------|
| 1.0 Plan | ✅ Complete | — |
| 1.1 IAM | ✅ Complete | 6 |
| 1.2 Executor Gateway | ✅ Complete | 8 |
| 2.1 LLM Gateway | ✅ Complete | 6 |
| 2.2 Session Lifecycle | ✅ Complete | 5 |
| 3.1 Project Manifest | ✅ Complete | 4 |
| 3.2 Credential Proxy | ✅ Complete | 4 |
| 4.1 Registry & Skills | ✅ Complete | 8 |
| 4.2 Trigger System | ✅ Complete | 7 |
| 5 DAG verify | ✅ Complete | — |
| **Total** | **10/10 done** | **60 tests (+46)** |

---

## Implementation Log

### Session 1 (July 11 2026)
- Built IAM: actions, roles, authorization engine, agent scope
- Built Executor Gateway: types, policy, execute, normalize, share, gateway, router — wired web_search through gateway for credential isolation
- Built LLM Gateway: model catalog, usage metering, /v1/llm/models + /v1/llm/completions + /v1/llm/usage
- Built Session Lifecycle: state machine (created→→completed), idempotency, backpressure, retry
- Verified DAG pipeline is already wired through HTTP (Phase 5 was already done)

### Session 2 (July 11 2026)
- Built Project Manifest (3.1): types.go, parse.go, agents.go — JSON-based manifest loading at boot with zero new dependencies
- Manifest is optional: server boots with or without veritas.json; all fields have defaults
- Used `encoding/json` instead of TOML to avoid adding BurntSushi/toml dependency
- Added `veritas/docs/veritas.json.example` as a reference
- Built Credential Store (3.2): in-memory token holder with hot-swap (PATCH /v1/credentials)
- CredStore replaces direct `os.Getenv` in LLM gateway and executor connector resolver
- No restart needed for key rotation; new tokens take effect immediately on next call

### Session 3 (July 11 2026)
- Built Registry & Skills (4.1): auto-discovery of skills/tools/commands from `veritas/registry/` filesystem tree
- Frontmatter parser for SKILL.md (no YAML library needed — manual key:value parsing between --- delimiters)
- Directory scanner: skills/ (SKILL.md), tools/ (.json/.ts), commands/ (any executable)
- Added `veritas/registry/skills/example-skill/SKILL.md` as a reference
- Wired into server boot with backward-compatible empty-registry handling
- Built Trigger System (4.2): cron scheduler + webhook handler with HMAC verification
- Cron: 5-field expression parser (values, ranges, steps, comma lists, wildcards), 60s tick
- Webhook: POST /webhook/{slug} with optional X-Signature-256 HMAC from WEBHOOK_SECRET
- Wired into server boot; triggers read from manifest triggers section

### Session 4 (July 11 2026) — Frontend Integration
- Wired `/v1/llm/models` into chat page — replaces the hardcoded model list with a live fetch
- Added `decodeJwt()` helper in api.ts — reads `role` claim from JWT payload client-side
- Wired IAM role into `AuthProvider` — `user.role` populated from JWT
- Added credential management UI in admin page — `PATCH /v1/credentials` with service/token form
- Added LLM model browser in admin page — displays all models from catalog with capabilities
- Added connector debug view in admin page — lists executor gateway connectors with actions
- Added LLM usage stats dashboard in admin page — calls/tokens/cost grid
- Added mock data for all new endpoints (models, connectors, usage)
- Added `useModels`, `useConnectors`, `useUpdateCredential`, `useUsageStats` hooks
- Updated `AGENTS.md` with full frontend integration table
- Zero new npm dependencies — `atob()` is built into browsers

---

## How to Read This Document

Each phase has:
- **Goal** — what we're building and why
- **Current state** — what exists today (from codebase audit)
- **Target state** — what it looks like after the phase
- **Files to create/modify** — exact file list
- **Implementation strategy** — step-by-step approach
- **Success criteria** — how we know it's done
- **Ponytail notes** — what we're deliberately simplifying and why

---

## Phase 1: Foundations

### Phase 1.1: IAM System

**Goal:** Role-based authorization with action-level permissions, replacing the current dev-only JWT that allows any token to do anything.

**Current state:**
- `internal/api/jwt.go` — HS256 JWT with dev secret `veritas-dev-secret-change-me`
- `internal/api/chat.go:userIDFromRequest` — extracts user ID from JWT, no role checking
- No authorization middleware — any authenticated user can call any route

**Target state:**
- 6 fixed roles: `owner > admin > member` (account), `manager > editor > viewer` (project)
- Action strings: `<resource>.<verb>[.<subresource>]` — e.g. `article.read`, `project.session.*`
- Role → permission mapping in code (no DB tables)
- Middleware that checks actions per-route
- Agent scope resolution for tool-call authorization

**Files to create:**
| File | Purpose |
|---|---|
| `internal/iam/actions.go` | All `RESOURCE_TYPES`, `ACCOUNT_ACTIONS`, `PROJECT_ACTIONS`, `TRIGGER_ACTIONS`, `CHANNEL_ACTIONS` constants |
| `internal/iam/role-perms.go` | `AccountRole`, `ProjectRole` types, role→permission maps, `accountRoleAllows()`, `projectRoleAllows()`, `maxProjectRole()`, `implicitProjectRoleForAccount()` |
| `internal/iam/engine.go` | `AuthorizeTarget`, `AuthorizeResult`, `authorize()` function, `AccessibleResources` |
| `internal/iam/agent-scope.go` | `AgentGrant`, `agentMayPerform()`, `agentMayUseConnector()`, `assertAgentScope()` |

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/server.go` | Add IAM middleware to route setup; inject user role into context |
| `internal/api/chat.go` | Gate tool executors with `assertAgentScope()` |
| `internal/api/handlers.go` | Gate article operations with action checks |
| `internal/api/jwt.go` | Add `role` claim to JWT |

**Implementation strategy:**
```
1. Define actions.go — all action constants as strings
2. Define role-perms.go — role types + permission sets + helper functions
3. Define engine.go — authorize() function
4. Define agent-scope.go — agent grant resolution
5. Modify jwt.go — add role claim
6. Modify server.go — add auth middleware that extracts role
7. Add route-level authorization in handlers
```

**Success criteria:**
- `authorize(type='project', id='x', action='article.read')` returns `{allowed: true/false}`
- Unauthorized routes return 403
- JWT includes `role` claim
- All existing routes still work (backward-compatible)

**Ponytail:** No DB-driven roles, no RBAC tables. 6 roles hardcoded — YAGNI until multi-tenant. Permission sets are `map[Role][]string` not a policy DSL.

---

### Phase 1.2: Executor Gateway

**Goal:** Centralize all tool execution through a single gateway that resolves credentials server-side, enforces policies, and audits every call.

**Current state:**
- 14 tool definitions in `internal/agent/tools.go` — each executor has hardcoded API key access (`os.Getenv("TAVILY_API_KEY")`, `os.Getenv("MODEL_ACCESS_KEY")`)
- 9 server executors in `internal/api/chat.go` — inline closures, no policy
- 9 epistemic executors in `internal/agent/pipeline.go` — no credential isolation
- Credentials flow through the agent process (agent sees raw API keys)

**Target state:**
- `POST /v1/executor/call` route — single entry point for all tool execution
- Gateway resolves connector definitions, normalizes actions, resolves credentials server-side
- Policy engine: glob-based allow/block/require-approval
- Audit logging: every call recorded with caller, action, args, outcome
- Agent sends tool calls to gateway instead of executing locally
- Normalization pipeline: OpenAPI/GraphQL/MCP/HTTP specs → `NormalizedAction[]`

**Files to create:**
| File | Purpose |
|---|---|
| `internal/executor/types.go` | `Risk`, `NormalizedAction`, `ActionBinding`, `CallInput`, `CallResult`, `GatewayDeps`, `Policy` |
| `internal/executor/gateway.go` | `handleCall()` — the decision flow: resolve connector → action → credential → policy → execute → audit |
| `internal/executor/execute.go` | `executeCall()` — low-level HTTP/GraphQL/MCP execution with auth attachment |
| `internal/executor/normalize.go` | `normalize()` — OpenAPI/GraphQL/MCP/HTTP → `NormalizedAction[]` + risk derivation |
| `internal/executor/policy.go` | `resolveEffectiveAction()` — policy match + default mode resolution |
| `internal/executor/share.go` | `isSecretUsableBy()` — connector sharing model (project/private/members) |
| `internal/executor/router.go` | HTTP routes: `/v1/executor/call`, `/v1/executor/connectors` |

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/server.go` | Mount executor routes |
| `internal/agent/tools.go` | Replace local executors with gateway calls; remove `os.Getenv` from tool code |
| `internal/agent/types.go` | Add `ToolExecutor` gateway-aware variant |

**Implementation strategy:**
```
1. Define types.go — all shared types
2. Define policy.go — glob matching + policy resolution
3. Define execute.go — HTTP/GraphQL/MCP execution with secret attachment
4. Define normalize.go — provider normalizers
5. Define share.go — sharing model
6. Define gateway.go — handleCall() orchestration
7. Define router.go — HTTP routes
8. Wire into server.go
9. Migrate existing tools one at a time
```

**Success criteria:**
- `POST /v1/executor/call` returns `{status: "ok", data: ...}` for valid calls
- Agent cannot read API keys from environment (credential isolation verified)
- Policy engine blocks `dangerous_tool.charges.*` correctly
- Audit records stored in DB
- All existing chat agent tools still work

**Ponytail:** No MCP server support initially (just HTTP). No WebSocket transport. No real-time policy updates.

---

## Phase 2: Core Infrastructure

### Phase 2.1: LLM Gateway

**Goal:** Unified model routing with catalog, budget enforcement, usage metering, and credential isolation.

**Current state:**
- `internal/agent/llm.go` — streaming provider routing, two hardcoded providers (DO, Groq), no budget, no metering, keys from env vars
- `internal/agent/pipeline.go` — independent `SendPromptJSON()` with same routing, separate timeout
- Python workers (`llm/client.py`) — own independent LLM client with 4-provider fallback, no budget
- No model catalog — model list is hardcoded in `resolveModel()` switch

**Target state:**
- `GET /v1/llm/models` — model catalog endpoint
- `POST /v1/llm/completions` — unified completion proxy with budget check
- Model catalog with metadata (reasoning, tool_call, context/output limits)
- Usage metering per user/session
- Provider failover (DO → Groq → OpenAI)
- `GET /v1/llm/usage` — usage history endpoint

**Files to create:**
| File | Purpose |
|---|---|
| `internal/llm-gateway/catalog.go` | Model catalog — default set, limitations, `kortix/auto` router |
| `internal/llm-gateway/gateway.go` | `handleLlmCompletion()` — budget check → provider routing → streaming proxy → metering |
| `internal/llm-gateway/meter.go` | Token/cost tracking per user, session, model |
| `internal/llm-gateway/router.go` | HTTP routes |

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/server.go` | Mount LLM gateway routes |
| `internal/agent/llm.go` | Update to use gateway instead of direct provider calls |
| `internal/agent/pipeline.go` | Update to use gateway |

**Implementation strategy:**
```
1. Define catalog.go — model registry with metadata
2. Define gateway.go — streaming completion proxy
3. Define meter.go — usage tracking
4. Define router.go — HTTP routes
5. Wire into server.go
6. Migrate agent LLM calls to gateway
```

**Success criteria:**
- `GET /v1/llm/models` returns model list with capabilities
- `POST /v1/llm/completions` streams responses and records usage
- Budget enforcement returns 429 when exceeded
- Existing agent chat still works

**Ponytail:** No per-model pricing (flat cost per token). No complex routing strategies (just failover).

---

### Phase 2.2: Session Lifecycle Engine

**Goal:** Formal state machine for article generation sessions with idempotency, backpressure, queue/retry/dead-letter.

**Current state:**
- `internal/api/queue.go` — basic bounded channel (3 workers, 128 buffer) with slug-level dedup
- `internal/api/generate.go` — `processArticle()` runs DAG pipeline, but `handleGenerateArticle` has a stub fallback mention
- No state machine (just queued/running/done/error)
- No idempotency keys
- No long-poll for readiness
- No backpressure policy (drops at 128, no caller feedback)

**Target state:**
- Session states: `created → queued → provisioning → running → completing → completed | failed | stopped`
- Idempotent session creation (idempotency key)
- Backpressure policy per source (ui/cli/slack/email)
- Command queue with exponential backoff retry + dead-letter
- Long-poll for session readiness (up to 300s)
- Session resurrection (heal on crash)

**Files to create:**
| File | Purpose |
|---|---|
| `internal/session-lifecycle/types.go` | `SessionLifecycleStatus`, `CreateSessionCommand`, `ContinueSessionCommand`, `SessionInvocationSource`, `QueuePolicy` |
| `internal/session-lifecycle/engine.go` | `createSession()`, `startSession()`, `continueSession()` — the state machine |
| `internal/session-lifecycle/store.go` | Session command queue — claim, retry, dead-letter |
| `internal/session-lifecycle/backpressure.go` | `sessionBackpressureState()` — backpressure compute |

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/queue.go` | Replace with session lifecycle engine |
| `internal/api/generate.go` | Wire through session lifecycle |
| `internal/api/handlers.go` | Update to use new session model |
| `internal/storage/db.go` | Add session tables if needed |

**Implementation strategy:**
```
1. Define types.go — all session lifecycle types
2. Define store.go — command queue with retry/dead-letter
3. Define backpressure.go — backpressure compute
4. Define engine.go — create/start/continue/stop/fail
5. Replace generation queue with session lifecycle
6. Wire into HTTP handlers
```

**Success criteria:**
- Session moves through all states correctly
- Idempotency key prevents double-creation
- Backpressure queues when >N active sessions
- Long-poll returns when session is ready (<300s)
- Dead-letter after 5 retry attempts

**Ponytail:** Single-process queue (no Redis). Session state stored in existing MongoDB (no new DB). Long-poll is simple timer loop, not WebSocket. No warm-pool / fork adoption.

---

## Phase 3: Configuration & Security

### Phase 3.1: Project Manifest

**Goal:** Declarative TOML-based configuration (`veritas.toml`) for agents, tools, policies, and pipeline configuration.

**Current state:**
- All agent configuration is hardcoded in Go (tools, prompts, models)
- No per-project customization without code changes
- Pipeline node order is hardcoded in `buildArticleWorkflow()`

**Target state:**
- `veritas.toml` at repo root parsed at boot
- Declares: `[[agents]]`, `[[connectors]]`, `[[triggers]]`, `[[policies]]`
- Tool definitions can be loaded from spec files
- Pipeline node order configurable
- `[sandbox]` defaults

**Files to create:**
| File | Purpose |
|---|---|
| `internal/manifest/types.go` | `ParsedManifest`, `AgentSpec`, `ConnectorSpec`, `TriggerSpec`, `PolicySpec` |
| `internal/manifest/parse.go` | `parseManifestString()`, `readManifest()`, `serializeManifest()` — TOML parsing via `BurntSushi/toml` |
| `internal/manifest/agents.go` | `resolveAgentGrant()`, `grantFromLoadedAgents()` |

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/server.go` | Load manifest on boot |
| `internal/agent/tools.go` | Read tool config from manifest |
| `internal/api/generate.go` | Read pipeline config from manifest |

**Implementation strategy:**
```
1. Define types.go — manifest structs
2. Define parse.go — TOML parsing
3. Define agents.go — agent grant resolution
4. Integrate with server boot
5. Add veritas.toml example
```

**Success criteria:**
- Server boots with or without veritas.toml
- Tool definitions can be overridden via manifest
- Pipeline node list configurable
- Backward-compatible defaults when no manifest

**Ponytail:** Single file, no schema validation beyond required fields. No hot-reload (restart to pick up changes). No remote manifest fetching.

---

### Phase 3.2: Credential Proxy

**Goal:** Hot-swappable credential proxy that holds API keys in-memory and rewrites auth headers — no process restart for key rotation.

**Current state:**
- API keys read from `os.Getenv` at tool-call time
- No way to rotate keys without process restart
- Python workers have their own key loading

**Target state:**
- In-memory credential store with `setToken()` / `getToken()`
- LLM proxy on `:4319` that rewrites `Authorization` on every request
- Executor proxy on `:4320` that does same for tool calls
- No process restart for key rotation

**Files to create:**
| File | Purpose |
|---|---|
| `internal/credential-proxy/proxy.go` | HTTP reverse proxy that rewrites `Authorization` header; `setToken()` / `getToken()` |

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/server.go` | Start credential proxy on boot |
| `internal/agent/llm.go` | Route through local proxy |
| `internal/agent/tools.go` | Route through executor proxy |

**Implementation strategy:**
```
1. Define CredentialProxy struct — holds token, upstream URL, reverse proxy handler
2. start() — listens on localhost port, proxies to upstream, rewrites auth
3. setToken() — atomic token swap with mutex
4. Wire into server boot
5. Update LLM/executor paths to use proxy URL
```

**Success criteria:**
- Proxy forwards requests correctly and rewrites auth header
- `setToken()` takes effect immediately on next request
- No restart needed for key rotation
- Agent still works through proxy (end-to-end verified)

**Ponytail:** Single upstream per proxy (no multi-provider proxy). No TLS on localhost. No connection pooling tuning.

---

## Phase 4: Extensibility & Automation

### Phase 4.1: Registry & Skills

**Goal:** File-system based auto-discovery of tools, skills, agents, and commands — adding a capability means adding a directory, not Go code.

**Current state:**
- All tools hardcoded in Go (`ChatToolDefinitions()`, `EpistemicToolDefinitions()`)
- Skills and agent behavior embedded in code
- No plugin system

**Target state:**
- `veritas/registry/` directory with `skills/`, `agents/`, `tools/`, `commands/` subdirectories
- Auto-discovery on boot: scan directories → parse frontmatter → register
- `SKILL.md` files with YAML frontmatter for skill metadata
- Agent `.md` files with behavior configuration
- Tool `.ts` or `.json` files for tool definitions

**Files to create:**
| File | Purpose |
|---|---|
| `internal/registry/skills.go` | `SkillGroup`, `groupSkillFiles()` — skill directory scanning |
| `internal/registry/build.go` | `buildRegistry()` — auto-detect primitives, merge extras |
| `internal/registry/manifest.go` | `parseFrontmatter()`, `resolveRegistryDir()` |

**Files to modify:**
| File | Change |
|---|---|
| `internal/agent/tools.go` | Merge registry-discovered tools with hardcoded set |
| `internal/api/server.go` | Load registry on boot |

**Implementation strategy:**
```
1. Define types — SkillGroup, RegistryEntry
2. Define manifest.go — frontmatter parsing
3. Define skills.go — directory scanning
4. Define build.go — registry builder
5. Wire into server boot
6. Add example skill directory
```

**Success criteria:**
- Skills in `registry/skills/` are auto-discovered and available as agent tools
- Frontmatter parsed correctly
- Backward-compatible (hardcoded tools still work)
- Adding a tool = creating a directory, not editing Go

**Ponytail:** No hot-reload. No npm-style package manager. No versioning or dependency resolution. Simple file-system scanning only.

---

### Phase 4.2: Trigger System

**Goal:** Cron + webhook integration for scheduled article generation and event-driven research.

**Current state:**
- No scheduled generation
- No webhook endpoint
- No event-driven pipeline execution

**Target state:**
- `[triggers]` section in veritas.toml
- Cron trigger: `cron = "0 9 * * 1-5"` → `POST /articles/{slug}/generate`
- Webhook trigger: `POST /webhook/{slug}` → process inbound data
- Session reuse policy: `fresh` (new generation) or `reuse` (continue last)

**Files to create:**
| File | Purpose |
|---|---|
| `internal/triggers/cron.go` | Cron scheduler — `robfig/cron` or stdlib `time.Ticker` |
| `internal/triggers/webhook.go` | Webhook handler — HMAC verification, body parsing, action dispatch |
| `internal/triggers/router.go` | HTTP routes for webhooks |

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/server.go` | Mount trigger routes, start cron scheduler |
| `internal/manifest/parse.go` | Parse trigger specs from manifest |

**Implementation strategy:**
```
1. Define trigger spec types
2. Implement cron scheduler
3. Implement webhook handler with HMAC verification
4. Wire into server boot
5. Add trigger config to example manifest
```

**Success criteria:**
- Cron trigger fires article generation at correct schedule
- Webhook trigger processes inbound POST and starts session
- HMAC verification rejects invalid webhooks
- Session reuse policy respected

**Ponytail:** No distributed cron locking (single-process only). No retry on webhook failure. No webhook delivery receipts.

---

## Phase 5: Wire DAG Pipeline Through HTTP Generate Path

**Goal:** Ensure the real DAG pipeline is fully wired through the HTTP `generate` path and working end-to-end.

**Current state:**
- `internal/api/generate.go:processArticle()` calls `buildArticleWorkflow()` → DAG engine → Python nodes
- `internal/api/queue.go` dispatches to `processArticle()` via worker pool
- This is already the REAL pipeline, not a stub
- But MIGRATION_STATUS.md says `handleGenerateArticle → processArticleStub` is a stub — this was already fixed

**Files to modify:**
| File | Change |
|---|---|
| `internal/api/generate.go` | Verify real pipeline is active; remove any remaining stub references |
| `internal/api/handlers.go` | Ensure `handleGenerateArticle` routes correctly |

**Implementation strategy:**
1. Audit the code path from `POST /articles/{slug}/generate` → DAG nodes → article persistence
2. Remove any remaining stub/mock references in the generate path
3. Add integration test

**Success criteria:**
- `POST /articles/apollo-11/generate` runs the full Python pipeline and persists an article
- Frontend receives SSE progress events for each node
- Article is retrievable via `GET /articles/apollo-11`

---

## Appendix: Key Types Reference

### IAM Action Strings
```
# Account-scoped
account.read, account.write, billing.*, member.*, group.*, token.*, project.create

# Project-scoped  
project.*, project.deploy, project.cr.*, project.session.*, project.trigger.*, project.gateway.*
article.*, article.read, article.generate, article.refresh, article.delete

# Chat/Agent-scoped
chat.*, chat.read, chat.send
agent.*, agent.run, agent.stop

# Trigger-scoped
trigger.*, trigger.read, trigger.update, trigger.delete, trigger.fire

# Channel-scoped
channel.*, channel.read, channel.connect, channel.send, channel.disconnect

# Admin-scoped
admin.*, admin.settings.read, admin.settings.write
```

### Role → Permission Map
```
owner        → ALL (superset of admin)
admin        → ALL account + ALL project (implicit manager on every project)
member       → account.read + explicit project grants only
manager      → ALL project actions (editor + deploy + session + trigger + gateway)
editor       → article.* + chat.* + trigger.read
viewer       → article.read + chat.read
```

### Session Lifecycle States
```
created → queued (on backpressure)
created → provisioning (direct)
queued → provisioning (worker picks up)
provisioning → running (sandbox ready)
running → completing (generation done)
completing → completed (persisted)
any → failed (error)
any → stopped (user abort)
```

### Connector Risk Levels
```
read        → GET, HEAD, OPTIONS, GraphQL query → auto-allow
write       → POST, PUT, PATCH, GraphQL mutation → require approval by default
destructive → DELETE, DROP, any irreversible → require approval
```
