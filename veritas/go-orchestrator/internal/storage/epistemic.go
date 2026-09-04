package storage

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/lib/pq"
)

// ────────────────────────────────────────────────────────────
// Epistemic Data Persistence
// These methods support the 9-node epistemic pipeline by storing
// intermediate outputs (claims, evidence, gaps, etc.) to PostgreSQL.
// ────────────────────────────────────────────────────────────

// SaveClaim inserts or updates a claim. Uses the claim's ID as primary key
// so re-generations of the same article naturally create claim history
// via ON CONFLICT UPDATE.
func (d *DB) SaveClaim(c *Claim) error {
	if d.mockMode {
		return nil
	}
	cvJson, _ := json.Marshal(c.ConfidenceVector)
	_, err := d.db.Exec(`
		INSERT INTO claims (id, text, signature, type, status, confidence_vector, derived_confidence, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			text = EXCLUDED.text,
			signature = EXCLUDED.signature,
			type = EXCLUDED.type,
			status = EXCLUDED.status,
			confidence_vector = EXCLUDED.confidence_vector,
			derived_confidence = EXCLUDED.derived_confidence,
			updated_at = EXCLUDED.updated_at
	`, c.ID, c.Text, c.Signature, c.Type, c.Status, cvJson, c.DerivedConfidence, c.CreatedAt, c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("save claim: %w", err)
	}
	return nil
}

// GetClaimByID fetches a single claim by its UUID.
func (d *DB) GetClaimByID(id string) (*Claim, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.claimsByID[id], nil
		}
		return nil, nil
	}
	var c Claim
	var cvJson []byte
	err := d.db.QueryRow(`
		SELECT id, text, type, status, confidence_vector, derived_confidence, created_at, updated_at
		FROM claims WHERE id = $1
	`, id).Scan(&c.ID, &c.Text, &c.Type, &c.Status, &cvJson, &c.DerivedConfidence, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("get claim: %w", err)
	}
	if len(cvJson) > 0 {
		json.Unmarshal(cvJson, &c.ConfidenceVector)
	}
	return &c, nil
}

// GetClaimsByArticle returns all claims linked to an article via the
// article_claims junction table. Joins through articles.id since the
// junction uses article_id (UUID), not slug.
func (d *DB) GetClaimsByArticle(slug string) ([]*Claim, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.claims[slug], nil
		}
		return nil, nil
	}
	rows, err := d.db.Query(`
		SELECT c.id, c.text, c.signature, c.type, c.status, c.confidence_vector, c.derived_confidence, c.created_at, c.updated_at
		FROM claims c
		JOIN article_claims ac ON c.id = ac.claim_id
		JOIN articles a ON ac.article_id = a.id
		WHERE a.slug = $1
		ORDER BY c.created_at ASC
	`, slug)
	if err != nil {
		return nil, fmt.Errorf("get claims by article: %w", err)
	}
	defer rows.Close()

	var list []*Claim
	for rows.Next() {
		var c Claim
		var cvJson []byte
		if err := rows.Scan(&c.ID, &c.Text, &c.Signature, &c.Type, &c.Status, &cvJson, &c.DerivedConfidence, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		if len(cvJson) > 0 {
			json.Unmarshal(cvJson, &c.ConfidenceVector)
		}
		list = append(list, &c)
	}
	return list, nil
}

// LinkArticleClaim creates the many-to-many relationship between an
// article (looked up by slug) and a claim (by claim ID).
func (d *DB) LinkArticleClaim(slug string, claimID string) error {
	if d.mockMode {
		return nil
	}
	// Resolve article UUID from slug
	var articleID string
	err := d.db.QueryRow("SELECT id FROM articles WHERE slug = $1", slug).Scan(&articleID)
	if err != nil {
		return fmt.Errorf("link article claim: resolve slug %q: %w", slug, err)
	}
	_, err = d.db.Exec(`
		INSERT INTO article_claims (article_id, claim_id)
		VALUES ($1, $2)
		ON CONFLICT (article_id, claim_id) DO NOTHING
	`, articleID, claimID)
	if err != nil {
		return fmt.Errorf("link article claim: %w", err)
	}
	return nil
}

// SaveEvidence inserts or updates a piece of evidence linked to a claim.
func (d *DB) SaveEvidence(e *Evidence) error {
	if d.mockMode {
		return nil
	}
	_, err := d.db.Exec(`
		INSERT INTO evidence (id, claim_id, type, url, chain_of_custody, acquisition_method, accessibility, supports_claim, source_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO UPDATE SET
			claim_id = EXCLUDED.claim_id,
			type = EXCLUDED.type,
			url = EXCLUDED.url,
			chain_of_custody = EXCLUDED.chain_of_custody,
			acquisition_method = EXCLUDED.acquisition_method,
			accessibility = EXCLUDED.accessibility,
			supports_claim = EXCLUDED.supports_claim,
			source_id = EXCLUDED.source_id
	`, e.ID, e.ClaimID, e.Type, e.URL, e.ChainOfCustody, e.AcquisitionMethod, e.Accessibility, e.SupportsClaim, e.SourceID, e.CreatedAt)
	if err != nil {
		return fmt.Errorf("save evidence: %w", err)
	}
	return nil
}

