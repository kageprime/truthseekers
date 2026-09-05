package storage

import (
	"testing"
	"time"
)

// ponytail: single check covering the OTP contract — happy path, wrong code,
// attempts exhaustion, and expiry (mock mode, no network).
func TestOTPVerify(t *testing.T) {
	d := &DB{mockMode: true}

	if err := d.CreateOTP("a@x.com", HashOTPCode("123456"), time.Minute); err != nil {
		t.Fatalf("create: %v", err)
	}
	if !d.VerifyOTP("a@x.com", "123456") {
		t.Fatal("valid code rejected")
	}
	if d.VerifyOTP("a@x.com", "123456") {
		t.Fatal("consumed code accepted twice")
	}

	if err := d.CreateOTP("b@x.com", HashOTPCode("654321"), time.Minute); err != nil {
		t.Fatalf("create: %v", err)
	}
	if d.VerifyOTP("b@x.com", "000000") {
		t.Fatal("wrong code accepted")
	}
	for i := 0; i < OTPMaxAttempts; i++ {
		d.VerifyOTP("b@x.com", "000000")
	}
	if d.VerifyOTP("b@x.com", "654321") {
		t.Fatal("code accepted after attempts exhausted")
	}

	if err := d.CreateOTP("c@x.com", HashOTPCode("111111"), -time.Minute); err != nil {
		t.Fatalf("create: %v", err)
	}
	if d.VerifyOTP("c@x.com", "111111") {
		t.Fatal("expired code accepted")
	}
}
