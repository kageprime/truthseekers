package triggers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
)

// webhookSlugRe whitelists slugs to block traversal / nested paths.
var webhookSlugRe = regexp.MustCompile(`^[a-z0-9-]+$`)

// WebhookHandler returns an http.Handler that verifies HMAC over the raw body
// and dispatches. Secret is required — empty means 503, never open (S10).
func WebhookHandler(secret string, fn Fn) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "use POST", http.StatusMethodNotAllowed)
			return
		}
		if secret == "" {
			http.Error(w, "webhook not configured", http.StatusServiceUnavailable)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "unreadable body", http.StatusBadRequest)
			return
		}
		sig := strings.TrimPrefix(r.Header.Get("X-Signature-256"), "sha256=")
		if sig == "" {
			http.Error(w, "missing signature", http.StatusUnauthorized)
			return
		}
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(body)
		expected := hex.EncodeToString(mac.Sum(nil))
		if !hmac.Equal([]byte(sig), []byte(expected)) {
			http.Error(w, "invalid signature", http.StatusForbidden)
			return
		}
		slug := r.PathValue("slug")
		if slug == "" || !webhookSlugRe.MatchString(slug) {
			http.Error(w, "invalid slug", http.StatusBadRequest)
			return
		}
		var parsed struct {
			Params map[string]string `json:"params,omitempty"`
		}
		_ = json.Unmarshal(body, &parsed)
		params := parsed.Params
		if params == nil {
			params = make(map[string]string)
		}
		params["slug"] = slug
		fn("create_article", params)
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "accepted"})
	})
}

// VerifyHMAC is a helper for manual HMAC verification. Exported for testing.
func VerifyHMAC(secret, body []byte, signature string) error {
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(signature), []byte(expected)) {
		return fmt.Errorf("hmac mismatch")
	}
	return nil
}
