package llmgateway

import "testing"

func TestMeterRecord(t *testing.T) {
	m := NewMeter(100)
	m.Record(UsageRecord{UserID: "user1", Model: "gpt-4", InputTokens: 100, OutputTokens: 50, TotalTokens: 150, Cost: 0.01})

	totals := m.GetUserTotals("user1")
	if totals.TotalTokens != 150 {
		t.Errorf("total tokens = %d, want 150", totals.TotalTokens)
	}
	if totals.CallCount != 1 {
		t.Errorf("call count = %d, want 1", totals.CallCount)
	}

	// Non-existent user.
	totals = m.GetUserTotals("nobody")
	if totals.CallCount != 0 {
		t.Errorf("expected 0 calls for unknown user, got %d", totals.CallCount)
	}
}

func TestMeterGetRecent(t *testing.T) {
	m := NewMeter(100)
	for i := 0; i < 10; i++ {
		m.Record(UsageRecord{UserID: "u", Model: "m", TotalTokens: i})
	}
	recent := m.GetRecent(3)
	if len(recent) != 3 {
		t.Errorf("expected 3 recent records, got %d", len(recent))
	}
	if recent[0].TotalTokens != 7 {
		t.Errorf("expected first recent to have totalTokens=7, got %d", recent[0].TotalTokens)
	}
}