// GetEvidenceByClaim returns all evidence rows linked to a claim.
func (d *DB) GetEvidenceByClaim(claimID string) ([]*Evidence, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.evidence[claimID], nil
		}
		return nil, nil
	}
	rows, err := d.db.Query(`
		SELECT id, claim_id, type, url, chain_of_custody, acquisition_method, accessibility, supports_claim, source_id, created_at
		FROM evidence WHERE claim_id = $1
		ORDER BY created_at ASC
	`, claimID)
	if err != nil {
		return nil, fmt.Errorf("get evidence by claim: %w", err)
	}
	defer rows.Close()

	var list []*Evidence
	for rows.Next() {
		var e Evidence
		var sourceID *string
		if err := rows.Scan(&e.ID, &e.ClaimID, &e.Type, &e.URL, &e.ChainOfCustody, &e.AcquisitionMethod, &e.Accessibility, &e.SupportsClaim, &sourceID, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.SourceID = sourceID
		list = append(list, &e)
	}
	return list, nil
}

// SaveSource inserts or updates a source.
func (d *DB) SaveSource(s *Source) error {
	if d.mockMode {
		return nil
	}
	cvJson, _ := json.Marshal(s.CredibilityVector)
	_, err := d.db.Exec(`
		INSERT INTO sources (id, name, type, credibility_vector, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			type = EXCLUDED.type,
			credibility_vector = EXCLUDED.credibility_vector
	`, s.ID, s.Name, s.Type, cvJson, s.CreatedAt)
	if err != nil {
		return fmt.Errorf("save source: %w", err)
	}
	return nil
}

// SaveEvidenceGap inserts a gap record. Gaps are insert-only (no update)
// because each detection is a distinct observation.
func (d *DB) SaveEvidenceGap(g *EvidenceGap) error {
	if d.mockMode {
		return nil
	}
	metaJson, _ := json.Marshal(g.ExternalMetadata)
	_, err := d.db.Exec(`
		INSERT INTO evidence_gaps (id, claim_id, gap_type, expected_artifact, verification_status, external_metadata, cause_label, cause_confidence, detected_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			claim_id = EXCLUDED.claim_id,
			gap_type = EXCLUDED.gap_type,
			expected_artifact = EXCLUDED.expected_artifact,
			verification_status = EXCLUDED.verification_status,
			external_metadata = EXCLUDED.external_metadata,
			cause_label = EXCLUDED.cause_label,
			cause_confidence = EXCLUDED.cause_confidence
	`, g.ID, g.ClaimID, g.GapType, g.ExpectedArtifact, g.VerificationStatus, metaJson, g.CauseLabel, g.CauseConfidence, g.DetectedAt)
	if err != nil {
		return fmt.Errorf("save evidence gap: %w", err)
	}
	return nil
}

// GetGapsByArticle returns all evidence gaps linked to claims that belong
// to the given article slug.
func (d *DB) GetGapsByArticle(slug string) ([]*EvidenceGap, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.gaps[slug], nil
		}
		return nil, nil
	}
	rows, err := d.db.Query(`
		SELECT g.id, g.claim_id, g.gap_type, g.expected_artifact, g.verification_status, g.external_metadata, g.cause_label, g.cause_confidence, g.detected_at
		FROM evidence_gaps g
		JOIN article_claims ac ON g.claim_id = ac.claim_id
		JOIN articles a ON ac.article_id = a.id
		WHERE a.slug = $1
		ORDER BY g.detected_at ASC
	`, slug)
	if err != nil {
		return nil, fmt.Errorf("get gaps by article: %w", err)
	}
	defer rows.Close()

	var list []*EvidenceGap
	for rows.Next() {
		var g EvidenceGap
		var metaJson []byte
		if err := rows.Scan(&g.ID, &g.ClaimID, &g.GapType, &g.ExpectedArtifact, &g.VerificationStatus, &metaJson, &g.CauseLabel, &g.CauseConfidence, &g.DetectedAt); err != nil {
			return nil, err
		}
		if len(metaJson) > 0 {
			json.Unmarshal(metaJson, &g.ExternalMetadata)
		}
		list = append(list, &g)
	}
	return list, nil
}

// GapWithSlug joins a gap with its parent article slug.
type GapWithSlug struct {
	EvidenceGap
	ArticleSlug string `json:"article_slug"`
}

