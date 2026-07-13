package llmgateway

import (
	"sync"
	"time"
)

// UsageRecord tracks a single LLM call for metering.
type UsageRecord struct {
	UserID       string    `json:"userId"`
	Model        string    `json:"model"`
	InputTokens  int       `json:"inputTokens"`
	OutputTokens int       `json:"outputTokens"`
	TotalTokens  int       `json:"totalTokens"`
	Cost         float64   `json:"cost"`
	Timestamp    time.Time `json:"timestamp"`
	SessionID    string    `json:"sessionId,omitempty"`
}

// Meter tracks LLM usage with an in-memory ring. In production this would be
// backed by the DB, but the in-memory version is sufficient for development
// and single-instance deployments.
// ponytail: in-memory only, no persistence. Add DB backing when multi-instance.
type Meter struct {
	mu       sync.RWMutex
	records  []UsageRecord
	capacity int
	totals   map[string]UserTotals // keyed by userID
}

// UserTotals aggregates usage per user.
type UserTotals struct {
	TotalTokens int
	TotalCost   float64
	CallCount   int
}

// NewMeter creates a usage meter with the given record capacity.
func NewMeter(capacity int) *Meter {
	if capacity <= 0 {
		capacity = 10000
	}
	return &Meter{
		records:  make([]UsageRecord, 0, capacity),
		capacity: capacity,
		totals:   make(map[string]UserTotals),
	}
}

// Record adds a usage record and updates totals.
func (m *Meter) Record(rec UsageRecord) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.records) >= m.capacity {
		// Drop oldest 10%.
		m.records = m.records[m.capacity/10:]
	}
	m.records = append(m.records, rec)

	t := m.totals[rec.UserID]
	t.TotalTokens += rec.TotalTokens
	t.TotalCost += rec.Cost
	t.CallCount++
	m.totals[rec.UserID] = t
}

// GetUserTotals returns aggregated usage for a user.
func (m *Meter) GetUserTotals(userID string) UserTotals {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.totals[userID]
}

// GetRecent returns the most recent N records.
func (m *Meter) GetRecent(n int) []UsageRecord {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if n <= 0 || n > len(m.records) {
		n = len(m.records)
	}
	start := len(m.records) - n
	if start < 0 {
		start = 0
	}
	out := make([]UsageRecord, n)
	copy(out, m.records[start:])
	return out
}
