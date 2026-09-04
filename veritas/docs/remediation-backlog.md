# Remediation Backlog — Security + Frontend

Source: security audit + frontend audit (Sep 2026). Work top to bottom; each item is
self-contained. Check the box only when the **Verify** step passes.

Conventions: `C` Critical · `H` High · `M` Medium · `L` Low.
After every backend item: `go build ./...` + `go test ./internal/...` from
`veritas/go-orchestrator`.

---

## Phase 0 — Prerequisites (do first, 10 min)

- [ ] **P0.1** Set secrets in every env (local `.env`, fly, Vercel):
  `JWT_SECRET` (32+ random bytes), `MODEL_API_KEY`, `REVALIDATE_SECRET`, `WEBHOOK_SECRET`.
  Verify: `go run ./cmd/server` logs no `WARNING: Using default JWT secret`.

## Phase 1 — Critical: auth + RCE

- [ ] **S1 [C]** Email-only login = account impersonation (`internal/api/server.go:1044-1068`).
  Fix: magic-link OTP before `issueToken`; stop auto-create-on-login.
  Verify: login with an untrusted email no longer yields a JWT.
- [ ] **S2 [C]** Default JWT secret (`internal/api/jwt.go:24-38`).
  Fix: fail closed unless `ALLOW_DEV_AUTH=1`; require 32+ bytes.
  Verify: unset `JWT_SECRET` → server refuses to boot (non-dev).
- [ ] **S3 [C]** Chat IDOR — no conversation ownership check
  (`internal/api/chat.go:171-237,239-272`).
  Fix: after `GetConversation`, `if conv.UserID != userID { 403 }` in
  `handleChatByID`, `handleChatMessages`, `handleChatStop`.
  Verify: user B GET/POST on user A's `convID` → 403.
- [ ] **S4 [C]** `run_command` RCE via prompt injection (`internal/agent/tools.go:46-51,654-681`).
  Fix: delete the tool; if kept: admin-only + binary allowlist + no-env sandbox.
  Verify: `grep -r run_command internal/agent/tools.go` → gone or gated.

## Phase 2 — Key / token spend

- [ ] **S5 [H]** `/v1/llm/*` + `/v1/executor/call` unauthenticated
  (`internal/api/server.go:744-749`, `internal/llm-gateway/gateway.go:236-239`).
  Fix: auth middleware + per-user quota on all four routes.
  Verify: anonymous `POST /v1/llm/completions` → 401.
- [ ] **S6 [H]** `PATCH /v1/credentials` is any-member (`internal/api/server.go:874-898`).
  Fix: `requireRole("admin")` + audit old/new key hashes.
  Verify: member token → 403; admin rotation works and is logged.
- [ ] **S7 [H]** Token theft via JS-readable storage (`packages/web/src/lib/api.ts:112-117`,
  `app/components/AuthProvider.tsx:32-57`).
  Fix: backend sets `HttpOnly; Secure; SameSite=Lax` cookie on login; frontend uses
  `credentials:"include"`, deletes `localStorage` mirror + `migrateToken` shim.
  Verify: no `truthseekers_token` in `localStorage`/`document.cookie` after login.

## Phase 3 — Network boundary

- [ ] **S8 [H]** SSRF in `webfetch`/`verifyCitation` (`internal/agent/tools.go:299-316,498-561`).
  Fix: http/https only, block loopback/link-local/private via resolved-IP dial check,
  2 MB `MaxBytesReader`, ≤3 redirects.
  Verify: fetch of `http://169.254.169.254/` and `http://localhost:4097/` refused.
- [ ] **S9 [H]** CORS `*` with `Authorization` allowed (`internal/api/server.go:1003-1028`).
  Fix: echo `CORS_ORIGIN` allowlist + `Vary: Origin`; never `*` on auth routes.
  Verify: cross-origin response carries the allowlisted origin, not `*`.

## Phase 4 — Backend Mediums

- [ ] **S10 [H]** Webhook HMAC signs slug, not body; empty secret = open trigger
  (`internal/api/server.go:902-924`, `internal/triggers/webhook.go`).
  Fix: require secret; HMAC(rawBody)+timestamp; reject slugs with `/` or `..`.
- [ ] **S11 [H]** JWT `alg` not pinned; role trusted from token (`internal/api/jwt.go:92-103`).
  Fix: require `alg=="HS256"`; re-fetch role from DB on privileged routes.
- [ ] **S12 [M]** Rate-limiter trusts `X-Forwarded-For`, buckets never evicted
  (`internal/api/server.go:116-151`).
  Fix: trust XFF only behind known proxy; eviction goroutine + per-user limiter.
- [ ] **S13 [M]** Validation tags dead; body double-decode (`internal/api/server.go:241-290`,
  `internal/api/handlers.go:232-236`).
  Fix: hand-check lengths (or add validator lib); `MaxBytesReader` + re-wrap `r.Body`.
