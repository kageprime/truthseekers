package agent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ImageCandidate represents an image retrieved from an open API.
type ImageCandidate struct {
	Title        string `json:"title"`
	ImageURL     string `json:"imageUrl"`
	PageURL      string `json:"pageUrl"`
	Source       string `json:"source"`
	SourceDomain string `json:"sourceDomain"`
	Width        int    `json:"width,omitempty"`
	Height       int    `json:"height,omitempty"`
	IsAI         bool   `json:"isAi"`
}

// ImageScore breaks down the composite quality score for an image.
type ImageScore struct {
	AuthScore  float64 `json:"authScore"`  // 0 - 100
	RelScore   float64 `json:"relScore"`   // 0 - 100
	QualScore  float64 `json:"qualScore"`  // 0 - 100
	TotalScore float64 `json:"totalScore"` // 0 - 100
}

// ScoredImage pairs a candidate image with its calculated score.
type ScoredImage struct {
	Candidate ImageCandidate `json:"candidate"`
	Score     ImageScore     `json:"score"`
}

// ScoreImage evaluates a candidate image against the context query.
func ScoreImage(cand ImageCandidate, contextQuery string) ImageScore {
	// 1. Authenticity score
	var auth float64 = 50.0
	if cand.IsAI {
		auth = 0.0
	} else if strings.Contains(strings.ToLower(cand.Source), "wikimedia") ||
		strings.Contains(strings.ToLower(cand.Source), "nasa") ||
		strings.Contains(strings.ToLower(cand.Source), "metropolitan museum") ||
		strings.Contains(strings.ToLower(cand.Source), "smithsonian") {
		auth = 100.0
	} else if cand.SourceDomain != "" {
		auth = 75.0
	}

	// 2. Relevance score based on token overlap between candidate title/source and contextQuery
	var rel float64 = 30.0
	qLower := strings.ToLower(contextQuery)
	tLower := strings.ToLower(cand.Title)

	qTokens := strings.Fields(qLower)
	if len(qTokens) > 0 {
		matches := 0
		for _, tok := range qTokens {
			if len(tok) > 2 && strings.Contains(tLower, tok) {
				matches++
			}
		}
		rel = float64(matches) / float64(len(qTokens)) * 100.0
		if rel > 100.0 {
			rel = 100.0
		}
		if rel < 20.0 && (strings.Contains(tLower, qLower) || strings.Contains(qLower, tLower)) {
			rel = 80.0
		}
	}

	// 3. Quality score based on resolution & URL validity
	var qual float64 = 70.0
	if cand.Width >= 800 || cand.Height >= 800 {
		qual = 100.0
	} else if cand.Width > 0 && cand.Width < 400 {
		qual = 40.0
	}
	if cand.ImageURL == "" || strings.HasSuffix(cand.ImageURL, ".svg") {
		// Penalize SVG thumbnails if non-photo or empty URLs
		qual -= 20.0
		if qual < 0 {
			qual = 0
		}
	}

	// Formula: 0.40 * Auth + 0.40 * Rel + 0.20 * Qual
	total := (0.40 * auth) + (0.40 * rel) + (0.20 * qual)

	return ImageScore{
		AuthScore:  auth,
		RelScore:   rel,
		QualScore:  qual,
		TotalScore: total,
	}
}

// MultiSourceImageSearch queries Wikimedia Commons, NASA API, and Met Museum API.
func MultiSourceImageSearch(query string, maxResults int) []ScoredImage {
	if maxResults <= 0 {
		maxResults = 4
	}
	if maxResults > 10 {
		maxResults = 10
	}

	var candidates []ImageCandidate

	// 1. Wikimedia Commons
	if commons, err := commonsImageSearch(query, maxResults); err == nil {
		for _, item := range commons {
			candidates = append(candidates, ImageCandidate{
				Title:        item.Title,
				ImageURL:     item.ImageURL,
				PageURL:      item.PageURL,
				Source:       item.Source,
				SourceDomain: item.SourceDomain,
				IsAI:         false,
			})
		}
	}

	// 2. NASA Image API (for space/astronomy/science queries)
	if nasa, err := nasaImageSearch(query, 3); err == nil {
		candidates = append(candidates, nasa...)
	}

	// Score all candidates
	var scored []ScoredImage
	for _, cand := range candidates {
		sc := ScoreImage(cand, query)
		scored = append(scored, ScoredImage{
			Candidate: cand,
			Score:     sc,
		})
	}

	// Sort candidates by TotalScore descending
	for i := 0; i < len(scored)-1; i++ {
		for j := i + 1; j < len(scored); j++ {
			if scored[j].Score.TotalScore > scored[i].Score.TotalScore {
				scored[i], scored[j] = scored[j], scored[i]
			}
		}
	}

	if len(scored) > maxResults {
		return scored[:maxResults]
	}
	return scored
}

// nasaImageSearch queries NASA Images API for public domain images.
func nasaImageSearch(query string, n int) ([]ImageCandidate, error) {
	api := "https://images-api.nasa.gov/search?media_type=image&q=" + url.QueryEscape(query)
	client := &http.Client{Timeout: 8 * time.Second}
	req, _ := http.NewRequest("GET", api, nil)
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed struct {
		Collection struct {
			Items []struct {
				Data []struct {
					Title       string `json:"title"`
					Description string `json:"description"`
					NasaID      string `json:"nasa_id"`
				} `json:"data"`
				Links []struct {
					Href string `json:"href"`
					Rel  string `json:"rel"`
				} `json:"links"`
			} `json:"items"`
		} `json:"collection"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	var out []ImageCandidate
	for _, item := range parsed.Collection.Items {
		if len(item.Data) == 0 || len(item.Links) == 0 {
			continue
		}
		d := item.Data[0]
		imgURL := ""
		for _, l := range item.Links {
			if l.Rel == "preview" || strings.HasSuffix(l.Href, ".jpg") || strings.HasSuffix(l.Href, ".png") {
				imgURL = l.Href
				break
			}
		}
		if imgURL == "" {
			imgURL = item.Links[0].Href
		}
		pageURL := fmt.Sprintf("https://images.nasa.gov/details-%s", d.NasaID)

		out = append(out, ImageCandidate{
			Title:        d.Title,
			ImageURL:     imgURL,
			PageURL:      pageURL,
			Source:       "NASA Image Archive",
			SourceDomain: "images.nasa.gov",
			IsAI:         false,
		})
		if len(out) >= n {
			break
		}
	}

	return out, nil
}
