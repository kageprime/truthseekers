package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func hmacOf(input string) []byte {
	mac := hmac.New(sha256.New, jwtSecret())
	mac.Write([]byte(input))
	return mac.Sum(nil)
}

// roundtrip: sign then verify preserves sub + role.
func TestSignVerifyRoundtrip(t *testing.T) {
	t.Setenv("ALLOW_DEV_AUTH", "1")
	tok, err := signJWT("user-123", "admin")
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	sub, role, exp, err := verifyJWT(tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if sub != "user-123" || role != "admin" {
		t.Fatalf("got sub=%q role=%q", sub, role)
	}
	// Expiry must ride along for sliding renewal, ~TTL out.
	if want := time.Now().Add(jwtTTL).Unix(); exp < want-60 || exp > want+60 {
		t.Fatalf("exp=%d, want ~%d", exp, want)
	}
}

// alg:none tokens must not pass (legacy mockJWT shape).
func TestRejectAlgNone(t *testing.T) {
	t.Setenv("ALLOW_DEV_AUTH", "1")
	tok := b64enc([]byte(`{"alg":"none","typ":"JWT"}`)) + "." +
		b64enc([]byte(`{"sub":"mallory","role":"owner"}`)) + "."
	if _, _, _, err := verifyJWT(tok); err == nil {
		t.Fatal("alg:none accepted")
	}
}

// algorithm confusion: valid HS256 signature re-labeled RS256 must fail.
func TestRejectAlgConfusion(t *testing.T) {
	t.Setenv("ALLOW_DEV_AUTH", "1")
	tok, _ := signJWT("user-123", "member")
	parts := strings.Split(tok, ".")
	fake := b64enc([]byte(`{"alg":"RS256","typ":"JWT"}`)) + "." + parts[1] + "." + parts[2]
	if _, _, _, err := verifyJWT(fake); err == nil {
		t.Fatal("re-labeled alg accepted")
	}
}

// expired tokens are rejected.
func TestRejectExpired(t *testing.T) {
	t.Setenv("ALLOW_DEV_AUTH", "1")
	payload, _ := json.Marshal(map[string]interface{}{
		"sub": "user-123", "role": "member",
		"iat": time.Now().Add(-2 * time.Hour).Unix(),
		"exp": time.Now().Add(-time.Hour).Unix(),
	})
	input := b64enc([]byte(`{"alg":"HS256","typ":"JWT"}`)) + "." + b64enc(payload)
	mac := b64enc(hmacOf(input))
	if _, _, _, err := verifyJWT(input + "." + mac); err == nil {
		t.Fatal("expired token accepted")
	}
}
