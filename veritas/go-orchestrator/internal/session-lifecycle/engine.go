package sessionlifecycle

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"
)

const (
	maxRetries = 5
	maxActive  = 3
)

// Engine manages session lifecycle with state machine, backpressure, and retry.
// ponytail: in-memory only, single-process. Add DB backing and multi-instance
// coordination (Redis) when horizontal scaling is needed.
type Engine struct {
	mu         sync.RWMutex
	sessions   map[string]*Session        // sessionID → session
	bySlug     map[string]string          // slug → most recent sessionID
	byKey      map[string]string          // idempotencyKey → sessionID
	queue      []*Session                 // FIFO queue for backpressured sessions
	active     int                        // Current running count
	processor  Processor
	done       chan struct{}
}

// NewEngine creates a session lifecycle engine.
func NewEngine(processor Processor) *Engine {
	e := &Engine{
		sessions:  make(map[string]*Session),
		bySlug:    make(map[string]string),
		byKey:     make(map[string]string),
		processor: processor,
		done:      make(chan struct{}),
	}
	go e.drainLoop()
	return e
}

// CreateSession creates a new session with idempotency and backpressure.
func (e *Engine) CreateSession(cmd CreateCommand) (*Session, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Idempotency check.
	if cmd.IdempotencyKey != "" {
		if existingID, ok := e.byKey[cmd.IdempotencyKey]; ok {
			if s, ok := e.sessions[existingID]; ok {
				return s, nil
			}
		}
	}

	// Dedup by slug: if the same slug is queued or running, return existing.
	if existingID, ok := e.bySlug[cmd.Slug]; ok {
		if s, ok := e.sessions[existingID]; ok {
			if s.Status == StatusQueued || s.Status == StatusProvisioning || s.Status == StatusRunning {
				return nil, fmt.Errorf("session already active for slug %q (status=%s)", cmd.Slug, s.Status)
			}
		}
	}

	session := &Session{
		ID:             randID(),
		Slug:           cmd.Slug,
		Status:         StatusCreated,
		UserID:         cmd.UserID,
		Persona:        cmd.Persona,
		Source:         cmd.Source,
		IdempotencyKey: cmd.IdempotencyKey,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	e.sessions[session.ID] = session
	e.bySlug[cmd.Slug] = session.ID
	if cmd.IdempotencyKey != "" {
		e.byKey[cmd.IdempotencyKey] = session.ID
	}

	// Apply queue policy.
	backpressure := e.backpressureLocked()
	shouldQueue := backpressure.ShouldQueue
	if cmd.QueuePolicy == "always" {
		shouldQueue = true
	} else if cmd.QueuePolicy == "never" {
		shouldQueue = false
	}

	if shouldQueue {
		session.Status = StatusQueued
		e.queue = append(e.queue, session)
		log.Printf("[session] queued %s (slug=%s) — %s", session.ID, cmd.Slug, backpressure.Reason)
	} else {
		session.Status = StatusProvisioning
		e.active++
		go e.runSession(session)
	}

	return session, nil
}

// GetSession returns a session by ID.
func (e *Engine) GetSession(id string) *Session {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.sessions[id]
}

// GetSessionBySlug returns the most recent session for a slug.
func (e *Engine) GetSessionBySlug(slug string) *Session {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if id, ok := e.bySlug[slug]; ok {
		return e.sessions[id]
	}
	return nil
}

// Transition moves a session to a new status, validating the transition.
func (e *Engine) Transition(cmd TransitionCommand) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	s, ok := e.sessions[cmd.SessionID]
	if !ok {
		return fmt.Errorf("session %q not found", cmd.SessionID)
	}

	allowed := ValidTransitions()[s.Status]
	valid := false
	for _, a := range allowed {
		if a == cmd.ToStatus {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid transition %s → %s", s.Status, cmd.ToStatus)
	}

	s.Status = cmd.ToStatus
	s.UpdatedAt = time.Now()
	if cmd.Error != "" {
		s.Error = cmd.Error
	}

	log.Printf("[session] %s → %s (slug=%s)", s.ID, cmd.ToStatus, s.Slug)

	// If completing or failed, reduce active count and drain next.
	if cmd.ToStatus == StatusCompleting || IsTerminal(cmd.ToStatus) {
		e.active--
		if cmd.ToStatus == StatusFailed && s.RetryCount < maxRetries {
			s.RetryCount++
			s.Status = StatusQueued
			e.queue = append(e.queue, s)
			log.Printf("[session] queued %s for retry %d/%d", s.ID, s.RetryCount, maxRetries)
		}
		go e.drain()
	}

	return nil
}

// BackpressureState returns the current backpressure status.
func (e *Engine) BackpressureState() BackpressureState {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.backpressureLocked()
}

// Stats returns current counts.
func (e *Engine) Stats() (active int, queued int) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.active, len(e.queue)
}

// ── Internal ────────────────────────────────────────────────

func (e *Engine) backpressureLocked() BackpressureState {
	if e.active >= maxActive {
		return BackpressureState{
			ShouldQueue:    true,
			Reason:         fmt.Sprintf("max active sessions reached (%d/%d)", e.active, maxActive),
			ActiveSessions: e.active,
			Limit:          maxActive,
		}
	}
	return BackpressureState{
		ShouldQueue:    false,
		ActiveSessions: e.active,
		Limit:          maxActive,
	}
}

func (e *Engine) runSession(session *Session) {
	e.Transition(TransitionCommand{
		SessionID: session.ID,
		ToStatus:  StatusRunning,
	})

	err := e.processor(*session)

	toStatus := StatusCompleted
	errMsg := ""
	if err != nil {
		toStatus = StatusFailed
		errMsg = err.Error()
	}
	e.Transition(TransitionCommand{
		SessionID: session.ID,
		ToStatus:  toStatus,
		Error:     errMsg,
	})
}

func (e *Engine) drain() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.drainLocked()
}

func (e *Engine) drainLocked() {
	for e.active < maxActive && len(e.queue) > 0 {
		session := e.queue[0]
		e.queue = e.queue[1:]
		session.Status = StatusProvisioning
		e.active++
		go e.runSession(session)
	}
}

func (e *Engine) drainLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-e.done:
			return
		case <-ticker.C:
			e.drain()
		}
	}
}

// Stop shuts down the drain loop.
func (e *Engine) Stop() {
	close(e.done)
}

func randID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:4]) + "-" + hex.EncodeToString(b[4:8]) + "-" +
		hex.EncodeToString(b[8:12]) + "-" + hex.EncodeToString(b[12:14]) + "-" + hex.EncodeToString(b[14:])
}
