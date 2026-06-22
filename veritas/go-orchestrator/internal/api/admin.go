package api

import (
	"encoding/json"
	"net/http"
)

// handleAdminSettings exposes the admin-configurable key/value store.
//
// Contract (matches packages/web/src/lib/api.ts):
//   GET  /admin/settings  → 200, body is the flat settings map, e.g.
//                            {"featured_articles":"[\"jfk-assassination\"]"}
//   PUT  /admin/settings  → 200, body {"settings": {key: value, ...}} upserts
//                            each key and returns the merged map.
//
// Settings are seeded from DefaultSettings() (see storage/db.go) so the
// frontend always sees `featured_articles` even when the DB is empty.
func (s *Server) handleAdminSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.getAdminSettings(w, r)
	case http.MethodPut:
		s.putAdminSettings(w, r)
	default:
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func (s *Server) getAdminSettings(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "get admin settings")
	settings, err := s.db.GetSettings()
	if err != nil {
		http.Error(w, `{"error":"Failed to load settings"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func (s *Server) putAdminSettings(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "update admin settings")
	var body struct {
		Settings map[string]string `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"Invalid JSON body"}`, http.StatusBadRequest)
		return
	}
	if len(body.Settings) == 0 {
		http.Error(w, `{"error":"No settings provided"}`, http.StatusBadRequest)
		return
	}

	if err := s.db.SaveSettings(body.Settings); err != nil {
		http.Error(w, `{"error":"Failed to save settings"}`, http.StatusInternalServerError)
		return
	}

	// Return the freshly merged map so the caller sees defaults + their writes.
	merged, err := s.db.GetSettings()
	if err != nil {
		merged = body.Settings
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(merged)
}