- [ ] **S14 [M]** Unbounded `limit`, unescaped `LIKE` wildcards (`internal/api/handlers.go:122-191`).
  Fix: clamp `limit` ≤ 100; escape `%_\`; set statement timeout.
- [ ] **S15 [M]** `mem_store`/`recall` ignore `userID` — cross-user leak
  (`internal/api/chat.go:533-556`).
  Fix: `key = userID + ":" + key` on store and recall.
- [ ] **S16 [M]** Export filename header injection (`internal/api/handlers.go:291-309`).
  Fix: whitelist `[a-z0-9-]`, fallback `article.md`, add `filename*=UTF-8`.
- [ ] **S17 [M]** Public SSE progress leaks claim text; uncapped subscribers
  (`internal/api/handlers.go:956-999`, `internal/api/live.go:207-272`).
  Fix: auth for in-progress slugs (or redact until `article_complete`); cap subs per slug.
- [ ] **S18 [M]** Image save writes base64 text under guessable names
  (`internal/api/server.go:597-617`, `internal/agent/tools.go:615-626`).
  Fix: `base64.DecodeString`, random filename, restrict dir to docroot.
- [ ] **S19 [M]** Executor sharing/policy unenforced; audit is `log.Printf` only
  (`internal/executor/share.go`, `internal/executor/gateway.go:34-142`).
  Fix: enforce scope check in `HandleCall`; persist audit to DB.

## Phase 5 — Frontend security

- [ ] **S20 [M]** `javascript:` URLs renderable from backend content
  (`BlockRenderer.tsx:467`, `MarkdownRenderer.tsx:124-135`, `MediaImage.tsx`).
  Fix: shared `safeUrl()` guard (`http(s)://` or `/`, else `"#"`) at all three sites.
- [ ] **S21 [M]** JSON-LD `</script>` breakout (`ClaimReviewJsonLd.tsx:54`).
  Fix: `JSON.stringify(payload).replace(/</g, "\\u003c")`.
- [ ] **S22 [M]** Revalidate fails open + arbitrary-path revalidation
  (`app/api/revalidate/route.ts:4,29-31`).
  Fix: fail closed when `REVALIDATE_SECRET` unset; allowlist `/article/[a-z0-9-]+`.
- [ ] **S23 [M]** Mermaid `innerHTML` without explicit hardening (`MermaidDiagram.tsx:9,34-37`).
  Fix: `securityLevel:"strict"` + DOMPurify-sanitize the SVG (v11 defaults help; pin it).
- [ ] **S24 [M]** Open redirect via `?redirect=` (`app/login/page.tsx:51-53`).
  Fix: allow only single-leading-slash paths, else `/`.
- [ ] **S25 [L]** Middleware presence-only; `/article/new`, `/queue` unprotected
  (`middleware.ts:5,12,25`).
  Fix: add both routes; treat client `user.role` as display-only.
- [ ] **S26 [L]** Minor hygiene: `encodeURIComponent` slugs/ids (`article/[slug]/page.tsx:10`,
  `lib/api.ts`); `BASE` must not fall back to localhost in prod (`lib/constants.ts:1`);
  validate Stripe `data.url` origin before `window.location.href`.

## Phase 6 — Backend Low hygiene (one pass)

- [ ] **S27 [L]** `rand.Read` errors ignored; non-RFC UUIDs
  (`internal/storage/db.go:363-367`, `internal/api/chat.go:637-641`).
  Fix: return on rand error; set RFC4122 v4 bits.
- [ ] **S28 [L]** Shutdown context without timeout (`cmd/server/main.go:74-80`).
  Fix: `context.WithTimeout(..., 15*time.Second)`.
- [ ] **S29 [L]** Skill frontmatter auto-loaded into agent context unsanitized
  (`internal/registry/scan.go`); `REGISTRY_DIR` env ignored.
  Fix: size cap + strip instructions; honor env or fix comment.
- [ ] **S30 [L]** Unclamped `IN (...)` claim lists; stop logging token prefixes
  (`internal/storage/db.go:1409-1435`, `internal/api/chat.go:661`).
  Fix: chunk to 500 IDs; never log tokens.

## Phase 7 — Frontend: de-bland (design tokens stay; composition changes)

- [ ] **D1** Kill picsum placeholders (`app/page.tsx:34,59,201,283,352-370`).
  Fix: paper-grain + gold-rule CSS art from `globals.css`, or consistent duotone
  `luminosity` overlays. Verify: zero `picsum` references.
- [ ] **D2** Break the ×5 identical section recipe (`app/page.tsx`).
  Fix: editorial left-aligned H2 + rule for one section; one full-bleed dark
  (`ink` bg) contrast section; tighten the rest to `max-w-6xl`.
- [ ] **D3** Card variants (`FeatureLink` ×4, `BentoCard` ×5).
  Fix: Claim Graph → dark-gold variant; Contested → oxblood left-rule; stagger
  bento padding dense/airy.
- [ ] **D4** Type hierarchy: card titles `1.25rem/600`, descriptions `0.8125rem/1.6 muted`,
  Lora italic for quotes only; use `.t-display-1/.t-body` over inline clamps.
- [ ] **D5** Motion discipline: blur-reveal for H2s only, plain fade for cards,
  `.stagger-children` on the 4-up grid.
- [ ] **D6** Nav (`FloatIslandNav.tsx`): gold-pill active state, dropdowns on
  focus/click (not hover-only); delete or wire dead `BottomDock` (`:390`).
- [ ] **D7** Shared `EmptyState` (fleuron ❦ + title + CTA) replacing `"No content yet."`
  (`BlockRenderer.tsx:116` et al.); `.skeleton` rows while health/claims load.

## Phase 8 — Process follow-ups

- [ ] **F1** Run `/setup-matt-pocock-skills` to enable the triage/wayfinder flows
  (`code-review`, `tdd` already in `.agents/skills/`).
- [ ] **F2** Re-run this backlog's Verify steps after the Muse Spark switch settles;
  confirm `/v1/llm/*` auth (S5) covers the new `MODEL_API_KEY` path.
