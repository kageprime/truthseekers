# Frontend Contract — Go Backend → New Web UI (`2000s-retro-web-page/`)

Single source for adopting the new design. Old UI (`packages/web/`) is frozen; do not port from it except `lib/api.ts` patterns.

## 1. Backend location

- Code: `veritas/go-orchestrator/` — pure Go, stdlib `net/http`, no framework.
- Boot: `cmd/server/main.go` → `internal/api/server.go:NewServer` → `setupRoutes`. Port `PORT` (default **4097**).
- Local: `cd veritas/go-orchestrator && go run ./cmd/server` (file-mock if no `DATABASE_URL`).
- Full stack: `make up` (Postgres 15 + backend :4097 + frontend :3000).
- Health: `GET /health` → `{status, version, storage_mode: postgres|file, mockMode, article_count, queue:{active,queued}}`.

## 2. Env (backend reads / frontend sends)

| Var | Who | Notes |
|---|---|---|
| `DATABASE_URL` | backend | unset → file-mock mode |
| `PORT` | backend | default 4097 |
| `CORS_ORIGIN` | backend | comma allowlist; empty = `*` (dev only) |
| `JWT_SECRET` | backend | required, fail-fast at boot |
| `NEXT_PUBLIC_API_URL` | **new frontend** | browser-facing backend base, e.g. `http://localhost:4097` |
| `REVALIDATE_URL` / `REVALIDATE_SECRET` | backend→frontend | `POST {REVALIDATE_URL}/api/revalidate` after generate; ISR fallback 60s |
| `TAVILY_API_KEY` / `FIRECRAWL_API_KEY` | backend | enables real `retrieve` node; else LLM-only |
| `MODEL_ACCESS_KEY` / `GROQ_API_KEY` / `MODEL_API_KEY` / `OPENAI_API_KEY` | backend | via `credstore`, hot-swap `PATCH /v1/credentials` (admin) |
| `ENCARTA_IMAGE_DIR` / `ENCARTA_PUBLIC_URL` | backend | generated PNG output dir + public base |

## 3. Auth

- HS256 JWT (`internal/api/jwt.go`). Send `Authorization: Bearer <tok>` **and** `credentials: "include"` (HttpOnly `truthseekers_token` cookie is second source, `chat.go:tokenFromRequest`).
- Public reads: `optionalAuth` (anon OK). Writes: `requireCtxAuth` → 401 when anon.
- Roles re-fetched from DB per request (`requireRole`); 6 fixed roles, `admin.settings.write` for admin writes.
- Write budget: 10/min per user on generate/refresh/contest → 429 + `Retry-After`. Body cap 1 MB → 413.

## 4. Routes (base = `NEXT_PUBLIC_API_URL`)

### Articles — core of new UI
| Method | Path | Auth | Query/Body → Response |
|---|---|---|---|
| GET | `/articles?limit=&offset=` | no | `{data: ArticleSummary[], pagination:{limit,offset,hasMore,nextOffset}}` (limit ≤100) |
| GET | `/articles/search?q=&limit=` | no | `ArticleSummary[]` (limit ≤50) |
| GET | `/articles/top?limit=` | no | `{data: ArticleSummary[]}` |
| GET | `/articles/:slug` | no | `Article` or 404 `{error, status:not_generated}`. ETag + `Cache-Control: max-age=60` |
| GET | `/articles/:slug/status` | no | `Job{slug,status,phase}` or `{status:not_found}` |
| POST | `/articles/:slug/generate` | **yes** | `{persona?}` → 202 `{status:queued|already_exists|busy}` |
| POST | `/articles/:slug/refresh` | **yes** | → 202 `{status:queued}` |
| GET | `/articles/:slug/progress` | no* | **SSE** `progress` + `agent_event` + `article_complete`; anon sees only `article_complete` + heartbeats (15s). Send `Last-Event-ID` to resume |
| GET | `/articles/:slug/epistemic` | no | **prefer this** — `{slug,claims,gaps,key_facts,freshness,refresh_diff,claim_graph}` in 1 RTT |
| GET | `/articles/:slug/claims`, `/gaps`, `/freshness`, `/refresh-diff`, `/graph`, `/claim-graph`, `/export?format=`, `/views` | no | single-purpose; `epistemic` covers most |
| POST | `/articles/:slug/resolve` | **yes** | `{action}` → `{status:resolved}` (HITL stub) |
| POST | `/track` | **yes** | `{slug, event?:view}` → `{status:tracked}` (fire-and-forget) |

`Article = {slug,title,abstract,sections[{id,title,content,media[]}],timeline[],categories[],crossrefs[],citations[{url,title}],blocks?,derived_confidence,metadata{version,status,created,updated}}`. See `internal/storage/db.go:19-185`, mirrors `packages/core/src/types.ts`.

