package triggers

import (
	"testing"
	"time"
)

func mustMatch(t *testing.T, expr string, tm time.Time) {
	t.Helper()
	ok, err := matchCron(expr, tm)
	if err != nil {
		t.Fatalf("matchCron(%q): %v", expr, err)
	}
	if !ok {
		t.Errorf("expected %q to match %v", expr, tm)
	}
}

func mustNotMatch(t *testing.T, expr string, tm time.Time) {
	t.Helper()
	ok, err := matchCron(expr, tm)
	if err != nil {
		t.Fatalf("matchCron(%q): %v", expr, err)
	}
	if ok {
		t.Errorf("expected %q NOT to match %v", expr, tm)
	}
}

func TestMatchCronWildcard(t *testing.T) {
	// * should match any value in all positions
	tm := time.Date(2026, 7, 11, 14, 35, 0, 0, time.UTC)
	mustMatch(t, "* * * * *", tm)
}

func TestMatchCronExactHour(t *testing.T) {
	tm := time.Date(2026, 7, 11, 14, 0, 0, 0, time.UTC)
	mustMatch(t, "0 14 * * *", tm)
	mustNotMatch(t, "0 15 * * *", tm)
}

func TestMatchCronRange(t *testing.T) {
	tm := time.Date(2026, 7, 11, 14, 30, 0, 0, time.UTC)
	mustMatch(t, "30 9-17 * * *", tm)
	mustNotMatch(t, "30 18-23 * * *", tm)
}

func TestMatchCronStep(t *testing.T) {
	tm := time.Date(2026, 7, 11, 14, 0, 0, 0, time.UTC)
	mustMatch(t, "*/5 * * * *", tm)
	tm2 := time.Date(2026, 7, 11, 14, 3, 0, 0, time.UTC)
	mustNotMatch(t, "*/5 * * * *", tm2)
}

func TestMatchCronWeekday(t *testing.T) {
	// July 11 2026 is a Saturday (6)
	tm := time.Date(2026, 7, 11, 0, 0, 0, 0, time.UTC)
	mustMatch(t, "0 0 * * 6", tm)  // Saturday
	mustNotMatch(t, "0 0 * * 0", tm) // Sunday
	mustNotMatch(t, "0 0 * * 1", tm) // Monday
}

func TestMatchCronCommaList(t *testing.T) {
	tm := time.Date(2026, 7, 11, 14, 15, 0, 0, time.UTC)
	mustMatch(t, "5,10,15 * * * *", tm)
	mustNotMatch(t, "5,10,20 * * * *", tm)
}

func TestMatchCronBadExpr(t *testing.T) {
	_, err := matchCron("bad", time.Now())
	if err == nil {
		t.Fatal("expected error for bad expression")
	}
}
