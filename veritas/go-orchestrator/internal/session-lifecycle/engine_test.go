package sessionlifecycle

import (
	"fmt"
	"testing"
	"time"
)

func TestValidTransitions(t *testing.T) {
	transitions := ValidTransitions()
	tests := []struct {
		from Status
		to   Status
		want bool
	}{
		{StatusCreated, StatusQueued, true},
		{StatusCreated, StatusProvisioning, true},
		{StatusCreated, StatusCompleted, false},
		{StatusRunning, StatusCompleting, true},
		{StatusRunning, StatusFailed, true},
		{StatusRunning, StatusStopped, true},
		{StatusRunning, StatusCreated, false},
		{StatusCompleted, StatusRunning, false}, // terminal
		{StatusFailed, StatusQueued, false},      // terminal
	}
	for _, tc := range tests {
		allowed := transitions[tc.from]
		found := false
		for _, a := range allowed {
			if a == tc.to {
				found = true
				break
			}
		}
		if found != tc.want {
			t.Errorf("transition %s → %s: allowed=%v, want=%v", tc.from, tc.to, found, tc.want)
		}
	}
}

func TestIsTerminal(t *testing.T) {
	if !IsTerminal(StatusCompleted) {
		t.Error("expected completed to be terminal")
	}
	if !IsTerminal(StatusFailed) {
		t.Error("expected failed to be terminal")
	}
	if !IsTerminal(StatusStopped) {
		t.Error("expected stopped to be terminal")
	}
	if IsTerminal(StatusRunning) {
		t.Error("expected running not to be terminal")
	}
}

func TestCreateSession(t *testing.T) {
	e := NewEngine(func(s Session) error {
		return nil
	})
	defer e.Stop()

	s, err := e.CreateSession(CreateCommand{
		Slug:   "test-article",
		UserID: "user1",
		Source: "ui",
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if s.Status != StatusProvisioning {
		t.Errorf("expected provisioning, got %s", s.Status)
	}

	// Idempotency.
	s2, err := e.CreateSession(CreateCommand{
		Slug:           "test-article-2",
		UserID:         "user1",
		Source:         "ui",
		IdempotencyKey: "key-1",
	})
	if err != nil {
		t.Fatalf("create session with idempotency key: %v", err)
	}

	s3, err := e.CreateSession(CreateCommand{
		Slug:           "test-article-3",
		UserID:         "user1",
		Source:         "ui",
		IdempotencyKey: "key-1", // same key
	})
	if err != nil {
		t.Fatalf("idempotent create: %v", err)
	}
	if s3.ID != s2.ID {
		t.Errorf("idempotency: expected same session ID, got %s vs %s", s3.ID, s2.ID)
	}
}

func TestDedupBySlug(t *testing.T) {
	e := NewEngine(func(s Session) error {
		time.Sleep(100 * time.Millisecond)
		return nil
	})
	defer e.Stop()

	_, err := e.CreateSession(CreateCommand{Slug: "same-slug", UserID: "u1", Source: "ui"})
	if err != nil {
		t.Fatalf("first create: %v", err)
	}

	_, err = e.CreateSession(CreateCommand{Slug: "same-slug", UserID: "u1", Source: "ui"})
	if err == nil {
		t.Error("expected error for duplicate slug, got nil")
	}
}

func TestBackpressure(t *testing.T) {
	e := NewEngine(func(s Session) error {
		time.Sleep(500 * time.Millisecond)
		return nil
	})
	defer e.Stop()

	// Fill active slots.
	for i := 0; i < maxActive; i++ {
		_, err := e.CreateSession(CreateCommand{
			Slug:   fmt.Sprintf("slug-%d", i),
			UserID: "u1", Source: "ui",
		})
		if err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}

	// This one should be queued.
	s, err := e.CreateSession(CreateCommand{
		Slug:   "queued-slug",
		UserID: "u1", Source: "ui",
	})
	if err != nil {
		t.Fatalf("create queued: %v", err)
	}
	if s.Status != StatusQueued {
		t.Errorf("expected queued status, got %s", s.Status)
	}

	bp := e.BackpressureState()
	if !bp.ShouldQueue {
		t.Error("expected backpressure to indicate queue")
	}
}
