package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// Paystack billing (F3 — Paystack, not Stripe).
//
// Flow: POST /paystack/initialize {tier} → {authorization_url, reference}.
// The user pays on Paystack, returns to /billing/callback?reference=, which
// calls GET /paystack/verify/{reference}. POST /paystack/webhook is the
// source of truth for async events. Amounts/plans are server-priced from env
// — the client only ever sends a tier id.
//
// Env: PAYSTACK_SECRET_KEY (or credstore "paystack"), PAYSTACK_PLAN_PRO,
// PAYSTACK_PLAN_ENTERPRISE (subscription plan codes), PAYSTACK_AMOUNT_PRO,
// PAYSTACK_AMOUNT_ENTERPRISE (kobo, one-time fallback), PAYSTACK_CURRENCY
// (default NGN), PAYSTACK_CALLBACK_URL.

// paystackTier maps a tier id to its plan-code and one-time-amount env vars.
var paystackTier = map[string]struct{ planEnv, amountEnv string }{
	"pro":        {"PAYSTACK_PLAN_PRO", "PAYSTACK_AMOUNT_PRO"},
	"enterprise": {"PAYSTACK_PLAN_ENTERPRISE", "PAYSTACK_AMOUNT_ENTERPRISE"},
}

var paystackRefRe = regexp.MustCompile(`^[A-Za-z0-9_-]{4,100}$`)

// errPaystackTransient marks failures worth retrying: transport down,
// provider 5xx, or our own DB write failed. Webhooks answer these non-2xx
// so Paystack retries; permanent rejects (bad amount, unknown tier) are
// acked 200 after logging since retries can't fix them.
var errPaystackTransient = errors.New("paystack transient")

func paystackTransient(err error) bool { return errors.Is(err, errPaystackTransient) }

func paystackSecret(s *Server) string {
	if k := s.credStore.Get("paystack"); k != "" {
		return k
	}
	return os.Getenv("PAYSTACK_SECRET_KEY")
}

func paystackCurrency() string {
	if c := strings.ToUpper(strings.TrimSpace(os.Getenv("PAYSTACK_CURRENCY"))); c != "" {
		return c
	}
	return "NGN"
}

func paystackAmount(env string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(os.Getenv(env)))
	if n < 0 {
		return 0
	}
	return n
}

// paystackAPI calls the Paystack REST API and decodes the envelope.
// Returns the data object on status:true, else an error with Paystack's message.
func paystackAPI(secret, method, path string, payload interface{}) (map[string]interface{}, error) {
	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, "https://api.paystack.co"+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+secret)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("paystack unreachable (%v): %w", err, errPaystackTransient)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var env struct {
		Status  bool                   `json:"status"`
		Message string                 `json:"message"`
		Data    map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		if resp.StatusCode >= 500 {
			return nil, fmt.Errorf("paystack bad response %d: %w", resp.StatusCode, errPaystackTransient)
		}
		return nil, fmt.Errorf("paystack bad response: %d", resp.StatusCode)
	}
	if !env.Status {
		if resp.StatusCode >= 500 {
			return nil, fmt.Errorf("paystack: %w: %s", errPaystackTransient, env.Message)
		}
		return nil, fmt.Errorf("paystack: %s", env.Message)
	}
	if env.Data == nil {
		env.Data = map[string]interface{}{}
	}
	return env.Data, nil
}

func paystackNum(m map[string]interface{}, key string) int {
	switch v := m[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	}
	return 0
}

func paystackStr(m map[string]interface{}, key string) string {
	s, _ := m[key].(string)
	return s
}

