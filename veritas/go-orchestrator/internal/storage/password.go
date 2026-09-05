package storage

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
)

// Password auth (stdlib only, no new deps): salted iterated SHA-256 in the
// format v1$iterations$saltB64$hashB64. The salt is per-user; the work factor
// makes bulk guessing expensive. Registering a password requires a valid OTP
// code (see api/password.go) so only the inbox owner can set one.

const passwordIterations = 210000

// HashPassword derives a storable hash for a plaintext password.
func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	sum := iterateHash([]byte(password), salt, passwordIterations)
	return fmt.Sprintf("v1$%d$%s$%s",
		passwordIterations,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(sum),
	), nil
}

// VerifyPasswordHash reports whether password matches the stored hash.
func VerifyPasswordHash(stored, password string) bool {
	parts := strings.Split(stored, "$")
	if len(parts) != 4 || parts[0] != "v1" {
		return false
	}
	iter, err := strconv.Atoi(parts[1])
	if err != nil || iter <= 0 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}
	got := iterateHash([]byte(password), salt, iter)
	return subtle.ConstantTimeCompare(got, want) == 1
}

func iterateHash(password, salt []byte, iter int) []byte {
	// ponytail: SHA-256(password || salt || previous) chain — PBKDF2-shaped,
	// stdlib-only. Upgrade to bcrypt/argon2 (x/crypto dep) if audited.
	h := append(append([]byte{}, password...), salt...)
	for i := 0; i < iter; i++ {
		sum := sha256.Sum256(h)
		h = append(sum[:], salt...)
	}
	out := sha256.Sum256(h)
	return out[:]
}

// SetPasswordHash stores the password hash for an existing user email.
func (d *DB) SetPasswordHash(email, hash string) error {
	if d.mockMode {
		u, ok := d.mockUsers[email]
		if !ok {
			return sql.ErrNoRows
		}
		u.PasswordHash = hash
		return nil
	}
	res, err := d.db.Exec("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2", hash, email)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetPasswordHash returns the stored hash ("" when no password is set).
func (d *DB) GetPasswordHash(email string) (string, error) {
	if d.mockMode {
		if u, ok := d.mockUsers[email]; ok {
			return u.PasswordHash, nil
		}
		return "", sql.ErrNoRows
	}
	var hash sql.NullString
	err := d.db.QueryRow("SELECT password_hash FROM users WHERE email = $1", email).Scan(&hash)
	if err != nil {
		return "", err
	}
	return hash.String, nil
}
