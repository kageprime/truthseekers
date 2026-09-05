package storage

import (
	"errors"
	"testing"
)

// ponytail: one check for the signup contract — create inactive, duplicates
// rejected, username lookup, activation flip (mock mode).
func TestSignup(t *testing.T) {
	d := &DB{mockMode: true, mockUsers: map[string]*User{}}
	h, _ := HashPassword("signup-pass-1")

	u, err := d.CreateInactiveUser("newuser", "new@x.com", h)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if u.Activated {
		t.Fatal("new signup must start inactive")
	}
	if _, err := d.CreateInactiveUser("newuser", "other@x.com", h); !errors.Is(err, ErrTaken) {
		t.Fatal("duplicate username not rejected")
	}
	if _, err := d.CreateInactiveUser("someone", "new@x.com", h); !errors.Is(err, ErrTaken) {
		t.Fatal("duplicate email not rejected")
	}
	if !ValidUsername("abc_123-XYZ") || ValidUsername("ab") || ValidUsername("has space") {
		t.Fatal("username validation wrong")
	}
	found, err := d.FindUserByUsername("NEWUSER")
	if err != nil || found.Email != "new@x.com" {
		t.Fatal("username lookup failed")
	}
	if err := d.SetActivated("new@x.com", true); err != nil {
		t.Fatalf("activate: %v", err)
	}
	got, _ := d.GetPasswordHash("new@x.com")
	if !VerifyPasswordHash(got, "signup-pass-1") {
		t.Fatal("password does not verify after signup")
	}
}
