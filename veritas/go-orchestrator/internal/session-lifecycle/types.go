package sessionlifecycle

import "time"

// ── Status ──────────────────────────────────────────────────

type Status string

const (
	StatusCreated      Status = "created"
	StatusQueued       Status = "queued"
	StatusProvisioning Status = "provisioning"
	StatusRunning      Status = "running"
	StatusCompleting   Status = "completing"
	StatusCompleted    Status = "completed"
	StatusFailed       Status = "failed"
	StatusStopped      Status = "stopped"
)

// ValidTransitions checks if a status transition is allowed.
func ValidTransitions() map[Status][]Status {
	return map[Status][]Status{
		StatusCreated:      {StatusQueued, StatusProvisioning},
		StatusQueued:       {StatusProvisioning, StatusFailed, StatusStopped},
		StatusProvisioning: {StatusRunning, StatusFailed, StatusStopped},
		StatusRunning:      {StatusCompleting, StatusFailed, StatusStopped},
		StatusCompleting:   {StatusCompleted, StatusFailed, StatusStopped},
		StatusCompleted:    {}, // Terminal
		StatusFailed:       {}, // Terminal
		StatusStopped:      {}, // Terminal
	}
}

// IsTerminal returns true if the status is a terminal state.
func IsTerminal(s Status) bool {
	return s == StatusCompleted || s == StatusFailed || s == StatusStopped
}

// ── Session ─────────────────────────────────────────────────

type Session struct {
	ID             string    `json:"id"`
	Slug           string    `json:"slug"`
	Status         Status    `json:"status"`
	UserID         string    `json:"userId"`
	Persona        string    `json:"persona"`
	Source         string    `json:"source"` // "ui", "cli", "trigger:cron", etc.
	IdempotencyKey string    `json:"idempotencyKey,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
	Error          string    `json:"error,omitempty"`
	RetryCount     int       `json:"retryCount"`
}

// ── Commands ────────────────────────────────────────────────

type CreateCommand struct {
	Slug           string `json:"slug"`
	UserID         string `json:"userId"`
	Persona        string `json:"persona"`
	Source         string `json:"source"`         // "ui", "cli", "slack", "trigger:cron"
	IdempotencyKey string `json:"idempotencyKey"` // Prevent duplicates
	QueuePolicy    string `json:"queuePolicy"`    // "never", "on_backpressure", "always"
}

type TransitionCommand struct {
	SessionID string `json:"sessionId"`
	ToStatus  Status `json:"toStatus"`
	Error     string `json:"error,omitempty"`
}

// ── Backpressure ────────────────────────────────────────────

type BackpressureState struct {
	ShouldQueue    bool   `json:"shouldQueue"`
	Reason         string `json:"reason,omitempty"`
	ActiveSessions int    `json:"activeSessions"`
	Limit          int    `json:"limit"`
}

// ── Worker ──────────────────────────────────────────────────

// Processor is the function that actually executes the session work
// (e.g., running the DAG pipeline).
type Processor func(session Session) error
