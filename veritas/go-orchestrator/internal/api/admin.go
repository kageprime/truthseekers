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
	var body adminSettingsReq
	if !getValidatedBody(r, &body) {
		http.Error(w, `{"error":"Missing validated body"}`, http.StatusInternalServerError)
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

// handleGetFeatured resolves the featured slug list (pinned admin picks
// first, then coordinator top-ups) to articles. Public read — the homepage
// hero rides this, never the admin-gated settings KV. Unresolvable slugs
// are skipped; the envelope is always an array, never null.
func (s *Server) handleGetFeatured(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "get featured")
	settings, err := s.db.GetSettings()
	if err != nil {
		http.Error(w, `{"error":"Failed to load settings"}`, http.StatusInternalServerError)
		return
	}
	var slugs []string
	if raw := settings["featured_articles"]; raw != "" {
		_ = json.Unmarshal([]byte(raw), &slugs)
	}
	out := make([]interface{}, 0, len(slugs))
	for _, slug := range slugs {
		if slug == "" {
			continue
		}
		a, err := s.db.GetArticle(slug)
		if err != nil || a == nil {
			continue
		}
		out = append(out, a)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
