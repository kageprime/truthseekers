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
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/v1/executor/call", h.handleCall)
	mux.HandleFunc("/v1/executor/connectors", h.handleListConnectors)
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
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return "sandbox" // placeholder — real resolution through IAM middleware
	}
	return "anonymous"
}
