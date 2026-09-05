package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
)

// JWT (HMAC-SHA256, stdlib only).
//
// The signing key comes from JWT_SECRET. No default: the server panics on boot
// without it unless ALLOW_DEV_AUTH=1 (local dev only). Tokens carry `sub`
// (user id), `iat`, and `exp` (7 days).
//
// parseJWTSub verifies the signature and expiry before returning the subject,
// so any tampered or expired token is rejected.

const (
	jwtDefaultSecret = "veritas-dev-secret-change-me"
	jwtTTL           = 7 * 24 * time.Hour
)

func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	// ponytail: fail closed — the old default-secret fallback made forged
	// owner tokens trivial. Local dev opts in explicitly via ALLOW_DEV_AUTH=1.
	if os.Getenv("ALLOW_DEV_AUTH") == "1" {
		log.Printf("WARNING: Using default JWT secret. Set JWT_SECRET for production.")
		return []byte(jwtDefaultSecret)
	}
	panic("JWT_SECRET must be set (or ALLOW_DEV_AUTH=1 for local dev)")
}

func b64enc(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

func b64dec(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

// signJWT issues a signed HS256 JWT for the given subject (user id).
// If role is empty, defaults to "member".
func signJWT(sub string, role ...string) (string, error) {
	userRole := "member"
	if len(role) > 0 && role[0] != "" {
		userRole = role[0]
	}
	header := `{"alg":"HS256","typ":"JWT"}`
	now := time.Now().UTC()
	payload, err := json.Marshal(map[string]interface{}{
		"sub":  sub,
		"iat":  now.Unix(),
		"exp":  now.Add(jwtTTL).Unix(),
		"role": userRole,
	})
	if err != nil {
		return "", fmt.Errorf("marshal claims: %w", err)
	}

	signingInput := b64enc([]byte(header)) + "." + b64enc(payload)
	mac := hmac.New(sha256.New, jwtSecret())
	mac.Write([]byte(signingInput))
	sig := b64enc(mac.Sum(nil))
	return signingInput + "." + sig, nil
}

// jwtClaims holds the fields we read from a verified token.
type jwtClaims struct {
	SubStr string `json:"sub"`
	Iat    int64  `json:"iat"`
	Exp    int64  `json:"exp"`
	Role   string `json:"role"`
}

// verifyJWT validates the HS256 signature and expiry, returning the subject
// and role. It rejects alg:none tokens outright so the old mockJWT tokens no
// longer pass.
func verifyJWT(tokenStr string) (sub string, role string, err error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", "", fmt.Errorf("invalid JWT (expected 3 segments)")
	}
	signingInput := parts[0] + "." + parts[1]

	// Reject alg:none — the legacy mockJWT shape. No unsigned tokens.
	var header struct {
		Alg string `json:"alg"`
		Typ string `json:"typ"`
	}
	if hBytes, err := b64dec(parts[0]); err != nil {
		return "", "", fmt.Errorf("decode header: %w", err)
	} else if err := json.Unmarshal(hBytes, &header); err != nil {
		return "", "", fmt.Errorf("parse header: %w", err)
	} else if strings.EqualFold(header.Alg, "none") {
		return "", "", fmt.Errorf("alg:none tokens are not accepted")
	}

	// Verify signature (constant-time compare).
	sig, err := b64dec(parts[2])
	if err != nil {
		return "", "", fmt.Errorf("decode signature: %w", err)
	}
	mac := hmac.New(sha256.New, jwtSecret())
	mac.Write([]byte(signingInput))
	if !hmac.Equal(mac.Sum(nil), sig) {
		return "", "", fmt.Errorf("signature mismatch")
	}

	// Decode + validate claims.
	payloadBytes, err := b64dec(parts[1])
	if err != nil {
		return "", "", fmt.Errorf("decode payload: %w", err)
	}
	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", "", fmt.Errorf("parse claims: %w", err)
	}
	if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
		return "", "", fmt.Errorf("token expired")
	}
	if claims.SubStr == "" {
		return "", "", fmt.Errorf("missing sub claim")
	}
	usrRole := claims.Role
	if usrRole == "" {
		usrRole = "member"
	}
	return claims.SubStr, usrRole, nil
}
