package storage

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// fileStore is the in-memory backing store used when PostgreSQL is
// unavailable (mock mode). Instead of returning hardcoded fake articles,
// it loads real article JSON from a data directory on disk so the entire
// product — list, search, single article, crossref graph, claims, gaps —
// works with zero infrastructure.
type fileStore struct {
	articles    map[string]*Article
	articleList []*Article // ordered by created_at desc
	claims      map[string][]*Claim
	claimsByID  map[string]*Claim
	evidence    map[string][]*Evidence
	gaps        map[string][]*EvidenceGap
	edges       []*GraphEdge
	backlinks   map[string][]*GraphEdge // target slug -> edges
	relationships map[string][]*ClaimRelationship // slug -> claim relationships
	views       map[string]int
	gapUpvotes   map[string]int // gap_id -> upvote count
	gapSubmissions []*GapSubmission
}

// resolveDataDir finds the encyclopedia data directory. It tries the
// provided path first, then a few common relative locations so the server
// works regardless of the working directory it was launched from.
func resolveDataDir(dataDir string) string {
	candidates := []string{}
	if dataDir != "" {
		candidates = append(candidates, dataDir)
	}
	candidates = append(candidates,
		"data/encyclopedia",
		"../../data/encyclopedia",
		"../../../data/encyclopedia",
		"../../../../data/encyclopedia",
	)
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	return ""
}

// loadFileStore scans dataDir for *.json article files and builds a fully
// populated in-memory store, including synthetic claims, evidence, gaps and
// cross-reference graph edges derived from the article content. This lets
// the epistemic surfaces (provenance chips, /gaps, claim graph) render real
// data even without a database.
func loadFileStore(dataDir string) (*fileStore, error) {
	dir := resolveDataDir(dataDir)
	fs := &fileStore{
		articles:      map[string]*Article{},
		claims:        map[string][]*Claim{},
		claimsByID:    map[string]*Claim{},
		evidence:      map[string][]*Evidence{},
		gaps:          map[string][]*EvidenceGap{},
		backlinks:     map[string][]*GraphEdge{},
		relationships: map[string][]*ClaimRelationship{},
		views:         map[string]int{},
		gapUpvotes:    map[string]int{},
	}
	if dir == "" {
		return fs, nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read data dir %s: %w", dir, err)
	}

	// Phase 1: load every article file.
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		raw, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var a Article
		if err := json.Unmarshal(raw, &a); err != nil {
			log.Printf("[filestore] WARNING: failed to unmarshal %s: %v — article skipped", e.Name(), err)
			continue
		}
		if a.Slug == "" {
			a.Slug = strings.TrimSuffix(e.Name(), ".json")
		}
		if a.Title == "" {
			a.Title = a.Slug
		}
		info, _ := e.Info()
		var ts time.Time
		if info != nil {
			ts = info.ModTime().UTC()
		} else {
			ts = time.Now().UTC()
		}
		if a.CreatedAt.IsZero() {
			a.CreatedAt = ts
		}
		a.UpdatedAt = ts
		if a.Metadata.Status == "" {
			a.Metadata.Status = "published"
		}
		if a.Metadata.Created == "" {
			a.Metadata.Created = ts.Format(time.RFC3339)
		}
		a.Metadata.Updated = ts.Format(time.RFC3339)
		if a.Metadata.Version == 0 {
			a.Metadata.Version = 1
		}
		if a.DerivedConfidence == 0 {
			a.DerivedConfidence = 0.82
		}
		fs.articles[a.Slug] = &a
		fs.views[a.Slug] = deterministicViews(a.Slug)
	}
	fs.finalize()
	return fs, nil
}

