package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// SessionRecord mirrors sessionlifecycle.Session without the import (keeps
// storage dependency-free of internal packages). Field names match 014.
type SessionRecord struct {
	ID             string
	Slug           string
	Status         string
	UserID         string
	Persona        string
	Source         string
	Note           string
	IdempotencyKey string
	RetryCount     int
	Error          string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// UpsertSession write-throughs one engine transition. Best-effort from the
// engine's perspective: callers log but never fail the transition on DB error.
func (d *DB) UpsertSession(s SessionRecord) error {
	if d.mockMode {
		return nil
	}
	_, err := d.db.Exec(`
		INSERT INTO sessions (id, slug, status, user_id, persona, source, note, idempotency_key, retry_count, error, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (id) DO UPDATE SET
			slug=EXCLUDED.slug, status=EXCLUDED.status, user_id=EXCLUDED.user_id,
			persona=EXCLUDED.persona, source=EXCLUDED.source, note=EXCLUDED.note,
			idempotency_key=EXCLUDED.idempotency_key, retry_count=EXCLUDED.retry_count,
			error=EXCLUDED.error, updated_at=EXCLUDED.updated_at
	`, s.ID, s.Slug, s.Status, s.UserID, s.Persona, s.Source, s.Note, s.IdempotencyKey, s.RetryCount, s.Error, s.CreatedAt, s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert session: %w", err)
	}
	return nil
}

// ListNonTerminalSessions returns created/queued/provisioning/running sessions
// for boot re-queue. Terminal rows stay as history / dead-letter.
func (d *DB) ListNonTerminalSessions() ([]SessionRecord, error) {
	if d.mockMode {
		return nil, nil
	}
	rows, err := d.db.Query(`
		SELECT id, slug, status, user_id, persona, source, note, idempotency_key, retry_count, error, created_at, updated_at
		FROM sessions WHERE status NOT IN ('completed','failed','stopped') ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	defer rows.Close()
	var out []SessionRecord
	for rows.Next() {
		var s SessionRecord
		if err := rows.Scan(&s.ID, &s.Slug, &s.Status, &s.UserID, &s.Persona, &s.Source, &s.Note, &s.IdempotencyKey, &s.RetryCount, &s.Error, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSession returns one session row, or (nil, nil) when absent.
func (d *DB) GetSession(id string) (*SessionRecord, error) {
	if d.mockMode {
		return nil, nil
	}
	var s SessionRecord
	err := d.db.QueryRow(`
		SELECT id, slug, status, user_id, persona, source, note, idempotency_key, retry_count, error, created_at, updated_at
		FROM sessions WHERE id = $1`, id).Scan(
		&s.ID, &s.Slug, &s.Status, &s.UserID, &s.Persona, &s.Source, &s.Note, &s.IdempotencyKey, &s.RetryCount, &s.Error, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}
	return &s, nil
}
