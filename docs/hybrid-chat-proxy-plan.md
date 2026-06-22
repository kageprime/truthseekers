# Chat Backend Ported to Go (Completed)

## What Changed

Removed the hybrid reverse proxy architecture. The Go orchestrator now handles chat natively — no Node server dependency for chat.

### Files Added
| File | Lines | Purpose |
|------|-------|---------|
| `internal/agent/types.go` | ~90 | Message, ToolCall, ToolDef, AgentEvent, Block types |
| `internal/agent/llm.go` | ~210 | OpenAI-compatible streaming client (Groq + DO inference) |
| `internal/agent/agent.go` | ~210 | Agent loop: tool-calling, context mgmt, iteration limit |
| `internal/agent/tools.go` | ~290 | 13 tool definitions + built-in executors (search, fetch, verify, render) |

### Files Modified
| File | Change | Lines |
|------|--------|-------|
| `internal/storage/db.go` | Added Conversation, Message, Memory CRUD | +150 |
| `internal/api/chat.go` | New file: 5 chat route handlers + SSE streaming | ~260 |
| `internal/api/server.go` | Removed proxy, added `chatRouter` dispatch | -30 |
| Root `package.json` | Replaced `dev:hybrid` with `dev:go:web` | ~5 |

### Files Removed (no longer needed)
- Reverse proxy code in `server.go` (`chatReverseProxy`, `chatProxy` field, `ModifyResponse`)

## Architecture

```
Browser → Go:4097
  ├── /chat, /chat/*        → native Go agent handler (SSE streaming)
  ├── /articles/*, /auth/*  → existing Go handlers
  └── /quota, /queue, etc.  → existing Go handlers
```

No Node server needed for chat. The agent calls LLM APIs directly (Groq + DO inference).

## Dependencies

No new Go dependencies beyond stdlib + existing MongoDB driver. JWT parsing is done with base64 decode (no JWT library needed for dev).

## Running

```bash
# Go + Next.js
npm run dev:go:web

# Go standalone
npm run dev:go
```

## LLM Providers

| Model | Provider | API Key Env Var |
|-------|----------|----------------|
| `gemma-4-31B-it` | DO Inference | `MODEL_ACCESS_KEY` |
| `deepseek-4-flash` | DO Inference | `MODEL_ACCESS_KEY` |
| `deepseek-v4-pro` | DO Inference | `MODEL_ACCESS_KEY` |
| `llama-4-scout-17b-16e-instruct` | Groq | `GROQ_API_KEY` |
| Default fallback | Groq | `GROQ_API_KEY` |

## Testing

```
# Create conversation
POST /chat  {"title":"Test"}

# Send message (SSE stream response)
POST /chat/:id/messages  {"content":"Say hello"}

# List conversations
GET /chat

# Get conversation with messages
GET /chat/:id

# Update title
PATCH /chat/:id  {"title":"New title"}
```

## Regressions

- The `create_article` tool executor is stubbed (no real queue integration in Go yet)
- `generate_video` returns a "not available" message (no video gen in Go yet)
- Article generation pipeline is still Node-only via `processor.ts`
