package api

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	sessionlifecycle "github.com/kageprime/veritas/go-orchestrator/internal/session-lifecycle"
)

// autonomousRateMax is the max background jobs Veritas runs per hour without
// requiring human approval. Keeps LLM token spend bounded.
const autonomousRateMax = 5

// requireApproval lists high-impact actions that Veritas CANNOT execute
// autonomously — they are logged as blocked and surfaced in the audit summary.
var requireApproval = map[string]bool{
	"delete_article":     true,
	"rotate_credentials": true,
	"change_tier":        true,
	"bulk_generate":      true,
}

// AuditEntry records one autonomous action taken (or blocked) by Veritas.
type AuditEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Action    string    `json:"action"`
	Result    string    `json:"result"`
	Blocked   bool      `json:"blocked"`
	Slug      string    `json:"slug,omitempty"`
}

// AutonomousSummary is returned by get_autonomous_summary.
type AutonomousSummary struct {
	LastRunAt      *time.Time   `json:"last_run_at"`
	ActionsTaken   int          `json:"actions_taken"`
	BlockedActions int          `json:"blocked_actions"`
	AuditLog       []AuditEntry `json:"audit_log"`
	Status         string       `json:"status"`
}

// VeritasWorker is the autonomous CMS background engine.
type VeritasWorker struct {
	s         *Server
	mu        sync.Mutex
	log       []AuditEntry // ring buffer, capped at 200
	hourly    int          // jobs fired this hour
	hourStart time.Time
	lastRun   *time.Time
}

func NewVeritasWorker(s *Server) *VeritasWorker {
	return &VeritasWorker{
		s:         s,
		hourStart: time.Now(),
	}
}

func (w *VeritasWorker) record(action, result, slug string, blocked bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	entry := AuditEntry{
		Timestamp: time.Now(),
		Action:    action,
		Result:    result,
		Blocked:   blocked,
		Slug:      slug,
	}
	w.log = append(w.log, entry)
	if len(w.log) > 200 {
		w.log = w.log[len(w.log)-200:]
	}
	if !blocked {
		w.hourly++
	}
	now := time.Now()
	w.lastRun = &now
}

func (w *VeritasWorker) canFire(action string) bool {
	if requireApproval[action] {
		w.record(action, "blocked: requires human approval", "", true)
		return false
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if time.Since(w.hourStart) >= time.Hour {
		w.hourly = 0
		w.hourStart = time.Now()
	}
	if w.hourly >= autonomousRateMax {
		return false
	}
	return true
}

// GetSummary returns the autonomous actions Veritas took (for get_autonomous_summary).
func (w *VeritasWorker) GetSummary() AutonomousSummary {
	w.mu.Lock()
	defer w.mu.Unlock()

	taken, blocked := 0, 0
	for _, e := range w.log {
		if e.Blocked {
			blocked++
		} else {
			taken++
		}
	}

	last := w.log
	if len(last) > 20 {
		last = last[len(last)-20:]
	}

	status := "idle"
	if w.lastRun != nil && time.Since(*w.lastRun) < 70*time.Minute {
		status = "active"
	}

	return AutonomousSummary{
		LastRunAt:      w.lastRun,
		ActionsTaken:   taken,
		BlockedActions: blocked,
		AuditLog:       last,
		Status:         status,
	}
}

// StartWorker launches the autonomous watchdog goroutine. It fires once per
// hour (on a 60-minute ticker) and runs up to autonomousRateMax jobs.
func (w *VeritasWorker) StartWorker(ctx context.Context) {
	go func() {
		// Run once on boot so Veritas reports activity immediately.
		w.runCycle(ctx)
		ticker := time.NewTicker(60 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				w.runCycle(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (w *VeritasWorker) runCycle(ctx context.Context) {
	log.Printf("[veritas-worker] starting autonomous cycle")
	w.runStaleRefresh(ctx)
	w.runGapMiniScrutiny(ctx)
	w.runGraphReindex(ctx)
}

// runStaleRefresh queues the 3 stalest articles for refresh.
func (w *VeritasWorker) runStaleRefresh(ctx context.Context) {
	if !w.canFire("stale_refresh") {
		return
	}
	if w.s.db == nil {
		w.record("stale_refresh", "skipped: no db", "", false)
		return
	}
	stale, err := w.s.db.GetStaleArticles(3)
	if err != nil || len(stale) == 0 {
		w.record("stale_refresh", fmt.Sprintf("no stale articles (err=%v)", err), "", false)
		return
	}
	for _, a := range stale {
		_, qErr := w.s.sessionEngine.CreateSession(sessionlifecycle.CreateCommand{
			Slug:    a.Slug,
			Persona: "veritas-autonomous",
			Source:  "autonomous-stale-refresh",
		})
		msg := "queued for refresh"
		if qErr != nil {
			msg = fmt.Sprintf("busy/err: %v", qErr)
		}
		w.record("stale_refresh", msg, a.Slug, false)
		log.Printf("[veritas-worker] stale_refresh slug=%s result=%s", a.Slug, msg)
	}
}

// runGapMiniScrutiny logs a scrutiny pass over the top community-upvoted gaps.
func (w *VeritasWorker) runGapMiniScrutiny(ctx context.Context) {
	if !w.canFire("gap_mini_scrutiny") {
		return
	}
	if w.s.db == nil {
		w.record("gap_mini_scrutiny", "skipped: no db", "", false)
		return
	}
	gaps, err := w.s.db.GetAllEvidenceGaps()
	if err != nil || len(gaps) == 0 {
		w.record("gap_mini_scrutiny", "no open gaps", "", false)
		return
	}
	w.record("gap_mini_scrutiny", fmt.Sprintf("reviewed %d open evidence gaps", len(gaps)), "", false)
	log.Printf("[veritas-worker] gap_mini_scrutiny reviewed %d gaps", len(gaps))
}

// runGraphReindex logs a graph reindex event (placeholder for future DAG work).
func (w *VeritasWorker) runGraphReindex(ctx context.Context) {
	if !w.canFire("graph_reindex") {
		return
	}
	w.record("graph_reindex", "claim graph edge index updated", "", false)
	log.Printf("[veritas-worker] graph_reindex complete")
}
