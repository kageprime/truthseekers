package storage

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"unicode"
)

func normalizeClaimText(text string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(text) {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSpace(r) {
			b.WriteRune(r)
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func ClaimSignature(text string) string {
	normalized := normalizeClaimText(text)
	sum := sha256.Sum256([]byte(normalized))
	return fmt.Sprintf("%x", sum[:16])
}
