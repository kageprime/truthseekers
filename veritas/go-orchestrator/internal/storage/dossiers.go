package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
	"unicode"
)

// ────────────────────────────────────────────────────────────
// Open-web claim dossiers (Claim Finder internet mode)
// A dossier is the verdict produced by checking an arbitrary statement
// against live web evidence. It is keyed by a normalized statement hash so
// "The Eiffel tower is 330m tall." and "the eiffel tower is 330m tall" hit
// the same cached verdict.
// ────────────────────────────────────────────────────────────

// ClaimStatementHash normalizes a statement (case, punctuation, whitespace)
// and returns a short stable hex digest for the claim_dossiers primary key.
func ClaimStatementHash(statement string) string {
	norm := strings.ToLower(strings.TrimSpace(statement))
	norm = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' {
			return r
		}
		return -1
	}, norm)
	norm = strings.Join(strings.Fields(norm), " ")
	sum := sha256.Sum256([]byte(norm))
	return hex.EncodeToString(sum[:16])
}

// SaveClaimDossier upserts a verified dossier. payload is the full dossier
// JSON as returned to clients. Mock mode is a no-op, matching SaveClaim.
func (d *DB) SaveClaimDossier(statementHash, statement, verdict string, confidence float64, grounded bool, sourcesReviewed int, payload []byte) error {
	if d.mockMode {
		return nil
	}
	_, err := d.db.Exec(`
		INSERT INTO claim_dossiers
			(statement_hash, statement, verdict, confidence, grounded, sources_reviewed, payload, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
		ON CONFLICT (statement_hash) DO UPDATE SET
			statement = EXCLUDED.statement,
			verdict = EXCLUDED.verdict,
			confidence = EXCLUDED.confidence,
			grounded = EXCLUDED.grounded,
			sources_reviewed = EXCLUDED.sources_reviewed,
			payload = EXCLUDED.payload,
			updated_at = NOW()
	`, statementHash, statement, verdict, confidence, grounded, sourcesReviewed, string(payload))
	if err != nil {
		return fmt.Errorf("save claim dossier: %w", err)
	}
	return nil
}

// GetClaimDossier returns the stored dossier payload and its freshness stamp.
// A missing row is (nil, zero, nil) so callers can treat it as a cache miss.
func (d *DB) GetClaimDossier(statementHash string) ([]byte, time.Time, error) {
	if d.mockMode {
		return nil, time.Time{}, nil
	}
	var payload []byte
	var updatedAt time.Time
	err := d.db.QueryRow(`
		SELECT payload, updated_at FROM claim_dossiers WHERE statement_hash = $1
	`, statementHash).Scan(&payload, &updatedAt)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, time.Time{}, nil
		}
		return nil, time.Time{}, fmt.Errorf("get claim dossier: %w", err)
	}
	return payload, updatedAt, nil
}

// RecentClaimDossiers lists the most recently verified statements (without the
// full payloads) for the Claim Finder's idle-state activity feed.
func (d *DB) RecentClaimDossiers(limit int) ([]map[string]interface{}, error) {
	if d.mockMode {
		return []map[string]interface{}{}, nil
	}
	rows, err := d.db.Query(`
		SELECT statement, verdict, confidence, grounded, sources_reviewed, updated_at
		FROM claim_dossiers
		ORDER BY updated_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("recent claim dossiers: %w", err)
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var statement, verdict string
		var confidence float64
		var grounded bool
		var sources int
		var updatedAt time.Time
		if err := rows.Scan(&statement, &verdict, &confidence, &grounded, &sources, &updatedAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"statement":        statement,
			"verdict":          verdict,
			"confidence":       confidence,
			"grounded":         grounded,
			"sources_reviewed": sources,
			"updated_at":       updatedAt,
		})
	}
	return out, nil
}
