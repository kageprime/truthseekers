package api

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// OTP email login (S1): /auth/login and /auth/otp/request email a 6-digit
// code via Resend; /auth/otp/verify exchanges it for a JWT. No password, no
// magic-link token to phish — codes expire in 10 minutes with 5 attempts.

// genOTPCode returns a zero-padded 6-digit code from crypto/rand.
func genOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// sendOTPEmail delivers the code via Resend. Without RESEND_API_KEY it logs
// the code and succeeds only under ALLOW_DEV_AUTH=1 (local dev).
func sendOTPEmail(to, code string) error {
	key := os.Getenv("RESEND_API_KEY")
	if key == "" {
		if os.Getenv("ALLOW_DEV_AUTH") == "1" {
			log.Printf("[otp] DEV code for %s: %s", to, code)
			return nil
		}
		return fmt.Errorf("email not configured")
	}
	from := os.Getenv("RESEND_FROM")
	if from == "" {
		from = "Truthseekers <onboarding@resend.dev>"
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"from":    from,
		"text":    fmt.Sprintf("Your Truthseekers login code is %s. It expires in 10 minutes.", code),
		"subject": fmt.Sprintf("%s is your Truthseekers code", code),
		"to":      []string{to},
	})
	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("resend %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// requestOTPCode generates, stores, and emails a login code. Shared by
// /auth/login (legacy route, now OTP-only) and /auth/otp/request.
func (s *Server) requestOTPCode(w http.ResponseWriter, r *http.Request) {
	var body struct{ Email string `json:"email"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Email required"}`, http.StatusBadRequest)
		return
	}
	email := normalizeEmail(body.Email)
	if !strings.Contains(email, "@") {
		http.Error(w, `{"error":"Valid email required"}`, http.StatusBadRequest)
		return
	}

	code, err := genOTPCode()
	if err != nil {
		reqLog(r, "otp gen error: %v", err)
		http.Error(w, `{"error":"Login failed"}`, http.StatusInternalServerError)
		return
	}
	if err := s.db.CreateOTP(email, storage.HashOTPCode(code), storage.OTPTTL); err != nil {
		reqLog(r, "otp store error: %v", err)
		http.Error(w, `{"error":"Login failed"}`, http.StatusInternalServerError)
		return
	}
	if err := sendOTPEmail(email, code); err != nil {
		reqLog(r, "otp send error: %v", err)
		if err.Error() == "email not configured" {
			http.Error(w, `{"error":"Email login unavailable"}`, http.StatusServiceUnavailable)
		} else {
			http.Error(w, `{"error":"Could not send code"}`, http.StatusBadGateway)
		}
		return
	}
	reqLog(r, "otp sent email=%s", email)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"sent":true}`))
}

func (s *Server) handleOTPRequest(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "otp request")
	s.requestOTPCode(w, r)
}

func (s *Server) handleOTPVerify(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "otp verify")
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Email and code required"}`, http.StatusBadRequest)
		return
	}
	email := normalizeEmail(body.Email)
	if email == "" || strings.TrimSpace(body.Code) == "" {
		http.Error(w, `{"error":"Email and code required"}`, http.StatusBadRequest)
		return
	}
	if !s.db.VerifyOTP(email, strings.TrimSpace(body.Code)) {
		reqLog(r, "otp verify failed email=%s", email)
		http.Error(w, `{"error":"Invalid or expired code"}`, http.StatusUnauthorized)
		return
	}
	user, err := s.db.FindOrCreateUserByEmail(email)
	if err != nil {
		reqLog(r, "otp login db error: %v", err)
		http.Error(w, `{"error":"Login failed"}`, http.StatusInternalServerError)
		return
	}
	token := issueToken(user.ID, user.Role)
	userData, _ := json.Marshal(user)
	reqLog(r, "otp login email=%s", email)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"token":%q,"user":%s}`, token, string(userData))))
}
