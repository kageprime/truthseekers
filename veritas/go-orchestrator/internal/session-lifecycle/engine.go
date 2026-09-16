package sessionlifecycle

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"
)

const (
	maxRetries = 5
	maxActive  = 3
	// ponytail: unbounded queue piled memory on refresh bursts; 429 past this.
	maxQueue = 100
)

// ErrQueueFull signals backpressure overflow; handlers map it to 429.
var ErrQueueFull = errors.New("session queue full, retry later")

// Engine manages session lifecycle with state machine, backpressure, and retry.
// Sessions write through to Store (DB) on every transition; boot reloads
// non-terminal rows via Restore. Nil store = memory-only (tests, file mode).
type Engine struct {
	mu        sync.RWMutex
	sessions  map[string]*Session // sessionID → session
	bySlug    map[string]string   // slug → most recent sessionID
	byKey     map[string]string   // idempotencyKey → sessionID
	queue     []*Session          // FIFO queue for backpressured sessions
	active    int                 // Current running count
	processor Processor
	store     Store
	done      chan struct{}
	stopOnce  sync.Once
	wg        sync.WaitGroup
}

// NewEngine creates a memory-only session lifecycle engine.
func NewEngine(processor Processor) *Engine {
	return NewEngineWithStore(processor, nullStore{})
}

// NewEngineWithStore creates an engine that persists every transition.
func NewEngineWithStore(processor Processor, store Store) *Engine {
	if store == nil {
		store = nullStore{}
	}
	e := &Engine{
		sessions:  make(map[string]*Session),
		bySlug:    make(map[string]string),
		byKey:     make(map[string]string),
		processor: processor,
		store:     store,
		done:      make(chan struct{}),
	}
	go e.drainLoop()
	return e
}

// Restore re-queues non-terminal sessions after a restart. Anything that was
// provisioning/running is safely re-queued — the pipeline upserts, so a
// duplicate run converges instead of corrupting.
func (e *Engine) Restore(sessions []Session) {
	e.mu.Lock()
	var restored []Session
	for i := range sessions {
		s := sessions[i]
		if IsTerminal(s.Status) {
			continue
		}
		cp := s
		cp.Status = StatusQueued
		cp.UpdatedAt = time.Now()
		e.sessions[cp.ID] = &cp
		e.bySlug[cp.Slug] = cp.ID
		if cp.IdempotencyKey != "" {
			e.byKey[cp.IdempotencyKey] = cp.ID
		}
		e.queue = append(e.queue, &cp)
		restored = append(restored, cp)
		log.Printf("[session] restored %s (slug=%s, was=%s)", cp.ID, cp.Slug, s.Status)
	}
	e.mu.Unlock()
	for i := range restored {
		e.persist(&restored[i])
	}
	go e.drain()
}

// persist writes one session through to the store. Call WITHOUT holding e.mu
// (it does blocking I/O); pass a copy taken under lock.
func (e *Engine) persist(s *Session) {
	if err := e.store.Upsert(*s); err != nil {
		log.Printf("[session] persist %s: %v", s.ID, err)
	}
}

