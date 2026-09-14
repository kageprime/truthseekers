package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

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
