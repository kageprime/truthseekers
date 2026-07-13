# Kortix → Truthseekers Adoption Assessment

**Date:** 2026-07-13
**Context:** Evaluate the Kortix Sandbox Agent Console architecture for patterns to adopt into the Truthseekers (VERITAS) Go orchestrator.

---

## Current Pipeline State

Single Go LLM pipeline — Python removed as of 2026-07-13.

| Path | Backend | Status |
|------|---------|--------|
| Article generation (`generate.go`) | Native Go LLM calls (`DAGNodeExecutors` in `pipeline.go`) | **Pure Go** |
| Chat agent (`chat.go`) | Native Go LLM calls (`EpistemicToolExecutors` in `pipeline.go`) | **Pure Go** |

**Key file:** `internal/agent/pipeline.go` — complete Go implementation of all 9 epistemic nodes, with `DAGNodeExecutors()` for the article generation workflow and `EpistemicToolExecutors()` for the chat agent tools.

---

## Kortix Patterns Worth Adopting

### Tier 1: High Impact / Low Effort (Do First)

| # | Pattern | Kortix Source | Current State | What To Do |
|---|---------|---------------|---------------|------------|
| 1 | **Wire session-lifecycle into HTTP path** | Session state machine (`created→…→completed`) | Session engine exists (`internal/session-lifecycle/`) but `handleGenerateArticle` bypasses it for the old `queue.go` | Connect `handleGenerateArticle` → `sessionEngine.CreateSession()` instead of `queue.Submit()`. ~2 files. |
| 2 | **SSE ring buffer for event replay** | Event store pattern | `BroadcastProgress` drops events for late-joining subscribers; no history | Add a capped ring buffer per channel (last N events). Late subscribers replay missed events on connect. ~50 lines. |
| 3 | **Route all tools through executor gateway** | `agent.GatewaySearch` pattern | Only `web_search` routes through gateway; `generate_image`, `webfetch`, `verify_citation` read env vars directly | Extend `GatewaySearch` → `GatewayCall(connector, action, args)` for every tool. ~3 files. |

### Tier 2: Medium Impact / Medium Effort

| # | Pattern | Kortix Source | Current State | What To Do |
|---|---------|---------------|---------------|------------|
| 4 | **Credential proxy (warm-fork hot-swap)** | `llm-proxy.ts` — localhost Bun proxy injects bearer token without restart | `credstore` + `llm-gateway` exist but need a restart to swap keys | Two localhost Go HTTP proxies (ports 4319/4320) between agent and LLM/executor upstreams. `setLlmProxyToken()` updates token in-memory. Zero restart. |
| 5 | **Agent grant enforcement at runtime** | `iam/agent-scope.go` — `Connectors`/`KortixCLI` grants per agent | Grants are declared in structs but never checked; all agents get all tools | Wire `AgentGrant` into `AgentConfig` — filter available tools/connectors per agent persona at config-read time. |
| 6 | **PTY tool for interactive shell** | `pty-tools.ts` — 5 tools: spawn/write/read/list/kill | No terminal capability at all in the Go agent | Add a `pty` builtin tool using `creack/pty` (or similar). Spawns interactive shell sessions, streams output back. |
| 7 | **Go pipeline for article generation** | — | `pipeline.go` has the Go LLM nodes but `generate.go` still calls `python3` | Replace `pythonExec()` calls in `buildArticleWorkflow()` with Go `SendPromptJSON` executors. Remove Python subprocess dependency. |

### Tier 3: Higher Effort, Architectural