// CreateSession creates a new session with idempotency and backpressure.
func (e *Engine) CreateSession(cmd CreateCommand) (*Session, error) {
	e.mu.Lock()

	// Idempotency check.
	if cmd.IdempotencyKey != "" {
		if existingID, ok := e.byKey[cmd.IdempotencyKey]; ok {
			if s, ok := e.sessions[existingID]; ok {
				cp := *s
				e.mu.Unlock()
				return &cp, nil
			}
		}
	}

	// Dedup by slug: if the same slug is queued or running, return existing.
	if existingID, ok := e.bySlug[cmd.Slug]; ok {
		if s, ok := e.sessions[existingID]; ok {
			if s.Status == StatusQueued || s.Status == StatusProvisioning || s.Status == StatusRunning {
				e.mu.Unlock()
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
		Note:           cmd.Note,
		IdempotencyKey: cmd.IdempotencyKey,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	// Apply queue policy.
	backpressure := e.backpressureLocked()
	shouldQueue := backpressure.ShouldQueue
	if cmd.QueuePolicy == "always" {
		shouldQueue = true
	} else if cmd.QueuePolicy == "never" {
		shouldQueue = false
	}

	if shouldQueue && len(e.queue) >= maxQueue {
		e.mu.Unlock()
		return nil, ErrQueueFull
	}

	e.sessions[session.ID] = session
	e.bySlug[cmd.Slug] = session.ID
	if cmd.IdempotencyKey != "" {
		e.byKey[cmd.IdempotencyKey] = session.ID
	}

	startNow := false
	if shouldQueue {
		session.Status = StatusQueued
		e.queue = append(e.queue, session)
		log.Printf("[session] queued %s (slug=%s) — %s", session.ID, cmd.Slug, backpressure.Reason)
	} else {
		session.Status = StatusProvisioning
		e.active++
		e.wg.Add(1)
		startNow = true
	}
	cp := *session
	e.mu.Unlock()

	e.persist(&cp)
	if startNow {
		go e.runSession(session)
	}
	return &cp, nil
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

// ListSessions returns copies of all sessions, newest first.
func (e *Engine) ListSessions() []Session {
	e.mu.RLock()
	defer e.mu.RUnlock()
	out := make([]Session, 0, len(e.sessions))
	for _, s := range e.sessions {
		out = append(out, *s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

// Transition moves a session to a new status, validating the transition.
func (e *Engine) Transition(cmd TransitionCommand) error {
	e.mu.Lock()

	s, ok := e.sessions[cmd.SessionID]
	if !ok {
		e.mu.Unlock()
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
		e.mu.Unlock()
		return fmt.Errorf("invalid transition %s → %s", s.Status, cmd.ToStatus)
	}

	prev := s.Status
	s.Status = cmd.ToStatus
	s.UpdatedAt = time.Now()
	if cmd.Error != "" {
		s.Error = cmd.Error
	}

	log.Printf("[session] %s → %s (slug=%s)", s.ID, cmd.ToStatus, s.Slug)

	// Slot accounting: only provisioning/running hold a slot. Completing and
	// terminal states release it — exactly once (Running→Completing→Completed
	// must not double-decrement; Queued→Stopped must not decrement at all).
	// ponytail: the old code decremented on every completing/terminal arrival,
	// leaking the count negative on cancels and double on two-step completion.
	shouldDrain := false
	if cmd.ToStatus == StatusCompleting || IsTerminal(cmd.ToStatus) {
		if prev == StatusProvisioning || prev == StatusRunning {
			e.active--
		}
		if cmd.ToStatus == StatusFailed && s.RetryCount < maxRetries {
			s.RetryCount++
			s.Status = StatusQueued
			e.queue = append(e.queue, s)
			log.Printf("[session] queued %s for retry %d/%d", s.ID, s.RetryCount, maxRetries)
		}
		shouldDrain = true
	}
	cp := *s
	e.mu.Unlock()

	e.persist(&cp)
	if shouldDrain {
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

// Limits exposes the backpressure ceiling for ops surfaces.
func (e *Engine) Limits() (maxActiveSessions int) { return maxActive }

// QueueLimit exposes the real queue bound (not a duplicate of maxActive).
func (e *Engine) QueueLimit() int { return maxQueue }

// ListSessionsPaged returns newest-first sessions with limit/offset.
// limit <= 0 means all (callers should cap; /queue caps at 200).
func (e *Engine) ListSessionsPaged(limit, offset int) []Session {
	all := e.ListSessions()
	if offset >= len(all) {
		return []Session{}
	}
	all = all[offset:]
	if limit > 0 && limit < len(all) {
		all = all[:limit]
	}
	return all
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
	defer e.wg.Done()
	e.Transition(TransitionCommand{
		SessionID: session.ID,
		ToStatus:  StatusRunning,
	})

	err := e.processor(*session)

	// ponytail: two-step completion — Running→Completed is not a valid
	// transition (and never was, so sessions silently stuck at running).
	if err != nil {
		e.Transition(TransitionCommand{
			SessionID: session.ID,
			ToStatus:  StatusFailed,
			Error:     err.Error(),
		})
		return
	}
	if err := e.Transition(TransitionCommand{
		SessionID: session.ID,
		ToStatus:  StatusCompleting,
	}); err != nil {
		return
	}
	e.Transition(TransitionCommand{
		SessionID: session.ID,
		ToStatus:  StatusCompleted,
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
		e.wg.Add(1)
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

// Stop shuts down the drain loop and waits for in-flight sessions.
// Callers should bound this (main wraps shutdown in a timeout ctx).
func (e *Engine) Stop() {
	e.stopOnce.Do(func() { close(e.done) })
	e.wg.Wait()
}

func randID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	// RFC 4122 v4 bits (S27).
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return hex.EncodeToString(b[:4]) + "-" + hex.EncodeToString(b[4:8]) + "-" +
		hex.EncodeToString(b[8:12]) + "-" + hex.EncodeToString(b[12:14]) + "-" + hex.EncodeToString(b[14:])
}
