package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// Username+password signup with email activation. The activation code reuses
// the OTP store/sender; accounts start inactive and cannot password-login
// until activated. OTP code login is unaffected (inbox proof by definition).

// handleSignup creates an inactive account and emails the activation code.
// Body: {"username","email","password"} → {"sent":true}.
func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "signup")
	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Username, email and password required"}`, http.StatusBadRequest)
		return
	}
	username := strings.TrimSpace(body.Username)
	email := normalizeEmail(body.Email)
	if !storage.ValidUsername(username) || !strings.Contains(email, "@") || len(body.Password) < minPasswordLen {
		http.Error(w, `{"error":"Username (3-30 letters/numbers/_/-), valid email and 8+ character password required"}`, http.StatusBadRequest)
		return
	}
	hash, err := storage.HashPassword(body.Password)
	if err != nil {
		http.Error(w, `{"error":"Signup failed"}`, http.StatusInternalServerError)
		return
	}
	if _, err := s.db.CreateInactiveUser(username, email, hash); err != nil {
		if errors.Is(err, storage.ErrTaken) {
			http.Error(w, `{"error":"Email or username taken"}`, http.StatusConflict)
		} else {
			reqLog(r, "signup db error: %v", err)
			http.Error(w, `{"error":"Signup failed"}`, http.StatusInternalServerError)
		}
		return
	}
	code, err := genOTPCode()
	if err != nil {
		http.Error(w, `{"error":"Signup failed"}`, http.StatusInternalServerError)
		return
	}
	if err := s.db.CreateOTP(email, storage.HashOTPCode(code), storage.OTPTTL); err != nil {
		http.Error(w, `{"error":"Signup failed"}`, http.StatusInternalServerError)
		return
	}
	if err := sendOTPEmail(email, code); err != nil {
		reqLog(r, "signup send error: %v", err)
		http.Error(w, `{"error":"Could not send activation code"}`, http.StatusBadGateway)
		return
	}
	reqLog(r, "signup email=%s username=%s", email, username)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"sent":true}`))
}

// handleSignupActivate consumes the activation code and issues the first JWT.
// Body: {"email","code"}.
func (s *Server) handleSignupActivate(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "signup activate")
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
		http.Error(w, `{"error":"Invalid or expired code"}`, http.StatusUnauthorized)
		return
	}
	if err := s.db.SetActivated(email, true); err == sql.ErrNoRows {
		http.Error(w, `{"error":"Account not found"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"Activation failed"}`, http.StatusInternalServerError)
		return
	}
	user, err := s.db.FindOrCreateUserByEmail(email)
	if err != nil {
		http.Error(w, `{"error":"Activation failed"}`, http.StatusInternalServerError)
		return
	}
	token := issueToken(user.ID, user.Role)
	userData, _ := json.Marshal(user)
	reqLog(r, "signup activated email=%s", email)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"token":%q,"user":%s}`, token, string(userData))))
}
