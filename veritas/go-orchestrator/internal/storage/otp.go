package storage

import (
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"time"
)

// OTP login codes: 6 digits, 10-minute TTL, max 5 attempts. Only the SHA-256
// hash is stored. Postgres uses the otp_codes table; mock mode uses an
// in-memory map under otpMu.

const (
	OTPTTL         = 10 * time.Minute
	OTPMaxAttempts = 5
)

// HashOTPCode hashes a plaintext code for storage/comparison.
func HashOTPCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// CreateOTP stores (or replaces) the pending code hash for an email.
func (d *DB) CreateOTP(email, codeHash string, ttl time.Duration) error {
	if d.mockMode {
		d.otpMu.Lock()
		defer d.otpMu.Unlock()
		if d.mockOTP == nil {
			d.mockOTP = make(map[string]otpEntry)
		}
		d.mockOTP[email] = otpEntry{hash: codeHash, expires: time.Now().Add(ttl)}
		return nil
	}
	_, err := d.db.Exec(`
		INSERT INTO otp_codes (email, code_hash, expires_at, attempts)
		VALUES ($1, $2, NOW() + ($3 || ' seconds')::INTERVAL, 0)
		ON CONFLICT (email) DO UPDATE SET code_hash = EXCLUDED.code_hash,
			expires_at = EXCLUDED.expires_at, attempts = 0
	`, email, codeHash, int(ttl.Seconds()))
	return err
}

// VerifyOTP checks a code. It consumes the record on success, expiry, or
// attempts exhaustion, and counts failures otherwise.
func (d *DB) VerifyOTP(email, code string) bool {
	if d.mockMode {
		d.otpMu.Lock()
		defer d.otpMu.Unlock()
		e, ok := d.mockOTP[email]
		if !ok {
			return false
		}
		if time.Now().After(e.expires) || e.attempts >= OTPMaxAttempts {
			delete(d.mockOTP, email)
			return false
		}
		if subtle.ConstantTimeCompare([]byte(e.hash), []byte(HashOTPCode(code))) != 1 {
			e.attempts++
			d.mockOTP[email] = e
			return false
		}
		delete(d.mockOTP, email)
		return true
	}

	var hash string
	var expires time.Time
	var attempts int
	err := d.db.QueryRow("SELECT code_hash, expires_at, attempts FROM otp_codes WHERE email = $1", email).
		Scan(&hash, &expires, &attempts)
	if err == sql.ErrNoRows {
		return false
	}
	if err != nil {
		return false
	}
	if time.Now().After(expires) || attempts >= OTPMaxAttempts {
		_, _ = d.db.Exec("DELETE FROM otp_codes WHERE email = $1", email)
		return false
	}
	if subtle.ConstantTimeCompare([]byte(hash), []byte(HashOTPCode(code))) != 1 {
		_, _ = d.db.Exec("UPDATE otp_codes SET attempts = attempts + 1 WHERE email = $1", email)
		return false
	}
	_, _ = d.db.Exec("DELETE FROM otp_codes WHERE email = $1", email)
	return true
}
