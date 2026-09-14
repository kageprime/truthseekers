package storage

import (
	"testing"
)

// ponytail: the onboard flag is written by user ID but mockUsers is keyed
// by email — a direct key lookup silently missed and every file-mode login
// bounced back to /onboarding.
func TestSetUserOnboardedByID(t *testing.T) {
	d := &DB{mockMode: true, mockUsers: make(map[string]*User)}

	u, err := d.FindOrCreateUserByEmail("onboard@example.com")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if u.Onboarded {
		t.Fatal("new user should not be onboarded")
	}

	if err := d.SetUserOnboarded(u.ID, true); err != nil {
		t.Fatalf("set: %v", err)
	}
	got, err := d.GetUser(u.ID)
	if err != nil || got == nil {
		t.Fatalf("get: %v", err)
	}
	if !got.Onboarded {
		t.Fatal("onboarded flag did not stick — login will loop to /onboarding")
	}
}
