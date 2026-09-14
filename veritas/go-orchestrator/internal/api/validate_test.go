package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ponytail: 429s without Retry-After caused reconnect storms, and the shared
// IP bucket never bound expensive writes — one account queued pipelines freely.
func TestWriteBudgetRejectsWithRetryAfter(t *testing.T) {
	s := testPaystackServer(t)
	allowed := 0
	for i := 0; i < 12; i++ {
		req := httptest.NewRequest(http.MethodPost, "/articles/x/generate", nil)
		rec := httptest.NewRecorder()
		if s.checkWriteBudget(rec, req) {
			allowed++
			continue
		}
		if rec.Code != http.StatusTooManyRequests {
			t.Fatalf("budget reject: code=%d, want 429", rec.Code)
		}
		if rec.Header().Get("Retry-After") == "" {
			t.Fatal("429 without Retry-After header")
		}
	}
	if allowed != 10 {
		t.Fatalf("write budget allowed %d, want 10", allowed)
	}
}

// ponytail: conditional reads save the article bytes on every poll —
// a mismatched tag must fall through to the full body, not 304.
func TestServeETag304(t *testing.T) {
	match := httptest.NewRequest(http.MethodGet, "/articles/x", nil)
	match.Header.Set("If-None-Match", `"v1"`)
	rec := httptest.NewRecorder()
	if !serveETag(rec, match, "v1") || rec.Code != http.StatusNotModified {
		t.Fatalf("match: done=%t code=%d, want 304", true, rec.Code)
	}
	miss := httptest.NewRequest(http.MethodGet, "/articles/x", nil)
	miss.Header.Set("If-None-Match", `"v0"`)
	rec2 := httptest.NewRecorder()
	if serveETag(rec2, miss, "v1") || rec2.Header().Get("ETag") != `"v1"` {
		t.Fatal("mismatch must fall through with ETag set")
	}
}

// ponytail: by-value models made json.Unmarshal fail, so every validated
// PUT (settings, credentials, track) 400d with "Invalid JSON body".
func TestValidateBodyRoundTrip(t *testing.T) {
	handler := validateBody(&adminSettingsReq{})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body adminSettingsReq
		if !getValidatedBody(r, &body) {
			http.Error(w, `{"error":"Missing validated body"}`, http.StatusInternalServerError)
			return
		}
		if len(body.Settings) != 1 || body.Settings["featured_pinned"] != `["a"]` {
			http.Error(w, `{"error":"bad settings"}`, http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPut, "/admin/settings", strings.NewReader(`{"settings":{"featured_pinned":"[\"a\"]"}}`))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("valid PUT rejected: code=%d body=%s", rec.Code, rec.Body.String())
	}

	empty := httptest.NewRequest(http.MethodPut, "/admin/settings", strings.NewReader(`{"settings":{}}`))
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, empty)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("empty settings accepted: code=%d", rec2.Code)
	}
}
