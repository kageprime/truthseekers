package triggers

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// matchCron reports whether a 5-field cron expression matches the given time t.
// Fields: minute hour day month weekday (0 or 7 = Sunday). Each field supports
// a single value, comma list (1,3,5), range (1-5), step (*/2), or *.
func matchCron(expr string, t time.Time) (bool, error) {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return false, fmt.Errorf("cron: need 5 fields, got %d in %q", len(fields), expr)
	}
	values := []int{t.Minute(), t.Hour(), t.Day(), int(t.Month()), int(t.Weekday())}
	for i, field := range fields {
		if !matchField(field, values[i]) {
			return false, nil
		}
	}
	return true, nil
}

func matchField(pattern string, value int) bool {
	// Handle comma-separated alternatives
	for _, part := range strings.Split(pattern, ",") {
		part = strings.TrimSpace(part)
		if matchSingle(part, value) {
			return true
		}
	}
	return false
}

func matchSingle(pattern string, value int) bool {
	// Handle step: */2, 1-10/3
	if slashIdx := strings.IndexByte(pattern, '/'); slashIdx >= 0 {
		step, err := strconv.Atoi(pattern[slashIdx+1:])
		if err != nil || step <= 0 {
			return false
		}
		rangePart := pattern[:slashIdx]
		low, high := 0, 59
		if rangePart != "*" {
			if dashIdx := strings.IndexByte(rangePart, '-'); dashIdx >= 0 {
				low, _ = strconv.Atoi(rangePart[:dashIdx])
				high, _ = strconv.Atoi(rangePart[dashIdx+1:])
			} else {
				low, _ = strconv.Atoi(rangePart)
				high = low
			}
		}
		if value < low || value > high {
			return false
		}
		return (value-low)%step == 0
	}

	// Handle wildcard
	if pattern == "*" {
		return true
	}
	// Handle range: 1-5
	if dashIdx := strings.IndexByte(pattern, '-'); dashIdx >= 0 {
		low, err1 := strconv.Atoi(pattern[:dashIdx])
		high, err2 := strconv.Atoi(pattern[dashIdx+1:])
		if err1 != nil || err2 != nil {
			return false
		}
		return value >= low && value <= high
	}
	// Handle single value
	single, err := strconv.Atoi(pattern)
	if err != nil {
		return false
	}
	// Normalize Sunday
	if single == 7 {
		single = 0
	}
	return value == single
}
