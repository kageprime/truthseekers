package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// handleMapsRoot handles GET /maps — list static + interactive maps with pagination.
func (s *Server) handleMapsRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	reqLog(r, "list maps")

	limit := 50
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}
	offset := 0
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o >= 0 {
		offset = o
	}

	// Request one extra to detect a next page without computing a full count.
	static, interactive, err := s.db.GetMaps(limit+1, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	combined := make([]*storage.MapEntry, 0, len(static)+len(interactive))
	combined = append(combined, static...)
	combined = append(combined, interactive...)

	hasMore := len(combined) > limit
	if hasMore {
		combined = combined[:limit]
	}
	var nextOffset *int
	if hasMore {
		nextVal := offset + limit
		nextOffset = &nextVal
	}

	// Re-split into static/interactive for the response envelope; the frontend
	// reads `data` (static) and `interactive` separately.
	respStatic := []interface{}{}
	respInteractive := []interface{}{}
	for _, m := range combined {
		if m.Type == "interactive" {
			respInteractive = append(respInteractive, m)
		} else {
			respStatic = append(respStatic, m)
		}
	}

	response := map[string]interface{}{
		"data":        respStatic,
		"interactive": respInteractive,
		"pagination": map[string]interface{}{
			"limit":      limit,
			"offset":     offset,
			"hasMore":    hasMore,
			"nextOffset": nextOffset,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleMapsDynamicRoute handles /maps/search and /maps/:slug.
func (s *Server) handleMapsDynamicRoute(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/maps/")
	path = strings.Trim(path, "/")
	if path == "" {
		s.handleMapsRoot(w, r)
		return
	}

	parts := strings.Split(path, "/")
	first := parts[0]

	// /maps/search?q=
	if first == "search" {
		if r.Method != "GET" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		s.handleSearchMaps(w, r)
		return
	}

	// Only single-segment paths are valid map slugs.
	if len(parts) != 1 {
		http.NotFound(w, r)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.handleGetMap(w, r, first)
}

func (s *Server) handleSearchMaps(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "search maps")
	q := r.URL.Query().Get("q")
	limit := 10
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}

	if q == "" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]"))
		return
	}

	maps, err := s.db.SearchMaps(q, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if maps == nil {
		maps = []*storage.MapEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(maps)
}

func (s *Server) handleGetMap(w http.ResponseWriter, r *http.Request, slug string) {
	reqLog(r, "get map slug=%s", slug)
	m, err := s.db.GetMap(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if m == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(fmt.Sprintf(`{"error": "Map not found", "slug": "%s"}`, slug)))
		return
	}

	// ETag/304 support — cheap pointer-based hash from updatedAt for cache hits.
	if m.UpdatedAt != "" {
		etag := `"` + m.UpdatedAt + `"`
		w.Header().Set("ETag", etag)
		if match := r.Header.Get("If-None-Match"); match != "" && strings.Contains(match, etag) {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}
