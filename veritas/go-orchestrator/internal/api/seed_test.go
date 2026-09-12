package api

import (
	"testing"
	"time"
)

func TestNextSeedTick(t *testing.T) {
	cases := []struct {
		now  string
		want string
	}{
		{"2026-09-12T05:00:00Z", "2026-09-12T06:00:00Z"},
		{"2026-09-12T06:00:00Z", "2026-09-12T12:00:00Z"}, // exactly on fire → next slot
		{"2026-09-12T18:00:01Z", "2026-09-13T00:00:00Z"}, // rolls to tomorrow
		{"2026-09-12T23:59:59Z", "2026-09-13T00:00:00Z"},
	}
	for _, c := range cases {
		now, _ := time.Parse(time.RFC3339, c.now)
		if got := nextSeedTick(now).UTC().Format(time.RFC3339); got != c.want {
			t.Errorf("nextSeedTick(%s) = %s, want %s", c.now, got, c.want)
		}
	}
}