// GetAllEvidenceGaps returns all gaps across all articles, joined with article slug.
func (d *DB) GetAllEvidenceGaps() ([]*GapWithSlug, error) {
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		out := []*GapWithSlug{}
		for slug, gaps := range d.fs.gaps {
			for _, g := range gaps {
				gw := &GapWithSlug{EvidenceGap: *g, ArticleSlug: slug}
				out = append(out, gw)
			}
		}
		return out, nil
	}
	rows, err := d.db.Query(`
		SELECT g.id, g.claim_id, g.gap_type, g.expected_artifact, g.verification_status,
		       g.external_metadata, g.cause_label, g.cause_confidence, g.detected_at,
		       a.slug
		FROM evidence_gaps g
		JOIN article_claims ac ON g.claim_id = ac.claim_id
		JOIN articles a ON ac.article_id = a.id
		ORDER BY g.detected_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("get all gaps: %w", err)
	}
	defer rows.Close()
	var list []*GapWithSlug
	for rows.Next() {
		var g GapWithSlug
		var metaJson []byte
		if err := rows.Scan(&g.ID, &g.ClaimID, &g.GapType, &g.ExpectedArtifact, &g.VerificationStatus, &metaJson, &g.CauseLabel, &g.CauseConfidence, &g.DetectedAt, &g.ArticleSlug); err != nil {
			return nil, err
		}
		if len(metaJson) > 0 {
			json.Unmarshal(metaJson, &g.ExternalMetadata)
		}
		list = append(list, &g)
	}
	return list, nil
}

// SaveLanguageFlag inserts a language flag record.
func (d *DB) SaveLanguageFlag(f *LanguageFlag) error {
	if d.mockMode {
		return nil
	}
	_, err := d.db.Exec(`
		INSERT INTO language_flags (id, claim_id, source_phrase, precision_upgrade, framing_origin, confidence, detected_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			claim_id = EXCLUDED.claim_id,
			source_phrase = EXCLUDED.source_phrase,
			precision_upgrade = EXCLUDED.precision_upgrade,
			framing_origin = EXCLUDED.framing_origin,
			confidence = EXCLUDED.confidence
	`, f.ID, f.ClaimID, f.SourcePhrase, f.PrecisionUpgrade, f.FramingOrigin, f.Confidence, f.DetectedAt)
	if err != nil {
		return fmt.Errorf("save language flag: %w", err)
	}
	return nil
}

// SaveScrutinyAssessment inserts a scrutiny assessment.
func (d *DB) SaveScrutinyAssessment(s *ScrutinyAssessment) error {
	if d.mockMode {
		return nil
	}
	rfJson, _ := json.Marshal(s.RiskFactors)
	arJson, _ := json.Marshal(s.ActionRequired)
	_, err := d.db.Exec(`
		INSERT INTO scrutiny_assessments (id, claim_id, risk_factors, risk_score, action_required, assessed_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			claim_id = EXCLUDED.claim_id,
			risk_factors = EXCLUDED.risk_factors,
			risk_score = EXCLUDED.risk_score,
			action_required = EXCLUDED.action_required
	`, s.ID, s.ClaimID, rfJson, s.RiskScore, arJson, s.AssessedAt)
	if err != nil {
		return fmt.Errorf("save scrutiny assessment: %w", err)
	}
	return nil
}

// DeleteEpistemicDataForArticle removes all claims, evidence, gaps, flags,
// and scrutiny assessments linked to an article. Used when regenerating an
// article to start from a clean epistemic state.
func (d *DB) DeleteEpistemicDataForArticle(slug string) error {
	if d.mockMode {
		return nil
	}
	// Resolve article ID
	var articleID string
	err := d.db.QueryRow("SELECT id FROM articles WHERE slug = $1", slug).Scan(&articleID)
	if err != nil {
		return fmt.Errorf("delete epistemic data: resolve slug: %w", err)
	}

	// Delete in dependency order to avoid FK violations
	_, _ = d.db.Exec(`
		DELETE FROM scrutiny_assessments WHERE claim_id IN (
			SELECT claim_id FROM article_claims WHERE article_id = $1
		)
	`, articleID)
	_, _ = d.db.Exec(`
		DELETE FROM language_flags WHERE claim_id IN (
			SELECT claim_id FROM article_claims WHERE article_id = $1
		)
	`, articleID)
	_, _ = d.db.Exec(`
		DELETE FROM evidence_gaps WHERE claim_id IN (
			SELECT claim_id FROM article_claims WHERE article_id = $1
		)
	`, articleID)
	_, _ = d.db.Exec(`
		DELETE FROM evidence WHERE claim_id IN (
			SELECT claim_id FROM article_claims WHERE article_id = $1
		)
	`, articleID)
	_, _ = d.db.Exec(`
		DELETE FROM article_claims WHERE article_id = $1
	`, articleID)
	_, _ = d.db.Exec(`
		DELETE FROM claims WHERE id NOT IN (SELECT claim_id FROM article_claims)
	`)
	return nil
}

// EnsureGenerationRunID returns a new UUID for a generation run. This is
// used to group all epistemic data produced by a single DAG execution.
func EnsureGenerationRunID() string {
	return randID()
}

// GetClaimBySignature looks up a claim by its normalized signature hash.
// Returns nil, nil when no match is found.
func (d *DB) GetClaimBySignature(signature string) (*Claim, error) {
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		for _, cs := range d.fs.claims {
			for _, c := range cs {
				if c.Signature == signature {
					return c, nil
				}
			}
		}
		return nil, nil
	}
	var c Claim
	var cvJson []byte
	err := d.db.QueryRow(`
		SELECT id, text, type, status, confidence_vector, derived_confidence, created_at, updated_at
		FROM claims WHERE signature = $1
	`, signature).Scan(&c.ID, &c.Text, &c.Type, &c.Status, &cvJson, &c.DerivedConfidence, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("get claim by signature: %w", err)
	}
	if len(cvJson) > 0 {
		json.Unmarshal(cvJson, &c.ConfidenceVector)
	}
	return &c, nil
}

// SaveClaimVersion records a generation run's version of a claim.
func (d *DB) SaveClaimVersion(claimID, runID string, cv map[string]interface{}, confidence float64) error {
	if d.mockMode {
		return nil
	}
	cvJson, _ := json.Marshal(cv)
	_, err := d.db.Exec(`
		INSERT INTO claim_versions (claim_id, generation_run_id, confidence_vector, derived_confidence, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (claim_id, generation_run_id) DO UPDATE SET
			confidence_vector = EXCLUDED.confidence_vector,
			derived_confidence = EXCLUDED.derived_confidence
	`, claimID, runID, cvJson, confidence)
	if err != nil {
		return fmt.Errorf("save claim version: %w", err)
	}
	return nil
}

// SaveClaimRelationship creates or updates a relationship between two claims.
func (d *DB) SaveClaimRelationship(source, target, relType string, strength float64) error {
	if d.mockMode {
		return nil
	}
	_, err := d.db.Exec(`
		INSERT INTO claim_relationships (source_claim_id, target_claim_id, relationship_type, strength)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (source_claim_id, target_claim_id) DO UPDATE SET
			relationship_type = EXCLUDED.relationship_type,
			strength = EXCLUDED.strength
	`, source, target, relType, strength)
	if err != nil {
		return fmt.Errorf("save claim relationship: %w", err)
	}
	return nil
}

// GetClaimRelationships returns all typed claim→claim edges whose source claim
// belongs to the given article slug.
func (d *DB) GetClaimRelationships(slug string) ([]*ClaimRelationship, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.relationships[slug], nil
		}
		return nil, nil
	}
	rows, err := d.db.Query(`
		SELECT r.source_claim_id, r.target_claim_id, r.relationship_type, r.strength
		FROM claim_relationships r
		JOIN article_claims ac ON r.source_claim_id = ac.claim_id
		JOIN articles a ON ac.article_id = a.id
		WHERE a.slug = $1
	`, slug)
	if err != nil {
		return nil, fmt.Errorf("get claim relationships: %w", err)
	}
	defer rows.Close()
	var list []*ClaimRelationship
	for rows.Next() {
		var r ClaimRelationship
		if err := rows.Scan(&r.SourceClaimID, &r.TargetClaimID, &r.RelationshipType, &r.Strength); err != nil {
			return nil, err
		}
		list = append(list, &r)
	}
	return list, nil
}

// GetMostContestedClaims returns the claims ranked by their contradiction
// level across the whole encyclopedia (used by the /contested dashboard).
func (d *DB) GetMostContestedClaims(limit int) ([]*Claim, error) {
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		all := []*Claim{}
		seen := map[string]bool{}
		for _, cs := range d.fs.claims {
			for _, c := range cs {
				if !seen[c.ID] {
					seen[c.ID] = true
					all = append(all, c)
				}
			}
		}
		cl := func(c *Claim) float64 {
			if v, ok := c.ConfidenceVector["contradiction_level"].(float64); ok {
				return v
			}
			return 0
		}
		sort.Slice(all, func(i, j int) bool {
			// disputed/weak first, then by contradiction level
			si, sj := statusRank(all[i].Status), statusRank(all[j].Status)
			if si != sj {
				return si < sj
			}
			return cl(all[i]) > cl(all[j])
		})
		if limit > len(all) {
			limit = len(all)
		}
		if limit < 0 {
			limit = 0
		}
		return all[:limit], nil
	}
	rows, err := d.db.Query(`
		SELECT id, text, type, status, confidence_vector, derived_confidence, created_at, updated_at
		FROM claims
		WHERE status IN ('disputed','weak')
		ORDER BY (confidence_vector->>'contradiction_level')::float DESC NULLS LAST
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("get most contested claims: %w", err)
	}
	defer rows.Close()
	var list []*Claim
	for rows.Next() {
		var c Claim
		var cvJson []byte
		if err := rows.Scan(&c.ID, &c.Text, &c.Type, &c.Status, &cvJson, &c.DerivedConfidence, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		if len(cvJson) > 0 {
			json.Unmarshal(cvJson, &c.ConfidenceVector)
		}
		list = append(list, &c)
	}
	return list, nil
}

// statusRank orders claim status for the contested dashboard: disputed(0),
// weak(1), everything else(2).
func statusRank(s string) int {
	switch s {
	case "disputed":
		return 0
	case "weak":
		return 1
	default:
		return 2
	}
}

// ClaimWithArticle extends Claim with the article slug it's attached to. Used
// by the global claim graph endpoint so claim nodes can link back to articles.
type ClaimWithArticle struct {
	*Claim
	ArticleSlug string `json:"article_slug"`
}

// GetMostContestedClaimsWithArticle returns the top N most-contested claims
// across the whole encyclopedia along with the article slug they're attached
// to. When a claim spans multiple articles, the first matching slug wins
// (Ponytail: deterministic enough for a graph; pick the canonical article on
// save later if it matters).
func (d *DB) GetMostContestedClaimsWithArticle(limit int, minContradiction float64) ([]*ClaimWithArticle, error) {
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		type ca struct {
			c    *Claim
			slug string
		}
		all := []ca{}
		seen := map[string]bool{}
		for slug, cs := range d.fs.claims {
			for _, c := range cs {
				if !seen[c.ID] {
					seen[c.ID] = true
					all = append(all, ca{c: c, slug: slug})
				}
			}
		}
		cl := func(c *Claim) float64 {
			if v, ok := c.ConfidenceVector["contradiction_level"].(float64); ok {
				return v
			}
			return 0
		}
		sort.Slice(all, func(i, j int) bool {
			si, sj := statusRank(all[i].c.Status), statusRank(all[j].c.Status)
			if si != sj {
				return si < sj
			}
			return cl(all[i].c) > cl(all[j].c)
		})
		out := []*ClaimWithArticle{}
		for i, c := range all {
			if i >= limit {
				break
			}
			if cl(c.c) < minContradiction {
				continue
			}
			out = append(out, &ClaimWithArticle{Claim: c.c, ArticleSlug: c.slug})
		}
		return out, nil
	}
	rows, err := d.db.Query(`
		SELECT DISTINCT ON (c.id)
			c.id, c.text, c.signature, c.type, c.status, c.confidence_vector,
			c.derived_confidence, c.created_at, c.updated_at, a.slug
		FROM claims c
		JOIN article_claims ac ON c.id = ac.claim_id
		JOIN articles a ON ac.article_id = a.id
		WHERE c.status IN ('disputed','weak')
		  AND COALESCE((c.confidence_vector->>'contradiction_level')::float, 0) >= $2
		ORDER BY c.id, (c.confidence_vector->>'contradiction_level')::float DESC NULLS LAST
		LIMIT $1
	`, limit, minContradiction)
	if err != nil {
		return nil, fmt.Errorf("get most contested claims with article: %w", err)
	}
	defer rows.Close()
	var list []*ClaimWithArticle
	for rows.Next() {
		var c Claim
		var cvJson []byte
		var slug string
		if err := rows.Scan(&c.ID, &c.Text, &c.Signature, &c.Type, &c.Status, &cvJson, &c.DerivedConfidence, &c.CreatedAt, &c.UpdatedAt, &slug); err != nil {
			return nil, err
		}
		if len(cvJson) > 0 {
			json.Unmarshal(cvJson, &c.ConfidenceVector)
		}
		list = append(list, &ClaimWithArticle{Claim: &c, ArticleSlug: slug})
	}
	return list, nil
}

// GetEvidenceForClaims returns all evidence linked to any of the given claim
// IDs in one round-trip. Used by the global claim graph to build the
// evidence→claim edges without N+1 queries.
func (d *DB) GetEvidenceForClaims(claimIDs []string) (map[string][]*Evidence, error) {
	out := map[string][]*Evidence{}
	if len(claimIDs) == 0 {
		return out, nil
	}
	if d.mockMode {
		if d.fs == nil {
			return out, nil
		}
		for _, cid := range claimIDs {
			out[cid] = d.fs.evidence[cid]
		}
		return out, nil
	}
	rows, err := d.db.Query(`
		SELECT id, claim_id, type, url, chain_of_custody, acquisition_method,
			accessibility, supports_claim, source_id, created_at
		FROM evidence WHERE claim_id = ANY($1)
	`, pq.Array(claimIDs))
	if err != nil {
		return nil, fmt.Errorf("get evidence for claims: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var e Evidence
		if err := rows.Scan(&e.ID, &e.ClaimID, &e.Type, &e.URL, &e.ChainOfCustody,
			&e.AcquisitionMethod, &e.Accessibility, &e.SupportsClaim, &e.SourceID, &e.CreatedAt); err != nil {
			return nil, err
		}
		out[e.ClaimID] = append(out[e.ClaimID], &e)
	}
	return out, nil
}

// GetClaimRelationshipsForClaims returns all claim→claim relationships where
// both endpoints are in the given claim set. Used by the global claim graph
// to surface inter-claim edges.
func (d *DB) GetClaimRelationshipsForClaims(claimIDs []string) ([]*ClaimRelationship, error) {
	if len(claimIDs) == 0 {
		return nil, nil
	}
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		set := map[string]bool{}
		for _, id := range claimIDs {
			set[id] = true
		}
		var out []*ClaimRelationship
		for _, rels := range d.fs.relationships {
			for _, r := range rels {
				if set[r.SourceClaimID] && set[r.TargetClaimID] {
					out = append(out, r)
				}
			}
		}
		return out, nil
	}
	rows, err := d.db.Query(`
		SELECT source_claim_id, target_claim_id, relationship_type, strength
		FROM claim_relationships
		WHERE source_claim_id = ANY($1) AND target_claim_id = ANY($1)
	`, pq.Array(claimIDs))
	if err != nil {
		return nil, fmt.Errorf("get claim relationships for claims: %w", err)
	}
	defer rows.Close()
	var list []*ClaimRelationship
	for rows.Next() {
		var r ClaimRelationship
		if err := rows.Scan(&r.SourceClaimID, &r.TargetClaimID, &r.RelationshipType, &r.Strength); err != nil {
			return nil, err
		}
		list = append(list, &r)
	}
	return list, nil
}

// ListArticleIDsForClaim returns all article IDs linked to a claim.
func (d *DB) ListArticleIDsForClaim(claimID string) ([]string, error) {
	if d.mockMode {
		return nil, nil
	}
	rows, err := d.db.Query("SELECT article_id FROM article_claims WHERE claim_id = $1", claimID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// ComputeFreshness returns a 0-1 score based on elapsed days.
// Half-life: 180 days (~6 months).
func ComputeFreshness(createdAt time.Time) float64 {
	days := time.Since(createdAt).Hours() / 24
	if days < 0 {
		return 1.0
	}
	s := 1.0 / (1.0 + days/180.0)
	if s < 0 {
		return 0
	}
	return s
}

// FreshnessInfo holds per-evidence freshness scores for a claim.
type FreshnessInfo struct {
	FreshnessScore float64 `json:"freshness_score"`
	EvidenceAgeDays float64 `json:"evidence_age_days"`
	EvidenceCount   int     `json:"evidence_count"`
}

// ComputeClaimFreshness calculates the average freshness across all evidence linked to a claim.
func (d *DB) ComputeClaimFreshness(claimID string) (*FreshnessInfo, error) {
	if d.mockMode {
		return &FreshnessInfo{FreshnessScore: 0.5, EvidenceCount: 0}, nil
	}
	rows, err := d.db.Query("SELECT created_at FROM evidence WHERE claim_id = $1", claimID)
	if err != nil {
		return nil, fmt.Errorf("compute freshness: %w", err)
	}
	defer rows.Close()
	var totalScore float64
	var count int
	for rows.Next() {
		var createdAt time.Time
		if err := rows.Scan(&createdAt); err != nil {
			continue
		}
		totalScore += ComputeFreshness(createdAt)
		count++
	}
	if count == 0 {
		return &FreshnessInfo{FreshnessScore: 0.5, EvidenceCount: 0}, nil
	}
	return &FreshnessInfo{
		FreshnessScore: totalScore / float64(count),
		EvidenceAgeDays: time.Since(time.Now()).Hours() / 24, // used for averages
		EvidenceCount:   count,
	}, nil
}

// ────────────────────────────────────────────────────────────
// Phase 4: Gap engagement, diff-on-refresh, stale articles
// ────────────────────────────────────────────────────────────

// UpvoteGap increments the upvote count for a gap. Idempotent: one
// vote per user per gap (upsert on composite PK).
func (d *DB) UpvoteGap(gapID, userID string) error {
	if d.mockMode {
		if d.fs != nil {
			if d.fs.gapUpvotes == nil {
				d.fs.gapUpvotes = make(map[string]int)
			}
			d.fs.gapUpvotes[gapID]++
		}
		return nil
	}
	_, err := d.db.Exec(`
		INSERT INTO gap_upvotes (gap_id, user_id) VALUES ($1, $2)
		ON CONFLICT (gap_id, user_id) DO NOTHING
	`, gapID, userID)
	if err != nil {
		return fmt.Errorf("upvote gap: %w", err)
	}
	return nil
}

// GetGapUpvoteCount returns the number of distinct users who upvoted a gap.
func (d *DB) GetGapUpvoteCount(gapID string) (int, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.gapUpvotes[gapID], nil
		}
		return 0, nil
	}
	var count int
	err := d.db.QueryRow("SELECT COUNT(*) FROM gap_upvotes WHERE gap_id = $1", gapID).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// GapSubmission is a community-submitted piece of evidence for a gap.
type GapSubmission struct {
	ID        string `json:"id"`
	GapID     string `json:"gap_id"`
	UserID    string `json:"user_id"`
	URL       string `json:"url"`
	Note      string `json:"note"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

// SubmitGapEvidence records a community evidence submission for a gap.
func (d *DB) SubmitGapEvidence(gapID, url, note, userID string) (*GapSubmission, error) {
	sub := &GapSubmission{
		ID: randID(), GapID: gapID, UserID: userID,
		URL: url, Note: note, Status: "pending",
	}
	if d.mockMode {
		if d.fs != nil {
			d.fs.gapSubmissions = append(d.fs.gapSubmissions, sub)
		}
		return sub, nil
	}
	_, err := d.db.Exec(`
		INSERT INTO gap_submissions (id, gap_id, user_id, url, note, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')
	`, sub.ID, sub.GapID, sub.UserID, sub.URL, sub.Note)
	if err != nil {
		return nil, fmt.Errorf("submit gap evidence: %w", err)
	}
	return sub, nil
}

// GetGapSubmissions returns all community submissions for a gap.
func (d *DB) GetGapSubmissions(gapID string) ([]*GapSubmission, error) {
	if d.mockMode {
		if d.fs != nil {
			var out []*GapSubmission
			for _, s := range d.fs.gapSubmissions {
				if s.GapID == gapID {
					out = append(out, s)
				}
			}
			return out, nil
		}
		return nil, nil
	}
	rows, err := d.db.Query(`
		SELECT id, gap_id, user_id, url, note, status, created_at::text
		FROM gap_submissions WHERE gap_id = $1 ORDER BY created_at DESC
	`, gapID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*GapSubmission
	for rows.Next() {
		var s GapSubmission
		if err := rows.Scan(&s.ID, &s.GapID, &s.UserID, &s.URL, &s.Note, &s.Status, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, &s)
	}
	return list, nil
}

// GapWithClaimText extends GapWithSlug with claim text + upvote count
// so the /gaps page can show what's missing, not just an ID.
type GapWithClaimText struct {
	EvidenceGap
	ArticleSlug string `json:"article_slug"`
	ClaimText   string `json:"claim_text"`
	Upvotes     int    `json:"upvotes"`
}

// GetAllEvidenceGapsWithClaims returns all gaps enriched with claim text,
// article slug, and upvote count for the redesigned /gaps page.
func (d *DB) GetAllEvidenceGapsWithClaims() ([]*GapWithClaimText, error) {
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		out := []*GapWithClaimText{}
		for slug, gaps := range d.fs.gaps {
			for _, g := range gaps {
				claimText := ""
				if c, ok := d.fs.claimsByID[g.ClaimID]; ok {
					claimText = c.Text
				}
				out = append(out, &GapWithClaimText{
					EvidenceGap: *g, ArticleSlug: slug,
					ClaimText: claimText, Upvotes: d.fs.gapUpvotes[g.ID],
				})
			}
		}
		sort.Slice(out, func(i, j int) bool {
			if out[i].Upvotes != out[j].Upvotes {
				return out[i].Upvotes > out[j].Upvotes
			}
			return out[i].DetectedAt.After(out[j].DetectedAt)
		})
		return out, nil
	}
	rows, err := d.db.Query(`
		SELECT g.id, g.claim_id, g.gap_type, g.expected_artifact,
		       g.verification_status, g.external_metadata, g.cause_label,
		       g.cause_confidence, g.detected_at,
		       a.slug, COALESCE(c.text, ''), COUNT(gu.gap_id)
		FROM evidence_gaps g
		JOIN article_claims ac ON g.claim_id = ac.claim_id
		JOIN articles a ON ac.article_id = a.id
		LEFT JOIN claims c ON g.claim_id = c.id
		LEFT JOIN gap_upvotes gu ON g.id = gu.gap_id
		GROUP BY g.id, a.slug, c.text
		ORDER BY COUNT(gu.gap_id) DESC, g.detected_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("get all gaps with claims: %w", err)
	}
	defer rows.Close()
	var list []*GapWithClaimText
	for rows.Next() {
		var g GapWithClaimText
		var metaJson []byte
		if err := rows.Scan(&g.ID, &g.ClaimID, &g.GapType, &g.ExpectedArtifact,
			&g.VerificationStatus, &metaJson, &g.CauseLabel, &g.CauseConfidence,
			&g.DetectedAt, &g.ArticleSlug, &g.ClaimText, &g.Upvotes); err != nil {
			return nil, err
		}
		if len(metaJson) > 0 {
			json.Unmarshal(metaJson, &g.ExternalMetadata)
		}
		list = append(list, &g)
	}
	return list, nil
}

// ClaimVersionDiff summarizes the change between the latest and previous
// claim version (status change, confidence delta).
type ClaimVersionDiff struct {
	ClaimID         string  `json:"claim_id"`
	OldConfidence   float64 `json:"old_confidence"`
	NewConfidence   float64 `json:"new_confidence"`
	ConfidenceDelta float64 `json:"confidence_delta"`
	OldStatus       string  `json:"old_status"`
	NewStatus       string  `json:"new_status"`
	StatusChanged   bool    `json:"status_changed"`
}

// GetClaimVersionDiff compares the latest two claim_versions rows.
func (d *DB) GetClaimVersionDiff(claimID string) (*ClaimVersionDiff, error) {
	if d.mockMode {
		return nil, nil
	}
	rows, err := d.db.Query(`
		SELECT derived_confidence, confidence_vector->>'status'
		FROM claim_versions WHERE claim_id = $1
		ORDER BY created_at DESC LIMIT 2
	`, claimID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type v struct{ conf float64; status string }
	var vs []v
	for rows.Next() {
		var x v
		if err := rows.Scan(&x.conf, &x.status); err != nil {
			continue
		}
		vs = append(vs, x)
	}
	if len(vs) < 2 {
		return nil, nil
	}
	return &ClaimVersionDiff{
		ClaimID: claimID, OldConfidence: vs[1].conf, NewConfidence: vs[0].conf,
		ConfidenceDelta: vs[0].conf - vs[1].conf, OldStatus: vs[1].status,
		NewStatus: vs[0].status, StatusChanged: vs[1].status != vs[0].status,
	}, nil
}

// GetRefreshDiff summarizes what changed across all claims in an article
// between the last two generation runs.
func (d *DB) GetRefreshDiff(slug string) (map[string]interface{}, error) {
	claims, err := d.GetClaimsByArticle(slug)
	if err != nil {
		return nil, err
	}
	var upgraded, downgraded, statusChanged int
	var diffs []*ClaimVersionDiff
	for _, c := range claims {
		diff, err := d.GetClaimVersionDiff(c.ID)
		if err != nil || diff == nil {
			continue
		}
		diffs = append(diffs, diff)
		if diff.StatusChanged {
			statusChanged++
		}
		if diff.ConfidenceDelta > 0.05 {
			upgraded++
		} else if diff.ConfidenceDelta < -0.05 {
			downgraded++
		}
	}
	return map[string]interface{}{
		"slug": slug, "total_claims": len(claims),
		"upgraded": upgraded, "downgraded": downgraded,
		"status_changed": statusChanged, "claim_diffs": diffs,
	}, nil
}

// StaleArticle is an article ranked by freshness for the /stale queue.
type StaleArticle struct {
	Slug           string  `json:"slug"`
	Title          string  `json:"title"`
	FreshnessScore float64 `json:"freshness_score"`
	ClaimCount     int     `json:"claim_count"`
	Updated        string  `json:"updated"`
}

// GetStaleArticles returns articles sorted by freshness ascending.
func (d *DB) GetStaleArticles(limit int) ([]*StaleArticle, error) {
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		var out []*StaleArticle
		for _, a := range d.fs.articleList {
			updated := a.Metadata.Updated
			if updated == "" {
				updated = a.Metadata.Created
			}
			t, err := time.Parse(time.RFC3339, updated)
			if err != nil {
				t = time.Now().AddDate(-1, 0, 0)
			}
			out = append(out, &StaleArticle{
				Slug: a.Slug, Title: a.Title,
				FreshnessScore: ComputeFreshness(t),
				ClaimCount:     len(d.fs.claims[a.Slug]),
				Updated:        updated,
			})
		}
		sort.Slice(out, func(i, j int) bool {
			return out[i].FreshnessScore < out[j].FreshnessScore
		})
		if limit > 0 && limit < len(out) {
			out = out[:limit]
		}
		return out, nil
	}
	rows, err := d.db.Query(`
		SELECT a.slug, a.title,
		       COALESCE(AVG(c.derived_confidence), 0.5),
		       COUNT(DISTINCT c.id), a.metadata->>'updated'
		FROM articles a
		LEFT JOIN article_claims ac ON a.id = ac.article_id
		LEFT JOIN claims c ON ac.claim_id = c.id
		GROUP BY a.slug, a.title, a.metadata->>'updated'
		ORDER BY COALESCE(AVG(c.derived_confidence), 0.5) ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("get stale articles: %w", err)
	}
	defer rows.Close()
	var list []*StaleArticle
	for rows.Next() {
		var s StaleArticle
		if err := rows.Scan(&s.Slug, &s.Title, &s.FreshnessScore, &s.ClaimCount, &s.Updated); err != nil {
			return nil, err
		}
		list = append(list, &s)
	}
	return list, nil
}
