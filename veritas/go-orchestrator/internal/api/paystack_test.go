package api

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

func testPaystackServer(t *testing.T) *Server {
	t.Helper()
	t.Setenv("ALLOW_DEV_AUTH", "1")
	db, err := storage.NewDB("", t.TempDir())
	if err != nil {
		t.Fatalf("mock db: %v", err)
	}
	return NewServer("4097", db)
}

func signPaystack(t *testing.T, secret string, body []byte) string {
	t.Helper()
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// No secret configured → webhook fails closed, never open.
func TestPaystackWebhookNoSecret(t *testing.T) {
	t.Setenv("PAYSTACK_SECRET_KEY", "")
	s := testPaystackServer(t)
	req := httptest.NewRequest(http.MethodPost, "/paystack/webhook", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	s.handlePaystackWebhook(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d, want 503", rec.Code)
	}
}

// Wrong signature → 403, and the body is never acted on.
func TestPaystackWebhookBadSig(t *testing.T) {
	t.Setenv("PAYSTACK_SECRET_KEY", "whsec-test")
	s := testPaystackServer(t)
	req := httptest.NewRequest(http.MethodPost, "/paystack/webhook", strings.NewReader(`{"event":"charge.success"}`))
	req.Header.Set("x-paystack-signature", "deadbeef")
	rec := httptest.NewRecorder()
	s.handlePaystackWebhook(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("got %d, want 403", rec.Code)
	}
}

// Valid signature + unknown event → acknowledged, ignored.
func TestPaystackWebhookIgnoresUnknown(t *testing.T) {
	t.Setenv("PAYSTACK_SECRET_KEY", "whsec-test")
	s := testPaystackServer(t)
	body := []byte(`{"event":"invoice.created","data":{}}`)
	req := httptest.NewRequest(http.MethodPost, "/paystack/webhook", strings.NewReader(string(body)))
	req.Header.Set("x-paystack-signature", signPaystack(t, "whsec-test", body))
	rec := httptest.NewRecorder()
	s.handlePaystackWebhook(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
}

// Unknown tier → 400 before any provider call.
func TestPaystackInitUnknownTier(t *testing.T) {
	s := testPaystackServer(t)
	req := httptest.NewRequest(http.MethodPost, "/paystack/initialize", strings.NewReader(`{"tier":"diamond"}`))
	rec := httptest.NewRecorder()
	s.handlePaystackInit(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", rec.Code)
	}
}

// Malformed reference → 400 without touching auth or provider.
func TestPaystackVerifyBadRef(t *testing.T) {
	s := testPaystackServer(t)
	req := httptest.NewRequest(http.MethodGet, "/paystack/verify/../../etc", nil)
	rec := httptest.NewRecorder()
	s.handlePaystackVerify(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", rec.Code)
	}
}
