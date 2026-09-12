package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// JWT (HMAC-SHA256, stdlib only).
//
// The signing key comes from JWT_SECRET. No default: the server panics on boot
// without it unless ALLOW_DEV_AUTH=1 (local dev only). Tokens carry `sub`
// (user id), `iat`, and `exp` (24 hours).
//
// parseJWTSub verifies the signature and expiry before returning the subject,
// so any tampered or expired token is rejected.

const (
	jwtDefaultSecret = "veritas-dev-secret-change-me"
	// 7-day absolute cap with sliding renewal (see jwtRefreshWindow):
	// active readers stay logged in, idle sessions still die on schedule.
	jwtTTL = 7 * 24 * time.Hour
	// Re-issue when less than this remains. Daily-active users renew
	// forever; anyone idle longer than the TTL is logged out regardless.
	jwtRefreshWindow = 24 * time.Hour
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

// setAuthCookie stores the JWT in an HttpOnly cookie (S7) so it is never
// exposed to page JS. The JSON token response is kept for backward compat
// with older frontends; new frontends rely on the cookie + credentials:include.
// Secure is set on TLS or when COOKIE_SECURE=1 / X-Forwarded-Proto=https
// (Heroku/Vercel terminate TLS at the edge). SameSite=None when Secure so
// the cookie is sent on cross-site fetches/EventSource (Vercel → Heroku);
// Lax otherwise (local-dev same-site, where None would be wrong).
func setAuthCookie(w http.ResponseWriter, r *http.Request, token string) {
	secure := r.TLS != nil ||
		os.Getenv("COOKIE_SECURE") == "1" ||
		r.Header.Get("X-Forwarded-Proto") == "https"
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "truthseekers_token",
		Value:    token,
		Path:     "/",
		MaxAge:   int((jwtTTL + time.Second).Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
	})
}

// clearAuthCookie expires the session cookie. Mirrors setAuthCookie's
// Path/Secure/SameSite so the browser actually drops it (per RFC 6265 §5.3
// the domain+path must match; Secure/SameSite mirror the live cookie).
func clearAuthCookie(w http.ResponseWriter, r *http.Request) {
	secure := r.TLS != nil ||
		os.Getenv("COOKIE_SECURE") == "1" ||
		r.Header.Get("X-Forwarded-Proto") == "https"
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "truthseekers_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
	})
}

// jwtClaims holds the fields we read from a verified token.
type jwtClaims struct {
	SubStr string `json:"sub"`
	Iat    int64  `json:"iat"`
	Exp    int64  `json:"exp"`
	Role   string `json:"role"`
}

// verifyJWT validates the HS256 signature and expiry, returning the subject,
// role, and expiry. The alg header is pinned to HS256 — anything else (none,
// RS256, ...) is rejected so algorithm-confusion tokens never pass.
func verifyJWT(tokenStr string) (sub string, role string, exp int64, err error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", "", 0, fmt.Errorf("invalid JWT (expected 3 segments)")
	}
	signingInput := parts[0] + "." + parts[1]

	var header struct {
		Alg string `json:"alg"`
		Typ string `json:"typ"`
	}
	if hBytes, err := b64dec(parts[0]); err != nil {
		return "", "", 0, fmt.Errorf("decode header: %w", err)
	} else if err := json.Unmarshal(hBytes, &header); err != nil {
		return "", "", 0, fmt.Errorf("parse header: %w", err)
	} else if !strings.EqualFold(header.Alg, "HS256") {
		return "", "", 0, fmt.Errorf("unexpected JWT alg %q", header.Alg)
	}

	// Verify signature (constant-time compare).
	sig, err := b64dec(parts[2])
	if err != nil {
		return "", "", 0, fmt.Errorf("decode signature: %w", err)
	}
	mac := hmac.New(sha256.New, jwtSecret())
	mac.Write([]byte(signingInput))
	if !hmac.Equal(mac.Sum(nil), sig) {
		return "", "", 0, fmt.Errorf("signature mismatch")
	}

	// Decode + validate claims.
	payloadBytes, err := b64dec(parts[1])
	if err != nil {
		return "", "", 0, fmt.Errorf("decode payload: %w", err)
	}
	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", "", 0, fmt.Errorf("parse claims: %w", err)
	}
	if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
		return "", "", 0, fmt.Errorf("token expired")
	}
	if claims.SubStr == "" {
		return "", "", 0, fmt.Errorf("missing sub claim")
	}
	usrRole := claims.Role
	if usrRole == "" {
		usrRole = "member"
	}
	return claims.SubStr, usrRole, claims.Exp, nil
}