// finalizeFileStore builds crossref edges, derives claims, and orders the
// article list. Split from loadFileStore so the article map is complete
// before crossref title resolution runs.
func (fs *fileStore) finalize() {
	// Crossref graph edges: resolve a crossref target to a real slug when
	// its title matches another article's title or slug; otherwise keep the
	// raw title (matching legacy SaveArticle behavior).
	titleToSlug := map[string]string{}
	for slug, a := range fs.articles {
		titleToSlug[strings.ToLower(a.Title)] = slug
	}
	for slug, a := range fs.articles {
		for _, cr := range a.Crossrefs {
			target := cr.Title
			if t, ok := titleToSlug[strings.ToLower(cr.Title)]; ok {
				target = t
			} else if _, isSlug := fs.articles[cr.Title]; isSlug {
				target = cr.Title
			}
			rel := cr.Relationship
			if rel == "" {
				rel = "related"
			}
			fs.edges = append(fs.edges, &GraphEdge{Source: slug, Target: target, Relationship: rel})
			fs.backlinks[target] = append(fs.backlinks[target], &GraphEdge{Source: slug, Target: target, Relationship: rel})
		}
	}

	// Derive synthetic claims + evidence + gaps per article.
	for slug, a := range fs.articles {
		fs.deriveClaimsFor(slug, a)
	}

	// Derive synthetic claim relationships per article: supported claims
	// support each other; disputed claims contradict supported ones.
	for slug, claims := range fs.claims {
		fs.deriveRelationshipsFor(slug, claims)
	}

	// Ordered article list (newest first).
	fs.articleList = make([]*Article, 0, len(fs.articles))
	for _, a := range fs.articles {
		fs.articleList = append(fs.articleList, a)
	}
	sort.Slice(fs.articleList, func(i, j int) bool {
		return fs.articleList[i].CreatedAt.After(fs.articleList[j].CreatedAt)
	})
}

// deriveClaimsFor turns an article's sections into synthetic claims with
// confidence vectors, links evidence (real citation URLs where available),
// and records an evidence gap. Claim IDs are deterministic (hash of
// slug+section) so they are stable across restarts.
func (fs *fileStore) deriveClaimsFor(slug string, a *Article) {
	now := time.Now().UTC()
	statuses := []string{"supported", "supported", "weak", "disputed"}
	for i, sec := range a.Sections {
		if len(sec.Content) == 0 {
			continue
		}
		text := firstSentence(sec.Content)
		if text == "" {
			continue
		}
		cid := stableID(slug + ":" + sec.ID)
		status := statuses[i%len(statuses)]
		conf := 0.9 - float64(i%4)*0.12
		if conf < 0.5 {
			conf = 0.5
		}
		claim := &Claim{
			ID:                cid,
			Text:              text,
			Signature:         ClaimSignature(text),
			Type:              "factual",
			Status:            status,
			DerivedConfidence: conf,
			ConfidenceVector: map[string]interface{}{
				"evidence_strength":   round2(conf),
				"corroboration_index": round2(conf - 0.05),
				"source_diversity":    round2(0.6 + float64(i%3)*0.1),
				"recency":             0.7,
				"contradiction_level": round2(1 - conf),
				"bias_risk":           0.3,
			},
			CreatedAt: a.CreatedAt,
			UpdatedAt: now,
		}
		fs.claims[slug] = append(fs.claims[slug], claim)
		fs.claimsByID[cid] = claim

		// Link one evidence item from the article's citations (cycling).
		if len(a.Citations) > 0 {
			cit := a.Citations[i%len(a.Citations)]
			evID := cid + "-ev"
			fs.evidence[cid] = append(fs.evidence[cid], &Evidence{
				ID:                evID,
				ClaimID:           cid,
				Type:              "primary_document",
				URL:               cit.URL,
				ChainOfCustody:    "unverified",
				AcquisitionMethod: "retrieval",
				Accessibility:     "public",
				SupportsClaim:     true,
				CreatedAt:         now,
			})
		}

		// Stop after a handful of claims per article to stay lightweight.
		if i >= 5 {
			break
		}
	}

	// One synthetic evidence gap per article.
	if len(a.Sections) > 0 {
		gapID := stableID(slug + ":gap")
		fs.gaps[slug] = append(fs.gaps[slug], &EvidenceGap{
			ID:                 gapID,
			ClaimID:            firstClaimID(fs.claims[slug]),
			GapType:            "expected",
			ExpectedArtifact:   "primary_source",
			VerificationStatus: "unverified_gap",
			CauseLabel:         "unlocatable",
			CauseConfidence:    0.5,
			DetectedAt:         now,
		})
	}
}

