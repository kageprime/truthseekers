package storage

import "testing"

// TestClaimStatementHashStableAcrossNoise pins the dossier cache contract:
// case, punctuation, and whitespace must not create duplicate dossiers for the
// same statement.
func TestClaimStatementHashStableAcrossNoise(t *testing.T) {
	a := ClaimStatementHash("The Eiffel Tower is 330 metres tall.")
	b := ClaimStatementHash("  the eiffel tower is 330 metres tall  ")
	c := ClaimStatementHash("the   eiffel  tower is 330 metres tall!!!")
	if a != b || b != c {
		t.Fatalf("hash not stable across normalization: %s / %s / %s", a, b, c)
	}
	if len(a) != 32 {
		t.Errorf("expected 32-char hex digest, got %d chars (%s)", len(a), a)
	}
	if ClaimStatementHash("The Eiffel Tower is 300 metres tall.") == a {
		t.Errorf("different statements must not collide")
	}
}
