package api

import (
	"testing"
)

func TestStableUUID(t *testing.T) {
	a := stableUUID("doc-62f4a2f4-ev")
	b := stableUUID("doc-62f4a2f4-ev")
	if a != b {
		t.Errorf("stableUUID not deterministic: %s != %s", a, b)
	}
	if !isUUID(a) {
		t.Errorf("stableUUID output fails UUID shape: %s", a)
	}
	// v4 variant bits: 3rd group starts with 4, 4th starts with 8/9/a/b.
	if a[14] != '4' || (a[19] != '8' && a[19] != '9' && a[19] != 'a' && a[19] != 'b') {
		t.Errorf("stableUUID missing v4 bits: %s", a)
	}
	if c := stableUUID("doc-2cfcd76e-ev"); c == a {
		t.Errorf("stableUUID collision for distinct seeds: %s", a)
	}
	// Previously-fatal synthetic IDs now hash cleanly.
	for _, seed := range []string{"claimX-lang-runY", "claimX-scr", "cid|expected|primary_source|verified_gap"} {
		if !isUUID(stableUUID(seed)) {
			t.Errorf("stableUUID(%q) fails UUID shape", seed)
		}
	}
	// Model fabrications are rejected, canonical IDs accepted.
	if isUUID("claim-12") || isUUID("") {
		t.Errorf("isUUID accepts non-UUID claim refs")
	}
	if !isUUID("3fceab57-4780-2f6c-da3b-52b14e4124ac") {
		t.Errorf("isUUID rejects canonical claim ID")
	}
}
