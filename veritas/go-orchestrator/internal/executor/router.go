package executor

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Handler wraps the Gateway with HTTP route handling.
type Handler struct {
	Gateway *Gateway
}

// RegisterRoutes mounts the executor routes on a ServeMux.
// NOTE: production Server mounts /v1/executor/call with auth middleware
// explicitly (see api/server.go) — this helper is for tests / standalone use.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/v1/executor/call", h.HandleCallHTTP)
	mux.HandleFunc("/v1/executor/connectors", h.handleListConnectors)
}

// HandleCallHTTP is the authed HTTP entry point for POST /v1/executor/call.
// It binds UserID from the request context set by api.authMiddleware
// ("userID" key) so callers cannot spoof another user's identity via body
// (CallInput.UserID is json:"-" and never decoded).
func (h *Handler) HandleCallHTTP(w http.ResponseWriter, r *http.Request) {
	h.handleCall(w, r)
}

func (h *Handler) handleCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var input CallInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	// ponytail: trust ctx only — body UserID is never decoded (json:"-").
	input.UserID = userIDFromCtx(r)
	input.SessionID = sessionIDFromCtx(r)

	result := h.Gateway.HandleCall(input)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *Handler) handleListConnectors(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"connectors":[]}`))
}

// ExtractUserID is a helper to extract user ID from request context.
// In dev mode this reads the Authorization header; in production it should
// read from the authenticated context set by IAM middleware.
func ExtractUserID(r *http.Request) string {
	if uid := userIDFromCtx(r); uid != "" {
		return uid
	}
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return "sandbox" // placeholder — real resolution through IAM middleware
	}
	return "anonymous"
}

// userIDFromCtx reads the "userID" set by api.authMiddleware. Same string key,
// no import cycle.
func userIDFromCtx(r *http.Request) string {
	if v := r.Context().Value("userID"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func sessionIDFromCtx(r *http.Request) string {
	if v := r.Context().Value("sessionID"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
