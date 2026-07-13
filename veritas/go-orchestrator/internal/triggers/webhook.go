package triggers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
)

// WebhookHandler returns an http.Handler that verifies HMAC and dispatches.
// The secret is used to validate the X-Signature-256 header. When empty,
// HMAC verification is skipped (dev mode).
func WebhookHandler(secret string, fn Fn) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "use POST", http.StatusMethodNotAllowed)
			return
		}
		if secret != "" {
			sig := r.Header.Get("X-Signature-256")
			if sig == "" {
				http.Error(w, "missing signature", http.StatusUnauthorized)
				return
			}
			body := make([]byte, r.ContentLength)
			r.Body.Read(body)
			mac := hmac.New(sha256.New, []byte(secret))
			mac.Write(body)
			expected := hex.EncodeToString(mac.Sum(nil))
			if !hmac.Equal([]byte(sig), []byte(expected)) {
				http.Error(w, "invalid signature", http.StatusForbidden)
				return
			}
		}
		slug := r.PathValue("slug")
		if slug == "" {
			http.Error(w, "missing slug", http.StatusBadRequest)
			return
		}
		var body struct {
			Params map[string]string `json:"params,omitempty"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		params := body.Params
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