// handlePaystackInit starts a transaction for a tier. Auth required.
func (s *Server) handlePaystackInit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"use POST"}`, http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Tier string `json:"tier"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	cfg, ok := paystackTier[strings.ToLower(strings.TrimSpace(body.Tier))]
	if !ok {
		http.Error(w, `{"error":"unknown tier"}`, http.StatusBadRequest)
		return
	}
	secret := paystackSecret(s)
	if secret == "" {
		http.Error(w, `{"error":"billing not configured"}`, http.StatusServiceUnavailable)
		return
	}
	plan := strings.TrimSpace(os.Getenv(cfg.planEnv))
	amount := paystackAmount(cfg.amountEnv)
	if plan == "" && amount <= 0 {
		http.Error(w, `{"error":"billing not configured for tier"}`, http.StatusServiceUnavailable)
		return
	}
	userID := userIDFromContext(r.Context())
	user, err := s.db.GetUser(userID)
	if err != nil || user == nil {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}
	tier := strings.ToLower(strings.TrimSpace(body.Tier))
	payload := map[string]interface{}{
		"email":    user.Email,
		"amount":   amount,
		"currency": paystackCurrency(),
		"metadata": map[string]interface{}{"user_id": user.ID, "tier": tier},
	}
	if plan != "" {
		payload["plan"] = plan
	}
	if cb := strings.TrimSpace(os.Getenv("PAYSTACK_CALLBACK_URL")); cb != "" {
		payload["callback_url"] = cb
	}
	data, err := paystackAPI(secret, http.MethodPost, "/transaction/initialize", payload)
	if err != nil {
		reqLog(r, "paystack init failed: %v", err)
		http.Error(w, `{"error":"payment provider error"}`, http.StatusBadGateway)
		return
	}
	ref := paystackStr(data, "reference")
	url := paystackStr(data, "authorization_url")
	if ref == "" || url == "" {
		http.Error(w, `{"error":"payment provider error"}`, http.StatusBadGateway)
		return
	}
	if err := s.db.CreatePayment(storage.PaystackPayment{
		Reference: ref, UserID: user.ID, Email: user.Email,
		Tier: tier, Amount: amount, Currency: paystackCurrency(),
	}); err != nil {
		reqLog(r, "paystack ledger write failed ref=%s: %v", ref, err)
		http.Error(w, `{"error":"could not start payment"}`, http.StatusInternalServerError)
		return
	}
	reqLog(r, "paystack init user=%s tier=%s ref=%s", userID, tier, ref)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"authorization_url": url, "reference": ref})
}

// fulfillPaid verifies a reference with Paystack (server-side truth) and, on
// success, marks the ledger row paid exactly once and upgrades the tier.
// Idempotent: repeat calls after the first are no-ops returning the tier.
func (s *Server) fulfillPaid(reference string) (userID, tier string, err error) {
	secret := paystackSecret(s)
	if secret == "" {
		return "", "", fmt.Errorf("billing not configured")
	}
	data, err := paystackAPI(secret, http.MethodGet, "/transaction/verify/"+reference, nil)
	if err != nil {
		return "", "", err
	}
	if paystackStr(data, "status") != "success" {
		return "", "", fmt.Errorf("payment not successful")
	}
	meta, _ := data["metadata"].(map[string]interface{})
	tier = strings.ToLower(paystackStr(meta, "tier"))
	cfg, ok := paystackTier[tier]
	if !ok {
		return "", "", fmt.Errorf("unknown tier in metadata")
	}
	// Amount/plan guard: the client never prices, so a tampered webhook with
	// a valid reference for a cheaper tier can't upgrade a higher one.
	if want := paystackAmount(cfg.amountEnv); want > 0 && paystackNum(data, "amount") < want {
		return "", "", fmt.Errorf("amount mismatch")
	}
	if wantPlan := strings.TrimSpace(os.Getenv(cfg.planEnv)); wantPlan != "" {
		if plan, _ := data["plan"].(map[string]interface{}); plan != nil {
			if got := paystackStr(plan, "plan_code"); got != "" && got != wantPlan {
				return "", "", fmt.Errorf("plan mismatch")
			}
		}
	}
	userID = paystackStr(meta, "user_id")
	first, err := s.db.MarkPaymentPaid(reference)
	if err != nil {
		// Unknown reference (e.g. mock-mode ledger): fall back to metadata
		// attribution so legit payments still fulfill.
		log.Printf("[paystack] ledger miss ref=%s: %v", reference, err)
	} else if !first {
		log.Printf("[paystack] duplicate fulfill ref=%s", reference)
	}
	if userID == "" {
		return "", "", fmt.Errorf("unattributed payment")
	}
	if err := s.db.SetSubscriptionTier(userID, tier); err != nil {
		// ponytail: our DB write failed, not their payment — retryable.
		return "", "", fmt.Errorf("entitlement failed (%v): %w", err, errPaystackTransient)
	}
	return userID, tier, nil
}

