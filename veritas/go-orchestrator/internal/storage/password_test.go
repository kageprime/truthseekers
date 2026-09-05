package storage

import (
	"strings"
	"testing"
)

// ponytail: one check for the password contract — roundtrip, wrong password,
// unknown format rejection, and mock store/load.
func TestPasswordHash(t *testing.T) {
	h, err := HashPassword("correct-horse-123")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !strings.HasPrefix(h, "v1$") {
		t.Fatalf("unexpected format %q", h)
	}
	if !VerifyPasswordHash(h, "correct-horse-123") {
		t.Fatal("valid password rejected")
	}
	if VerifyPasswordHash(h, "wrong") {
		t.Fatal("wrong password accepted")
	}
	if VerifyPasswordHash("garbage", "x") {
		t.Fatal("malformed hash accepted")
	}

	d := &DB{mockMode: true, mockUsers: map[string]*User{}}
	if _, err := d.FindOrCreateUserByEmail("p@x.com"); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := d.SetPasswordHash("p@x.com", h); err != nil {
		t.Fatalf("set: %v", err)
	}
	got, err := d.GetPasswordHash("p@x.com")
	if err != nil || !VerifyPasswordHash(got, "correct-horse-123") {
		t.Fatal("stored hash does not verify")
	}
	if _, err := d.GetPasswordHash("nobody@x.com"); err == nil {
		t.Fatal("expected error for unknown email")
	}
}
