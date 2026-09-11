// Truthseekers service worker — offline-first reads, never stale shell.
// Version the cache name on strategy changes; old caches are purged on activate.
//
// Policy:
// - Navigations: network-first, fall back to the precached /offline page.
// - Same-origin /_next/static: cache-first (content-hashed, immutable).
// - Public API reads (articles, claim-graph, contested, gaps, stale, maps,
//   model catalog, health): stale-while-revalidate. Authenticated calls
//   (Authorization header present) and everything else: network-only.
//   Chat, auth, quota, queue, and tracking are NEVER cached.
// - SSE streams (text/event-stream) and non-GET: always passthrough.

const VERSION = "truthseekers-v1";
const STATIC_CACHE = VERSION + "-static";
const API_CACHE = VERSION + "-api";
const OFFLINE_URL = "/offline";

// Public, user-independent GET surfaces worth serving offline.
const CACHEABLE_API = [
  "/articles",
  "/claim-graph",
  "/contested",
  "/gaps",
  "/stale",
  "/maps",
  "/v1/llm/models",
  "/health",
];

function isCacheableApi(url) {
  try {
    const u = new URL(url);
    if (u.origin !== self.location.origin && !u.hostname.endsWith("herokuapp.com")) return false;
    // Exact path or sub-path. Query strings never reach pathname, so
    // /articles?limit=20 matches via the first branch.
    return CACHEABLE_API.some((p) => u.pathname === p || u.pathname.startsWith(p + "/"));
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("truthseekers-") && k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const accept = req.headers.get("accept") || "";
  // Never touch streams, mutations, or authed calls.
  if (accept.includes("text/event-stream")) return;
  if (req.headers.has("authorization")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !url.hostname.endsWith("herokuapp.com")) return;

  // Navigations: network first, offline page on failure.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match(OFFLINE_URL).then((hit) => hit || Response.error()))
    );
    return;
  }

  // Hashed Next.js assets: cache first, populate in background.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Public API reads: stale-while-revalidate.
  if (isCacheableApi(req.url)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(API_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
});