// handlePaystackVerify confirms a payment for the logged-in user. The ledger
// row (or metadata fallback) must belong to the caller — no claiming.
func (s *Server) handlePaystackVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"use GET"}`, http.StatusMethodNotAllowed)
		return
	}
	ref := strings.TrimPrefix(r.URL.Path, "/paystack/verify/")
	ref = strings.Trim(ref, "/")
	if !paystackRefRe.MatchString(ref) {
		http.Error(w, `{"error":"invalid reference"}`, http.StatusBadRequest)
		return
	}
	userID := userIDFromRequest(r)
	// Ledger pre-check: a row belonging to someone else fails fast. Unknown
	// references fall through — fulfillPaid attributes via API metadata and
	// the paidUser comparison below still binds to the caller.
	if p, err := s.db.GetPaymentByReference(ref); err == nil && p != nil && p.UserID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}
	paidUser, tier, err := s.fulfillPaid(ref)
	if err != nil {
		reqLog(r, "paystack verify ref=%s failed: %v", ref, err)
		http.Error(w, `{"error":"payment not confirmed"}`, http.StatusPaymentRequired)
		return
	}
	if paidUser != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "tier": tier})
}

// handlePaystackWebhook receives async Paystack events. Auth is the
// x-paystack-signature HMAC-SHA512 of the raw body — the secret is required,
// never optional. Payloads are re-verified via the API before fulfilling.
func (s *Server) handlePaystackWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"use POST"}`, http.StatusMethodNotAllowed)
		return
	}
	secret := paystackSecret(s)
	if secret == "" {
		http.Error(w, `{"error":"webhook not configured"}`, http.StatusServiceUnavailable)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"unreadable body"}`, http.StatusBadRequest)
		return
	}
	sig := r.Header.Get("x-paystack-signature")
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(raw)
	if !hmac.Equal([]byte(strings.ToLower(sig)), []byte(hex.EncodeToString(mac.Sum(nil)))) {
		http.Error(w, `{"error":"invalid signature"}`, http.StatusForbidden)
		return
	}
	var evt struct {
		Event string `json:"event"`
		Data  struct {
			ID        int64  `json:"id"`
			Reference string `json:"reference"`
			Customer  struct {
				Email string `json:"email"`
			} `json:"customer"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &evt); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	email := strings.ToLower(strings.TrimSpace(evt.Data.Customer.Email))
	// ponytail: dedup key prefers Paystack's event id, falls back to the
	// reference/email the handler actually acts on. A captured valid body
	// replayed forever is otherwise a free re-downgrade button.
	key := evt.Event + ":"
	switch {
	case evt.Data.ID != 0:
		key += strconv.FormatInt(evt.Data.ID, 10)
	case evt.Data.Reference != "":
		key += "ref:" + evt.Data.Reference
	case email != "":
		key += "email:" + email
	default:
		key += "noid"
	}
	fresh, err := s.db.RecordWebhookEvent(key)
	if err != nil {
		// Can't tell new from replay without the ledger — fail transient so
		// Paystack retries instead of us double-firing blind.
		log.Printf("[paystack] dedup write failed: %v", err)
		http.Error(w, `{"error":"try again"}`, http.StatusServiceUnavailable)
		return
	}
	if !fresh {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"received","duplicate":true}`))
		return
	}
	switch evt.Event {
	case "charge.success":
		if !paystackRefRe.MatchString(evt.Data.Reference) {
			http.Error(w, `{"error":"invalid reference"}`, http.StatusBadRequest)
			return
		}
		if _, _, err := s.fulfillPaid(evt.Data.Reference); err != nil {
			if paystackTransient(err) {
				// Provider/DB blip — release the dedup key and non-2xx so
				// Paystack's retry reprocesses instead of hitting duplicate.
				s.db.DeleteWebhookEvent(key)
				log.Printf("[paystack] webhook transient ref=%s: %v", evt.Data.Reference, err)
				http.Error(w, `{"error":"try again"}`, http.StatusBadGateway)
				return
			}
			// Permanent reject (amount mismatch etc.) — 200 so Paystack
			// stops retrying what retries can't fix. Log loud.
			log.Printf("[paystack] webhook fulfill failed ref=%s: %v", evt.Data.Reference, err)
		} else {
			log.Printf("[paystack] webhook fulfilled ref=%s", evt.Data.Reference)
		}
	case "subscription.disable":
		// No transaction reference here — attribute by customer email, and
		// only touch existing users (never auto-provision from webhooks).
		if email == "" {
			break
		}
		u, err := s.db.GetUserByEmail(email)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				log.Printf("[paystack] disable for unknown email")
				break
			}
			s.db.DeleteWebhookEvent(key)
			log.Printf("[paystack] disable lookup failed: %v", err)
			http.Error(w, `{"error":"try again"}`, http.StatusServiceUnavailable)
			return
		}
		if u == nil {
			log.Printf("[paystack] disable for unknown email")
			break
		}
		if err := s.db.SetSubscriptionTier(u.ID, "free"); err != nil {
			s.db.DeleteWebhookEvent(key)
			log.Printf("[paystack] downgrade failed user=%s: %v", u.ID, err)
			http.Error(w, `{"error":"try again"}`, http.StatusServiceUnavailable)
			return
		}
		log.Printf("[paystack] downgraded user=%s to free", u.ID)
	default:
		// subscription.create/enable, invoice.* etc. carry no new money
		// movement beyond charge.success — acknowledge and ignore.
		log.Printf("[paystack] ignored event %q", evt.Event)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"received"}`))
}

// handlePaystackRouter dispatches /paystack/verify/{reference}.
func (s *Server) handlePaystackRouter(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/paystack/verify/") {
		s.handlePaystackVerify(w, r)
		return
	}
	http.NotFound(w, r)
}
