package agent

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// fetchWikipediaDocs queries Wikipedia's REST API for a topic summary and snippet.
func fetchWikipediaDocs(query string) ([]RetrievedDoc, error) {
	cleanQuery := strings.TrimSpace(query)
	if cleanQuery == "" {
		return nil, fmt.Errorf("empty query")
	}
	u := fmt.Sprintf("https://en.wikipedia.org/api/rest_v1/page/summary/%s", url.PathEscape(cleanQuery))
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Truthseekers-Veritas/1.0 (Encyclopedia Pipeline)")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("wikipedia API returned %d", resp.StatusCode)
	}

	var w struct {
		Title       string `json:"title"`
		Extract     string `json:"extract"`
		Description string `json:"description"`
		ContentURLs struct {
			Desktop struct {
				Page string `json:"page"`
			} `json:"desktop"`
		} `json:"content_urls"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&w); err != nil {
		return nil, err
	}
	if w.Extract == "" {
		return nil, fmt.Errorf("empty wikipedia extract")
	}

	pageURL := w.ContentURLs.Desktop.Page
	if pageURL == "" {
		pageURL = fmt.Sprintf("https://en.wikipedia.org/wiki/%s", url.PathEscape(w.Title))
	}

	docID := fmt.Sprintf("wiki-%s", strings.ToLower(strings.ReplaceAll(w.Title, " ", "-")))
	if len(docID) > 24 {
		docID = docID[:24]
	}

	doc := RetrievedDoc{
		ID:      docID,
		Title:   w.Title + " — Encyclopedia Reference",
		Text:    w.Extract,
		URL:     pageURL,
		Snippet: w.Extract,
	}
	return []RetrievedDoc{doc}, nil
}

// fetchArxivDocs queries the ArXiv API for scientific research papers on a topic.
func fetchArxivDocs(query string) ([]RetrievedDoc, error) {
	cleanQuery := strings.TrimSpace(query)
	if cleanQuery == "" {
		return nil, fmt.Errorf("empty query")
	}
	u := fmt.Sprintf("http://export.arxiv.org/api/query?search_query=all:%s&start=0&max_results=3", url.QueryEscape(cleanQuery))
	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("arxiv API status %d", resp.StatusCode)
	}

	type Feed struct {
		Entries []struct {
			ID      string `xml:"id"`
			Title   string `xml:"title"`
			Summary string `xml:"summary"`
		} `xml:"entry"`
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	var feed Feed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, err
	}

	var docs []RetrievedDoc
	for i, entry := range feed.Entries {
		cleanTitle := strings.Join(strings.Fields(entry.Title), " ")
		cleanSummary := strings.Join(strings.Fields(entry.Summary), " ")
		if cleanTitle == "" || cleanSummary == "" {
			continue
		}
		link := strings.TrimSpace(entry.ID)
		docs = append(docs, RetrievedDoc{
			ID:      fmt.Sprintf("arxiv-%d", i+1),
			Title:   cleanTitle + " (Academic Paper)",
			Text:    cleanSummary,
			URL:     link,
			Snippet: cleanSummary,
		})
	}
	return docs, nil
}

func init() {
	if RealRetrieve == nil {
		RealRetrieve = func(query string) ([]RetrievedDoc, error) {
			var allDocs []RetrievedDoc
			if wikiDocs, err := fetchWikipediaDocs(query); err == nil && len(wikiDocs) > 0 {
				allDocs = append(allDocs, wikiDocs...)
			}
			if arxivDocs, err := fetchArxivDocs(query); err == nil && len(arxivDocs) > 0 {
				allDocs = append(allDocs, arxivDocs...)
			}
			return allDocs, nil
		}
	}
}
