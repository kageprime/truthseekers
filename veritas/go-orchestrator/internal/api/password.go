package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// Password auth alongside OTP: register binds a password to an email only
// after proving inbox ownership with a valid OTP code; login checks the hash.

const minPasswordLen = 8

// handlePasswordRegister sets (or resets) the password for an email.
// Body: {"email","code","password"}. The OTP code is consumed.
func (s *Server) handlePasswordRegister(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "password register")
	var body struct {
		Email    string `json:"email"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Email, code and password required"}`, http.StatusBadRequest)
		return
	}
	email := normalizeEmail(body.Email)
	if email == "" || strings.TrimSpace(body.Code) == "" || len(body.Password) < minPasswordLen {
		http.Error(w, `{"error":"Valid email, code and 8+ character password required"}`, http.StatusBadRequest)
		return
	}
	if !s.db.VerifyOTP(email, strings.TrimSpace(body.Code)) {
		http.Error(w, `{"error":"Invalid or expired code"}`, http.StatusUnauthorized)
		return
	}
	if _, err := s.db.FindOrCreateUserByEmail(email); err != nil {
		http.Error(w, `{"error":"Registration failed"}`, http.StatusInternalServerError)
		return
	}
	hash, err := storage.HashPassword(body.Password)
	if err != nil {
		http.Error(w, `{"error":"Registration failed"}`, http.StatusInternalServerError)
		return
	}
	if err := s.db.SetPasswordHash(email, hash); err != nil {
		http.Error(w, `{"error":"Registration failed"}`, http.StatusInternalServerError)
		return
	}
	user, _ := s.db.FindOrCreateUserByEmail(email)
	token := issueToken(user.ID, user.Role)
	userData, _ := json.Marshal(user)
	reqLog(r, "password register email=%s", email)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"token":%q,"user":%s}`, token, string(userData))))
}

// handlePasswordLogin exchanges email+password for a JWT.
func (s *Server) handlePasswordLogin(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "password login")
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Email and password required"}`, http.StatusBadRequest)
		return
	}
	email := normalizeEmail(body.Email)
	if email == "" || body.Password == "" {
		http.Error(w, `{"error":"Email and password required"}`, http.StatusBadRequest)
		return
	}
	hash, err := s.db.GetPasswordHash(email)
	if err == sql.ErrNoRows || hash == "" {
		// ponytail: same message either way — no account-enumeration oracle.
		http.Error(w, `{"error":"Invalid email or password"}`, http.StatusUnauthorized)
		return
	}
	if err != nil || !storage.VerifyPasswordHash(hash, body.Password) {
		http.Error(w, `{"error":"Invalid email or password"}`, http.StatusUnauthorized)
		return
	}
	user, err := s.db.FindOrCreateUserByEmail(email)
	if err != nil {
		http.Error(w, `{"error":"Login failed"}`, http.StatusInternalServerError)
		return
	}
	token := issueToken(user.ID, user.Role)
	userData, _ := json.Marshal(user)
	reqLog(r, "password login email=%s", email)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"token":%q,"user":%s}`, token, string(userData))))
}