| # | Pattern | Kortix Source | Current State | What To Do |
|---|---------|---------------|---------------|------------|
| 8 | **Process supervisor for DAG nodes** | Child process supervision with restart policies | Naive `exec.CommandContext` — no health checks, no restart, no resource limits | Wrap Python/Go node execution in a subprocess manager with restart backoff, health probes, resource accounting. |
| 9 | **Hot-reload manifest** | Config watcher pattern | `kortix.toml` read once at boot; changing agents/tools/policies requires restart | Add `fsnotify` watcher on `kortix.toml`. On change, atomic-swap config structs and rewire tool/agent/policy registries. |
| 10 | **Session persistence (DB-backed)** | — | `session-lifecycle.Engine` is in-memory only — lost on restart | Back session state with MongoDB (reuses existing `storage/db.go`). Survive restarts, support multi-instance coordination. |
| 11 | **Human-in-the-loop approval flow** | `policy.go:require_approval` + SSE relay | `policy.go` defines `require_approval` risk level but nothing wires it into an actual approval UI/event | Wire `require_approval` → paused agent → `question.asked` SSE event → UI prompt → `question.replied` → resume. |

---

## Adoption Strategy

### Phase 1 (This Sprint)
1. ~~**Replace Python with Go in article generation** — swap `pythonExec()` in `generate.go` for `agent.EpistemicToolExecutors()`. Remove Python subprocess dependency entirely.~~ **DONE 2026-07-13**
2. ~~**SSE ring buffer** — capped replay buffer per slug. Late subscribers catch up.~~ **DONE 2026-07-13**
3. ~~**Wire session-lifecycle** — connect `handleGenerateArticle` → `sessionEngine`.~~ **DONE 2026-07-13**
   - Added `Persona` to `Session`/`CreateCommand` types
   - Removed `GenerationQueue` (replaced entirely by session engine)
   - All 4 callers (`handleGenerateArticle`, `handleRefreshArticle`, `create_article` tool, `triggerAction`) now route through `sessionEngine.CreateSession()`

### Phase 2
4. ~~**Route all tools through gateway** — extend credential isolation to every builtin tool.~~ **DONE 2026-07-13**
   - Added `GatewayGenerateImage` function var; `generate_image` now routes through executor gateway
   - `verify_citation` switched from ad-hoc `defaultRoute()`+`llmVerify()` to `SendPromptJSON()`
   - Added `generate_image` custom executor in server.go
   - Removed unused `llmVerify()` function
5. ~~**Agent grant enforcement** — filter tools by agent persona at runtime.~~ **DONE 2026-07-13**
   - Added `filterToolsByManifest()` in `chat.go` — restricts tools to those listed in `kortix.toml`'s agent spec
   - No-op when manifest has no agent or no tool list (backward compatible)
6. ~~**PTY tool** — interactive shell for the agent.~~ **DONE 2026-07-13**
   - Added `run_command` builtin tool — executes commands with args, 30s timeout, 50KB output cap
   - No PTY dependency needed (uses `os/exec` with pipes, cross-platform)
   - Registered in tool definitions, executors, and merge function

### Phase 3 (Backlog)
7. **Credential proxy** — warm-fork hot-swap without agent restart.
8. **Hot-reload manifest** — live config updates.
9. **Session persistence** — DB-backed lifecycle engine.
10. **HITL approval** — paused agents + SSE question flow.

---

## Non-Adoptable Kortix Patterns

These are specific to the sandbox/VM model and don't apply to Truthseekers' single-process architecture:

| Pattern | Reason |
|---------|--------|
| Daytona VM per session | Truthseekers runs as a single Go process — no VM orchestration needed |
| OpenCode as supervised child process | No AI coding agent subprocess; the Go orchestrator IS the agent |
| Warm seed pool / fork de-collision | No VM snapshot/fork lifecycle |
| Static web server (port 3211) | Frontend serves itself; no in-process static file server needed |
| `kortix.toml` → `opencode.jsonc` config dir pattern | Agent config comes from the Go manifest, not a separate OpenCode runtime config |
| Slack thread relay (`turn-stream`) | Chat is web-native; no Slack integration in scope |
| Git credential helper subprocess | Git integration is simpler — no per-session branch checkout needed |