### Epistemic (claims / gaps / graphs)
| Method | Path | Notes |
|---|---|---|
| GET | `/claims/search?q=&limit=` (≤50) | Claim Finder → `{claims: ClaimWithArticle[]}` |
| GET/POST | `/claims/:id/evidence` | GET `{claim,evidence[]}`; POST `{url,note,type?,supports_claim?}` → community evidence |
| GET | `/contested?limit=` (≤100) | dashboard, ranked by contradiction |
| GET | `/claim-graph?limit=&min_contradiction=` | global graph `{nodes,edges,claim_count}` (limit ≤500) |
| GET | `/gaps` | `{gaps}` enriched with claim text |
| POST | `/gaps/:id/upvote`, `/gaps/:id/submit` | **yes**; submit `{url,note}` (http(s) only) |
| GET | `/stale?limit=` | stalest-first `{articles}` |
| GET | `/featured` | **public** homepage picks (never gate on `/admin/settings`) |

`Claim{id,text,type:factual\|interpretive\|predictive,status:supported\|disputed\|weak\|unknown,derived_confidence,confidence_vector{contradiction_level}}`. Graph node `{id,type:claim\|evidence,label,short_label,status,confidence,article_slug}`; edge `{source,target,type:evidence\|claim,relationship:supports\|contradicts\|related}`.

### Chat (Veritas agent, auth required)
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/chat` | list / create `{title?}` → conversation |
| GET/PATCH | `/chat/:id` | detail `{messages[]}` / rename `{title}` (owner only) |
| POST | `/chat/:id/messages` | **SSE** `{content,model?,time_machine_era?,pageContext?}` → `agent_event` frames + final `done{msgId,content,blocks}`. Heartbeat 15s. Abort via disconnect or `POST /chat/:id/stop` |
| POST | `/chat/:id/stop` | owner-only abort |

`Message{role:user\|assistant\|tool,content,blocks?:Block[],tool_calls?,createdAt}`. Blocks: `heading|text|timeline|map_2d|map_3d|chart|image|gallery|video|diagram|citation|crossref|epistemic_graph|image_compare|interactive_calc|divider` (`core/types.ts:242-478`).

### Maps / images / misc
- `GET /maps?limit=&offset=` → `{data,interactive,pagination}`; `GET /maps/:slug` → `MapEntry{slug,title,markers[],centerLat,centerLng,zoom,geoJson}`.
- `GET /images/:slug` public article visuals (DB-backed).
- `GET /live/now` (global SSE ticker), `GET /articles/:slug/live` (presence).
- `GET /quota` (authed) → `{allowed,limit,used,remaining,tier}` (free 10/d, pro 100/d). `GET /queue` (authed) → `{jobs[],stats}`; `DELETE /queue/:slug` cancel own.
- `GET /v1/llm/models` public; `POST /v1/llm/completions` + `GET /v1/llm/usage` authed. `POST /v1/executor/call` authed; `GET /v1/executor/connectors` public stub.
- `POST /paystack/initialize` + `GET /paystack/verify/:ref` authed; `POST /paystack/webhook` HMAC (no JWT). `/stripe/*` legacy stubs — ignore.
- Admin (role `admin`): `GET|PUT /admin/settings`, `GET /seed/status|run|pause`, `GET /coordinator/status|run`. Webhook `POST /webhook/:slug` HMAC `X-Signature-256`.

## 5. Errors / caching

- Errors are JSON `{error:...}` with 400/401/403/404/409/413/429/5xx. `304` on `If-None-Match`. Hot reads send `Cache-Control: public, max-age=60`.
- Frontend rule: public `GET` → `fetch` + `credentials:include`, no token needed; mutations → attach `Bearer` + `credentials:include`; 401 on mutation → redirect `/login?redirect=...`; reads never redirect.

## 6. What to reuse from old UI

- `packages/web/src/lib/api.ts` (~921 lines, MOCK fallback pattern) — shrink to ~150 lines for new UI (`lib/api.ts` here, no mock-data dep).
- `packages/web/src/lib/constants.ts` → `lib/config.ts` (BASE + prod-missing warning).
- `packages/web/src/app/hooks/useApi.ts` query-key conventions → single `lib/use-api.ts` hook (no react-query dep in new app — native fetch).
- SSE parsers: `app/hooks/useChatStream.ts`, `useArticleProgress` → `lib/use-sse.ts` pattern (EventSource + `Last-Event-ID`).

## 7. New-UI adoption map

| New route | Backend | Fallback when offline |
|---|---|---|
| `/` search | `GET /articles/search?q=` + `GET /featured` | static 3 entries |
| `/articles` | `GET /articles?limit=&offset=` + client filter | static 6 cards |
| `/articles/[slug]` | `GET /articles/:slug` + `GET .../epistemic` + `POST .../track` | static press article |
| `/claims?q=` | `GET /claims/search` + `GET /contested` | static 3 claims |
| `/maps` | `GET /maps` | static 4 places |
| `/chat` | `POST /chat` + `POST /chat/:id/messages` (SSE) | canned Veritas reply + login CTA when 401 |