// deriveRelationshipsFor builds synthetic typed edges between an article's
// claims so the claim graph has a spine of supports/contradicts relations in
// file-backed mode. Supported claims support each other; disputed claims
// contradict supported ones.
func (fs *fileStore) deriveRelationshipsFor(slug string, claims []*Claim) {
	var supported, disputed []*Claim
	for _, c := range claims {
		switch c.Status {
		case "disputed":
			disputed = append(disputed, c)
		case "supported":
			supported = append(supported, c)
		}
	}
	// supports: chain supported claims together.
	for i := 0; i < len(supported)-1; i++ {
		fs.relationships[slug] = append(fs.relationships[slug], &ClaimRelationship{
			SourceClaimID:    supported[i].ID,
			TargetClaimID:    supported[i+1].ID,
			RelationshipType: "supports",
			Strength:         0.8,
		})
	}
	// contradicts: disputed claims push against supported ones.
	for i, d := range disputed {
		if len(supported) == 0 {
			// A lone disputed claim still registers as disputing the first claim.
			if len(claims) > 1 {
				tgt := claims[0].ID
				if tgt != d.ID {
					fs.relationships[slug] = append(fs.relationships[slug], &ClaimRelationship{
						SourceClaimID:    d.ID,
						TargetClaimID:    tgt,
						RelationshipType: "contradicts",
						Strength:         round2(float64(i%3+3) / 6),
					})
				}
			}
			continue
		}
		tgt := supported[i%len(supported)].ID
		if tgt == d.ID {
			tgt = supported[0].ID
		}
		fs.relationships[slug] = append(fs.relationships[slug], &ClaimRelationship{
			SourceClaimID:    d.ID,
			TargetClaimID:    tgt,
			RelationshipType: "contradicts",
			Strength:         round2(float64(i%3+3) / 6),
		})
	}
	// related: link the remaining claims in a loose ring for visual cohesion.
	if len(claims) > 2 {
		for i := 0; i < len(claims); i++ {
			j := (i + 2) % len(claims)
			if i == j {
				continue
			}
			if fs.relationshipExists(claims[i].ID, claims[j].ID, slug) {
				continue
			}
			fs.relationships[slug] = append(fs.relationships[slug], &ClaimRelationship{
				SourceClaimID:    claims[i].ID,
				TargetClaimID:    claims[j].ID,
				RelationshipType: "related",
				Strength:         0.3,
			})
		}
	}
}

// relationshipExists reports whether any typed edge already links the pair.
func (fs *fileStore) relationshipExists(a, b, slug string) bool {
	for _, r := range fs.relationships[slug] {
		if (r.SourceClaimID == a && r.TargetClaimID == b) || (r.SourceClaimID == b && r.TargetClaimID == a) {
			return true
		}
	}
	return false
}


// --- helpers ---

func firstSentence(content string) string {
	s := strings.TrimSpace(content)
	s = strings.TrimLeft(s, "*#> ")
	for _, sep := range []string{". ", "。", "? ", "! "} {
		if idx := strings.Index(s, sep); idx > 0 {
			return s[:idx+1]
		}
	}
	if len(s) > 160 {
		return s[:157] + "..."
	}
	return s
}

func firstClaimID(claims []*Claim) string {
	if len(claims) > 0 {
		return claims[0].ID
	}
	return ""
}

func stableID(seed string) string {
	sum := sha1.Sum([]byte(seed))
	h := hex.EncodeToString(sum[:16])
	return fmt.Sprintf("%s-%s-%s-%s-%s", h[0:8], h[8:12], h[12:16], h[16:20], h[20:32])
}

func deterministicViews(slug string) int {
	sum := sha1.Sum([]byte(slug))
	n := int(sum[0])<<16 | int(sum[1])<<8 | int(sum[2])
	return 5 + int(math.Mod(float64(n), 480.0)) // 5..484
}

func round2(f float64) float64 {
	return math.Round(f*100) / 100
}

