package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/coordinator"
	sessionlifecycle "github.com/kageprime/veritas/go-orchestrator/internal/session-lifecycle"
)

// runCoordinatorOnce executes a coordination pass: featured scoring +
// stalest refresh queue. force bypasses the daily ceiling.
func (s *Server) runCoordinatorOnce(force bool) coordinator.Result {
	return coordinator.Run(s.db, func(slug string) error {
		_, err := s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
			Slug:    slug,
			Persona: "veritas",
			Source:  "trigger:coordinator",
		})
		return err
	}, force)
}

// handleCoordinatorStatus reports the last run audit, today's budget, and
// the next scheduled fire. Admin-only (ops internals).
func (s *Server) handleCoordinatorStatus(w http.ResponseWriter, r *http.Request) {
	reqLog(r, "coordinator status")
	settings, err := s.db.GetSettings()
	if err != nil {
		http.Error(w, `{"error":"settings unreadable"}`, http.StatusInternalServerError)
		return
	}
	var lastRun interface{}
	if raw := settings["coordinator_last_run"]; raw != "" {
		var v interface{}
		if json.Unmarshal([]byte(raw), &v) == nil {
			lastRun = v
		} else {
			lastRun = raw
		}
	}
	today := time.Now().UTC().Format("2006-01-02")
	count := 0
	if settings["coordinator_date"] == today {
		fmt.Sscanf(settings["coordinator_count"], "%d", &count)
	}
	paused := settings["seed_paused"] == "1"
	writeSeedJSON(w, map[string]interface{}{
		"paused":    paused,
		"schedule":  coordinator.Schedule,
		"next_tick": coordinator.NextTick(time.Now()).UTC().Format(time.RFC3339),
		"today":     map[string]interface{}{"date": today, "count": count, "limit": coordinator.DailyLimit},
		"last_run":  lastRun,
	})
}

// handleCoordinatorRun executes a pass immediately. Honors the pause flag
// and the daily ceiling unless ?force=1 (explicit admin override).
func (s *Server) handleCoordinatorRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"use POST"}`, http.StatusMethodNotAllowed)
		return
	}
	force := r.URL.Query().Get("force") == "1"
	res := s.runCoordinatorOnce(force)
	reqLog(r, "coordinator-run featured=%d stale=%s force=%t", len(res.Featured), res.StaleQueued, force)
	writeSeedJSON(w, res)
}
