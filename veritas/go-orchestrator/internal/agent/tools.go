package agent

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// GatewaySearch routes web_search through the executor gateway for credential
// isolation and audit. When set, web_search calls the gateway instead of
// reading API keys from env vars directly.
var GatewaySearch func(connector, action string, args map[string]interface{}) (string, error)

// GatewayGenerateImage routes image generation through the executor gateway.
// When set, generate_image calls the gateway instead of reading
// MODEL_ACCESS_KEY from env.
var GatewayGenerateImage func(connector, action string, args map[string]interface{}) (string, error)

// RetrievedDoc is a real document fetched from web search + URL fetch.
type RetrievedDoc struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Text    string `json:"text"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

// RealRetrieve, when set by the server at boot, causes the epistemic
// retrieve node to call real web search (Tavily/Firecrawl) + URL fetch
// before invoking the LLM — grounding the pipeline in live evidence
// instead of model memory. When nil, the retrieve node falls back to
// the LLM-only mode (no external search keys configured).
var RealRetrieve func(query string) ([]RetrievedDoc, error)

// ponytail: run_command deleted (S4) — arbitrary LLM-driven shell exec is not
// sandboxable at this scope. If ever needed: admin-only + binary allowlist.
func ChatToolDefinitions() []ToolDefinition {
	return append(
		EpistemicToolDefinitions(),
		[]ToolDefinition{
			{Type: "function", Function: ToolFunctionDef{Name: "web_search", Description: "Search web sources for information on a topic. Supports general web, Reddit, and Internet Archive. Use 'sources' to narrow: web, reddit, archive, or news. Reddit search returns real Reddit results via their public API. Archive search queries the Internet Archive. Defaults to general web (Tavily/Firecrawl).", Parameters: json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"maxResults":{"type":"number","description":"Max results (default 5)"},"sources":{"type":"array","items":{"type":"string","enum":["web","reddit","archive","news"]},"description":"Source types to search (default: [\"web\"])"}},"required":["query"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "render_blocks", Description: "Render structured content blocks in the conversation. Use this for ALL rich content: timelines, maps (2D/3D), image galleries, citation lists, cross-references, diagrams (mermaid), headings, text, and dividers.", Parameters: json.RawMessage(`{"type":"object","properties":{"blocks":{"type":"array","description":"Array of block objects","items":{"type":"object","properties":{"type":{"type":"string","enum":["heading","text","section","timeline","image","video","gallery","citation","crossref","diagram","divider","map_2d","map_3d","table","list","pullquote"]},"data":{"type":"object"}},"required":["type","data"]}}},"required":["blocks"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "get_article", Description: "Look up an existing encyclopedia article by slug", Parameters: json.RawMessage(`{"type":"object","properties":{"slug":{"type":"string","description":"Article slug"}},"required":["slug"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "create_article", Description: "Generate a full encyclopedia article for a topic. This runs the entire pipeline (research, write, verify, etc.) and stores the result.", Parameters: json.RawMessage(`{"type":"object","properties":{"slug":{"type":"string","description":"Topic slug (lowercase, hyphenated)"}},"required":["slug"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "webfetch", Description: "Fetch the content of a specific URL and return its text.", Parameters: json.RawMessage(`{"type":"object","properties":{"url":{"type":"string","description":"The URL to fetch"}},"required":["url"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "article_search", Description: "Search the encyclopedia's existing knowledge base for articles matching a query.", Parameters: json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"maxResults":{"type":"number","description":"Max results (default 5)"}},"required":["query"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "get_map", Description: "Look up an existing map by slug or search by region/era.", Parameters: json.RawMessage(`{"type":"object","properties":{"slug":{"type":"string","description":"Map slug"}},"required":["slug"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "generate_image", Description: "Generate an image using AI. Returns a URL to the generated image. Prefer web_image_search first when a real photo (place, person, artifact, species) would teach better than an illustration.", Parameters: json.RawMessage(`{"type":"object","properties":{"prompt":{"type":"string","description":"Detailed image generation prompt"},"caption":{"type":"string","description":"Optional short caption"}},"required":["prompt"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "web_image_search", Description: "Search for real, freely-licensed photos (Wikimedia Commons) on a topic. Returns direct image URLs with source domain attribution — emit them as image/gallery blocks with the source field set so the UI shows a Source badge. Prefer this over generate_image for real-world subjects.", Parameters: json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Image search query"},"maxResults":{"type":"number","description":"Max images (default 4, max 10)"}},"required":["query"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "generate_video", Description: "Generate a short video clip from a text description using AI video generation.", Parameters: json.RawMessage(`{"type":"object","properties":{"prompt":{"type":"string","description":"Detailed text description"},"caption":{"type":"string","description":"Caption for the video"}},"required":["prompt"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "verify_citation", Description: "Verify a claim against a source URL. Returns a confidence score and explanation.", Parameters: json.RawMessage(`{"type":"object","properties":{"claim":{"type":"string","description":"The claim to verify"},"sourceUrl":{"type":"string","description":"The URL of the source"}},"required":["claim","sourceUrl"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "suggest_related", Description: "Find articles and topics related to a given slug.", Parameters: json.RawMessage(`{"type":"object","properties":{"slug":{"type":"string","description":"Article slug to find related topics for"}},"required":["slug"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "task", Description: "Delegate a sub-task to a sub-agent for parallel research.", Parameters: json.RawMessage(`{"type":"object","properties":{"objective":{"type":"string","description":"What the sub-agent should accomplish"},"tools":{"type":"array","items":{"type":"string"},"description":"Tools the sub-agent may use"}},"required":["objective"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "mem_store", Description: "Store a piece of information about the user for future conversations.", Parameters: json.RawMessage(`{"type":"object","properties":{"key":{"type":"string","description":"Memory key"},"value":{"type":"string","description":"The value to remember"}},"required":["key","value"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "mem_recall", Description: "Retrieve stored information about the user from previous conversations.", Parameters: json.RawMessage(`{"type":"object","properties":{"key":{"type":"string","description":"Memory key to look up"}},"required":["key"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "get_platform_status", Description: "Get real-time CMS platform metrics, active article generation jobs, open evidence gaps, contested claims, and platform health.", Parameters: json.RawMessage(`{"type":"object","properties":{}}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "get_autonomous_summary", Description: "Get a summary of all autonomous CMS actions Veritas has taken while you were away: stale article refreshes, gap scrutiny runs, graph reindexes, and any blocked actions that require your approval.", Parameters: json.RawMessage(`{"type":"object","properties":{}}`)}},
		}...,
	)
}

type ToolExecutors struct {
	WebSearch      ToolExecutor
	RenderBlocks   ToolExecutor
	WebFetch       ToolExecutor
	VerifyCitation ToolExecutor
	GenerateImage  ToolExecutor
	GenerateVideo  ToolExecutor
	WebImageSearch ToolExecutor
}

func BuiltinToolExecutors() ToolExecutors {
	return ToolExecutors{
		WebSearch:      webSearchExecutor,
		RenderBlocks:   renderBlocksExecutor,
		WebFetch:       webFetchExecutor,
		VerifyCitation: verifyCitationExecutor,
		GenerateImage:  generateImageExecutor,
		GenerateVideo:  generateVideoExecutor,
		WebImageSearch: webImageSearchExecutor,
	}
}

func MergeExecutors(builtins ToolExecutors, server map[string]ToolExecutor) map[string]ToolExecutor {
	return MergeExecutorsWithEpistemic(builtins, server, nil)
}

// MergeExecutorsWithEpistemic merges builtins, server tools, and optionally
// epistemic pipeline node executors into a single tool map.
func MergeExecutorsWithEpistemic(builtins ToolExecutors, server map[string]ToolExecutor, epistemic map[string]ToolExecutor) map[string]ToolExecutor {
	m := make(map[string]ToolExecutor, 25)
	m["web_search"] = builtins.WebSearch
	m["render_blocks"] = builtins.RenderBlocks
	m["webfetch"] = builtins.WebFetch
	m["verify_citation"] = builtins.VerifyCitation
	m["generate_image"] = builtins.GenerateImage
	m["generate_video"] = builtins.GenerateVideo
	m["web_image_search"] = builtins.WebImageSearch
	for k, v := range server {
		m[k] = v
	}
	for k, v := range epistemic {
		m[k] = v
	}
	return m
}

func webSearchExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		Query      string   `json:"query"`
		MaxResults int      `json:"maxResults"`
		Sources    []string `json:"sources"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return ToolResult{Result: "Invalid arguments"}, nil
	}
	if p.MaxResults <= 0 {
		p.MaxResults = 5
	}
	if len(p.Sources) == 0 {
		p.Sources = []string{"web"}
	}

	// When a gateway is configured, route all non-special source searches
	// through the gateway instead of reading API keys from env.
	sourcesHaveGateway := false
	for _, src := range p.Sources {
		if src == "web" || src == "news" {
			sourcesHaveGateway = true
		}
	}

	if GatewaySearch != nil && sourcesHaveGateway {
		argsMap := map[string]interface{}{
			"query": p.Query, "maxResults": p.MaxResults, "sources": p.Sources,
		}
		result, err := GatewaySearch("web_search", "search", argsMap)
		if err != nil {
			result = fmt.Sprintf("gateway error: %v", err)
		}
		return ToolResult{Result: result}, nil
	}

	var allItems []item
	seen := map[string]bool{}

	for _, src := range p.Sources {
		var results []item
		var err error
		switch src {
		case "reddit":
			results, err = redditSearch(p.Query, p.MaxResults)
		case "archive":
			results, err = archiveSearch(p.Query, p.MaxResults)
		default:
			results, err = generalWebSearch(p.Query, p.MaxResults)
		}
		if err != nil {
			continue
		}
		for _, r := range results {
			if !seen[r.URL] {
				seen[r.URL] = true
				allItems = append(allItems, r)
			}
		}
	}
	if len(allItems) == 0 {
		return ToolResult{Result: "[]"}, nil
	}
	data, _ := json.Marshal(allItems)
	return ToolResult{Result: string(data)}, nil
}

type item struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

func generalWebSearch(query string, maxResults int) ([]item, error) {
	return generalWebSearchDomains(query, maxResults, nil)
}

// generalWebSearchDomains is generalWebSearch plus an optional Tavily
// include_domains filter (e.g. ["x.com","twitter.com"] for social voices,
// ["reddit.com"] when the JSON API throttles). Empty domains = web-wide.
func generalWebSearchDomains(query string, maxResults int, domains []string) ([]item, error) {
	key := os.Getenv("TAVILY_API_KEY")
	if key == "" {
		key = os.Getenv("FIRECRAWL_API_KEY")
		if key != "" {
			return firecrawlSearch(query, maxResults)
		}
		return nil, fmt.Errorf("no search API key configured")
	}
	body := map[string]interface{}{
		"api_key":        key,
		"query":          query,
		"max_results":    maxResults,
		"search_depth":   "advanced",
		"include_answer": false,
	}
	if len(domains) > 0 {
		body["include_domains"] = domains
	}
	payload, _ := json.Marshal(body)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post("https://api.tavily.com/search", "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		Results []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Content string `json:"content"`
		} `json:"results"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	var items []item
	for _, r := range result.Results {
		s := r.Content
		if len(s) > 500 {
			s = s[:500]
		}
		items = append(items, item{Title: r.Title, URL: r.URL, Snippet: s})
	}
	return items, nil
}

// deepDocCap bounds total fetched docs per article retrieval (2 rounds).
const deepDocCap = 30

// fetchTextLen is the per-page evidence budget (up from 8000).
const fetchTextLen = 12000

// aspectQueries groups sub-queries into 3 parallel research aspects so each
// can run as a concurrent unit: origins, mechanism, and debate/reception.
func aspectQueries(query string) [3][]string {
	return [3][]string{
		{query, query + " history background origins"},
		{query + " how it works mechanism explained", query + " evidence data study"},
		{query + " controversy debate criticism", query + " recent news"},
	}
}

// scoreDomain boosts primary/academic/official sources in the merge so the
// top-30 cut prefers evidence over SEO filler. Tiny heuristic, no new deps.
func scoreDomain(rawURL string) int {
	u, err := url.Parse(rawURL)
	if err != nil {
		return 0
	}
	h := strings.ToLower(u.Host)
	switch {
	case strings.HasSuffix(h, ".edu") || strings.HasSuffix(h, ".gov"),
		strings.Contains(h, "arxiv.org"), strings.Contains(h, "nature.com"),
		strings.Contains(h, "science.org"), strings.Contains(h, "nih.gov"),
		strings.Contains(h, "archive.org"):
		return 3
	case strings.Contains(h, "wikipedia.org"), strings.Contains(h, "britannica.com"),
		strings.Contains(h, "reuters.com"), strings.Contains(h, "apnews.com"),
		strings.Contains(h, "bbc."):
		return 2
	case strings.Contains(h, "x.com") || strings.Contains(h, "twitter.com"),
		strings.Contains(h, "reddit.com"):
		return 1
	default:
		return 0
	}
}

type cand struct {
	item   item
	score  int
	aspect int
}

type fetchedDoc struct {
	item   item
	text   string
	aspect int
}

// RealRetrieveDocuments performs 2-round deep retrieval for the epistemic
// retrieve node: 3 aspect groups fan out concurrently (web + reddit +
// archive), results merge by source score, full text is fetched in parallel,
// then a gap-driven round 2 covers the weakest aspect. Returns up to
// deepDocCap docs. When no search API key is configured, returns nil (the
// pipeline falls back to LLM-only mode).
func RealRetrieveDocuments(query string) ([]RetrievedDoc, error) {
	aspects := aspectQueries(query)

	type hit struct {
		item   item
		aspect int
	}
	hitCh := make(chan hit, 128)
	var wg sync.WaitGroup

	// Round 1: 3 aspects in parallel; within an aspect the two web queries
	// plus reddit + archive run sequentially (bounded API fan-out: 6 web +
	// 3 reddit + 3 archive calls total).
	for ai, queries := range aspects {
		wg.Add(1)
		go func(ai int, queries []string) {
			defer wg.Done()
			for _, sq := range queries {
				for _, r := range searchAll(sq, 5, ai == 2) {
					hitCh <- hit{item: r, aspect: ai}
				}
			}
			for _, r := range redditOrEmpty(query, 5) {
				hitCh <- hit{item: r, aspect: ai}
			}
			for _, r := range archiveOrEmpty(query, 5) {
				hitCh <- hit{item: r, aspect: ai}
			}
		}(ai, queries)
	}
	go func() { wg.Wait(); close(hitCh) }()

	seen := map[string]bool{}
	var cands []cand
	for h := range hitCh {
		if h.item.URL == "" || seen[h.item.URL] {
			continue
		}
		seen[h.item.URL] = true
		cands = append(cands, cand{item: h.item, score: scoreDomain(h.item.URL), aspect: h.aspect})
	}
	if len(cands) == 0 {
		return nil, fmt.Errorf("no search API key configured")
	}
	sortCands(cands)

	// Parallel fetch with a small semaphore; Wayback fallback inside
	// fetchURLText covers dead/suppressed pages.
	limit := len(cands)
	if limit > deepDocCap-6 {
		limit = deepDocCap - 6 // reserve headroom for round-2 + follow-links
	}
	fetched := fetchParallel(cands[:limit])

	// Round 2: cover the aspect with fewest fetched docs (gap-driven).
	counts := map[int]int{}
	for _, d := range fetched {
		counts[d.aspect]++
	}
	weakest, fewest := 0, int(^uint(0)>>1)
	for ai := 0; ai < 3; ai++ {
		if counts[ai] < fewest {
			weakest, fewest = ai, counts[ai]
		}
	}
	if fewest < 4 {
		extra := searchAll(query+" "+[]string{"primary sources", "in-depth analysis", "opposing views"}[weakest], 5, weakest == 2)
		var extraCands []cand
		for _, r := range extra {
			if r.URL == "" || seen[r.URL] {
				continue
			}
			seen[r.URL] = true
			extraCands = append(extraCands, cand{item: r, score: scoreDomain(r.URL), aspect: weakest})
		}
		sortCands(extraCands)
		if len(extraCands) > 6 {
			extraCands = extraCands[:6]
		}
		fetched = append(fetched, fetchParallel(extraCands)...)
	}

	// Follow-links: one hop from the top-5 scored docs.
	followed := followOutlinks(fetched, seen, 6)
	fetched = append(fetched, followed...)

	var allDocs []RetrievedDoc
	for _, f := range fetched {
		text := f.text
		if text == "" {
			text = f.item.Snippet
		}
		allDocs = append(allDocs, RetrievedDoc{
			ID:      "doc-" + shortHash(f.item.URL),
			Title:   f.item.Title,
			Text:    text,
			URL:     f.item.URL,
			Snippet: f.item.Snippet,
		})
		if len(allDocs) >= deepDocCap {
			break
		}
	}
	if len(allDocs) == 0 {
		return nil, fmt.Errorf("no search API key configured")
	}
	return allDocs, nil
}

// searchAll runs the web query plus an x.com/reddit-scoped twin for the
// debate aspect (social voices without a new scraper or key).
func searchAll(sq string, n int, social bool) []item {
	results, err := generalWebSearch(sq, n)
	if err != nil {
		return nil
	}
	if social {
		if extra, err := generalWebSearchDomains(sq, 3, []string{"x.com", "twitter.com", "reddit.com"}); err == nil {
			results = append(results, extra...)
		}
	}
	return results
}

func redditOrEmpty(q string, n int) []item {
	if r, err := redditSearch(q, n); err == nil {
		return r
	}
	return nil
}

func archiveOrEmpty(q string, n int) []item {
	if r, err := archiveSearch(q, n); err == nil {
		return r
	}
	return nil
}

// sortCands orders candidates by source score (primaries first), stable.
func sortCands(cands []cand) {
	sort.SliceStable(cands, func(i, j int) bool { return cands[i].score > cands[j].score })
}

// fetchParallel fetches full text for candidates with bounded concurrency,
// preserving input order. Empty fetches keep the snippet (filled by caller).
func fetchParallel(cands []cand) []fetchedDoc {
	out := make([]fetchedDoc, len(cands))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for i, c := range cands {
		wg.Add(1)
		go func(i int, c cand) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			text := fetchURLText(c.item.URL)
			if len(text) > fetchTextLen {
				text = text[:fetchTextLen]
			}
			out[i] = fetchedDoc{item: c.item, text: text, aspect: c.aspect}
		}(i, c)
	}
	wg.Wait()
	return out
}

var hrefRe = regexp.MustCompile(`href=["'](https?://[^"'<> ]+)["']`)

// followOutlinks fetches one hop from the top-5 fetched docs: up to n fresh
// absolute http(s) outlinks not already seen. Best-effort, failures skipped.
func followOutlinks(fetched []fetchedDoc, seen map[string]bool, n int) []fetchedDoc {
	top := len(fetched)
	if top > 5 {
		top = 5
	}
	var extra []cand
	for _, f := range fetched[:top] {
		raw := fetchRawHTML(f.item.URL)
		if raw == "" {
			continue
		}
		for _, m := range hrefRe.FindAllStringSubmatch(raw, -1) {
			if len(extra) >= n*2 {
				break
			}
			u := m[1]
			if seen[u] {
				continue
			}
			seen[u] = true
			extra = append(extra, cand{item: item{Title: u, URL: u}, score: scoreDomain(u), aspect: f.aspect})
			if len(extra) >= n*2 {
				break
			}
		}
		if len(extra) >= n*2 {
			break
		}
	}
	if len(extra) == 0 {
		return nil
	}
	sortCands(extra)
	if len(extra) > n {
		extra = extra[:n]
	}
	return fetchParallel(extra)
}

// fetchRawHTML returns up to 300KB of raw HTML for outlink extraction,
// reusing the SSRF-safe client. Empty on any failure.
func fetchRawHTML(rawURL string) string {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return ""
	}
	if hostBlocked(u.Hostname()) {
		return ""
	}
	resp, err := safeClient().Do(&http.Request{Method: "GET", URL: u, Header: http.Header{"User-Agent": []string{"Truthseekers/1.0 (encyclopedia agent)"}}})
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return ""
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 300<<10))
	return string(body)
}

// fetchURLText does a guarded HTTP GET and strips HTML to plain text (S8),
// falling back to the Wayback Machine's latest snapshot when the live fetch
// fails (dead pages, suppressed sources).
func fetchURLText(rawURL string) string {
	if text, err := fetchSafeText(rawURL, fetchTextLen); err == nil && text != "" {
		return text
	}
	if snap := waybackSnapshot(rawURL); snap != "" {
		if text, err := fetchSafeText(snap, fetchTextLen); err == nil {
			return text
		}
	}
	return ""
}

// waybackSnapshot resolves the latest archived snapshot URL for rawURL via
// the archive.org availability API (no key, stdlib). Empty when none exists.
func waybackSnapshot(rawURL string) string {
	api := "https://archive.org/wayback/available?url=" + url.QueryEscape(rawURL)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(api)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	var parsed struct {
		Closest struct {
			URL string `json:"url"`
		} `json:"closest"`
	}
	if json.NewDecoder(resp.Body).Decode(&parsed) != nil || parsed.Closest.URL == "" {
		return ""
	}
	return parsed.Closest.URL
}

// fetchSafeText fetches a URL with SSRF guards: http/https only, no
// loopback/link-local/private targets (checked at resolve + dial time to
// blunt DNS rebinding), ≤3 redirects, 2 MB cap.
func fetchSafeText(rawURL string, maxChars int) (string, error) {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", fmt.Errorf("blocked URL")
	}
	if hostBlocked(u.Hostname()) {
		return "", fmt.Errorf("blocked host")
	}
	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	resp, err := safeClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	text := tagRegex.ReplaceAllString(string(body), "")
	text = wsRegex.ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	if len(text) > maxChars {
		text = text[:maxChars]
	}
	return text, nil
}

// safeClient returns an HTTP client that refuses private targets. Redirects
// are capped at 3 and re-validated for scheme; the dialer re-resolves the
// host so a redirect/DNS swap to 169.254.x or localhost still fails.
func safeClient() *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, _, err := net.SplitHostPort(addr)
			if err != nil {
				host = addr
			}
			if hostBlocked(host) {
				return nil, fmt.Errorf("blocked host")
			}
			if ip := net.ParseIP(strings.Trim(host, "[]")); ip != nil {
				if blockedIP(ip) {
					return nil, fmt.Errorf("blocked IP")
				}
				return dialer.DialContext(ctx, network, addr)
			}
			ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil || len(ips) == 0 {
				return nil, fmt.Errorf("DNS failed")
			}
			for _, ip := range ips {
				if blockedIP(ip.IP) {
					return nil, fmt.Errorf("blocked IP")
				}
			}
			return dialer.DialContext(ctx, network, addr)
		},
		TLSHandshakeTimeout: 10 * time.Second,
	}
	return &http.Client{
		Timeout:   15 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return fmt.Errorf("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("blocked redirect")
			}
			if hostBlocked(req.URL.Hostname()) {
				return fmt.Errorf("blocked redirect host")
			}
			return nil
		},
	}
}

func blockedIP(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() || ip.IsPrivate()
}

// hostBlocked catches literal/metadata names without DNS. IP literals are
// checked via blockedIP at resolve/dial time.
func hostBlocked(host string) bool {
	h := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(host), "."))
	if h == "" {
		return true
	}
	if h == "localhost" || strings.HasSuffix(h, ".localhost") {
		return true
	}
	if h == "metadata.google.internal" || h == "metadata.google.internal." {
		return true
	}
	if ip := net.ParseIP(strings.Trim(h, "[]")); ip != nil {
		return blockedIP(ip)
	}
	return false
}

// shortHash returns the first 8 hex chars of an MD5 hash of s (used for
// generating stable document IDs from URLs).
func shortHash(s string) string {
	// Simple deterministic hash without importing crypto/md5.
	h := uint32(0)
	for i := 0; i < len(s); i++ {
		h = h*31 + uint32(s[i])
	}
	hex := fmt.Sprintf("%08x", h)
	return hex
}

func firecrawlSearch(query string, maxResults int) ([]item, error) {
	key := os.Getenv("FIRECRAWL_API_KEY")
	body := map[string]interface{}{
		"query":         query,
		"limit":         maxResults,
		"scrapeOptions": map[string]interface{}{"formats": []string{"markdown"}},
	}
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", "https://api.firecrawl.dev/v1/search", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result struct {
		Success bool `json:"success"`
		Data    []struct {
			Title       string `json:"title"`
			URL         string `json:"url"`
			Markdown    string `json:"markdown"`
			Description string `json:"description"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	var items []item
	if result.Success {
		for _, r := range result.Data {
			s := r.Markdown
			if s == "" {
				s = r.Description
			}
			if len(s) > 500 {
				s = s[:500]
			}
			items = append(items, item{Title: r.Title, URL: r.URL, Snippet: s})
		}
	}
	return items, nil
}

func redditSearch(query string, maxResults int) ([]item, error) {
	url := fmt.Sprintf("https://www.reddit.com/search.json?q=%s&limit=%d&raw_json=1", url.QueryEscape(query), maxResults)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var redditResp struct {
		Data struct {
			Children []struct {
				Data struct {
					Title     string `json:"title"`
					Permalink string `json:"permalink"`
					Selftext  string `json:"selftext"`
					Subreddit string `json:"subreddit"`
					URL       string `json:"url"`
				} `json:"data"`
			} `json:"children"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&redditResp); err != nil {
		return nil, err
	}

	var items []item
	for _, c := range redditResp.Data.Children {
		d := c.Data
		fullURL := "https://reddit.com" + d.Permalink
		s := d.Selftext
		if len(s) > 500 {
			s = s[:500]
		}
		if s == "" {
			s = d.URL
		}
		items = append(items, item{
			Title:   fmt.Sprintf("[r/%s] %s", d.Subreddit, d.Title),
			URL:     fullURL,
			Snippet: s,
		})
	}
	return items, nil
}

func archiveSearch(query string, maxResults int) ([]item, error) {
	url := fmt.Sprintf("https://archive.org/advancedsearch.php?q=%s&fl[]=identifier,title,description,creator,date&rows=%d&page=1&output=json", url.QueryEscape(query), maxResults)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var archiveResp struct {
		Response struct {
			Docs []struct {
				Identifier  string `json:"identifier"`
				Title       string `json:"title"`
				Description string `json:"description"`
				Creator     string `json:"creator"`
				Date        string `json:"date"`
			} `json:"docs"`
		} `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&archiveResp); err != nil {
		return nil, err
	}

	var items []item
	for _, d := range archiveResp.Response.Docs {
		s := d.Description
		if len(s) > 500 {
			s = s[:500]
		}
		if s == "" {
			s = d.Creator + " " + d.Date
		}
		items = append(items, item{
			Title:   d.Title,
			URL:     fmt.Sprintf("https://archive.org/details/%s", d.Identifier),
			Snippet: s,
		})
	}
	return items, nil
}

func renderBlocksExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		Blocks []json.RawMessage `json:"blocks"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		_ = err
	}
	var blocks []Block
	for i, b := range p.Blocks {
		var raw map[string]interface{}
		json.Unmarshal(b, &raw)
		btype, _ := raw["type"].(string)
		block := Block{Type: btype}
		if d, ok := raw["data"]; ok {
			dJSON, _ := json.Marshal(d)
			block.Data = dJSON
		}
		if block.Type == "" {
			block.Type = "text"
		}
		if block.Data == nil {
			block.Data = json.RawMessage("{}")
		}
		blocks = append(blocks, block)
		_ = i
	}
	result, _ := json.Marshal(map[string]int{"blockCount": len(blocks)})
	return ToolResult{Result: string(result), Blocks: blocks}, nil
}

var tagRegex = regexp.MustCompile(`<[^>]+>`)
var wsRegex = regexp.MustCompile(`\s+`)

func webFetchExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(args, &p); err != nil || p.URL == "" {
		return ToolResult{Result: "Invalid URL"}, nil
	}
	text, err := fetchSafeText(p.URL, 8000)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf("Fetch refused/failed: %v", err)}, nil
	}
	return ToolResult{Result: text}, nil
}

func verifyCitationExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		Claim     string `json:"claim"`
		SourceURL string `json:"sourceUrl"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return ToolResult{Result: `{"supported":false,"confidence":0,"explanation":"Invalid arguments"}`}, nil
	}
	text, err := fetchSafeText(p.SourceURL, 6000)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf(`{"supported":false,"confidence":0,"explanation":"Failed to fetch: %v"}`, err)}, nil
	}
	if text == "" {
		return ToolResult{Result: `{"supported":false,"confidence":0,"explanation":"No readable text extracted from source"}`}, nil
	}
	systemPrompt := "You are a fact-checking AI. Given a claim and source text, determine if the source supports the claim. Respond with JSON only: { supported: boolean, confidence: number (0-1), explanation: string }"
	userMsg := fmt.Sprintf("Claim: \"%s\"\n\nSource text:\n%s", p.Claim, text)
	result, err := SendPromptJSON(systemPrompt, userMsg, epistemicModel)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf(`{"supported":false,"confidence":0,"explanation":"LLM call failed: %v"}`, err)}, nil
	}
	return ToolResult{Result: string(result)}, nil
}

func generateImageExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		Prompt  string `json:"prompt"`
		Caption string `json:"caption"`
	}
	if err := json.Unmarshal(args, &p); err != nil || p.Prompt == "" {
		return ToolResult{Result: "Prompt required"}, nil
	}

	// Route through gateway for credential isolation.
	if GatewayGenerateImage != nil {
		argsMap := map[string]interface{}{
			"prompt": p.Prompt, "caption": p.Caption,
		}
		result, err := GatewayGenerateImage("generate_image", "images/generations", argsMap)
		if err != nil {
			return ToolResult{Result: fmt.Sprintf("gateway error: %v", err)}, nil
		}
		return ToolResult{Result: result}, nil
	}

	key := os.Getenv("MODEL_ACCESS_KEY")
	if key == "" {
		return ToolResult{Result: "Image generation: MODEL_ACCESS_KEY not configured"}, nil
	}
	body := map[string]interface{}{
		"model":           "stable-diffusion-3.5-large",
		"prompt":          p.Prompt,
		"n":               1,
		"size":            "1024x1024",
		"quality":         "auto",
		"response_format": "b64_json",
		"output_format":   "png",
	}
	payload, _ := json.Marshal(body)
	resp, err := http.Post("https://inference.do-ai.run/v1/images/generations", "application/json", bytes.NewReader(payload))
	if err != nil {
		return ToolResult{Result: fmt.Sprintf("Image generation failed: %v", err)}, nil
	}
	defer resp.Body.Close()
	var doResp struct {
		Created int `json:"created"`
		Data    []struct {
			B64JSON string `json:"b64_json"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doResp); err != nil {
		return ToolResult{Result: fmt.Sprintf("Image generation decode failed: %v", err)}, nil
	}
	if len(doResp.Data) == 0 || doResp.Data[0].B64JSON == "" {
		return ToolResult{Result: "Image generation returned empty result"}, nil
	}
	imageDir := os.Getenv("ENCARTA_IMAGE_DIR")
	if imageDir == "" {
		wd, _ := os.Getwd()
		imageDir = wd + "/public/images"
	}
	os.MkdirAll(imageDir, 0755)
	// ponytail: decode payload + random name (S18, same as server executor).
	raw, err := base64.StdEncoding.DecodeString(doResp.Data[0].B64JSON)
	if err != nil || len(raw) == 0 || len(raw) > 10<<20 {
		return ToolResult{Result: "Image generation returned an invalid result"}, nil
	}
	var rb [8]byte
	if _, err := rand.Read(rb[:]); err != nil {
		return ToolResult{Result: "Image save failed: entropy unavailable"}, nil
	}
	filename := fmt.Sprintf("chat-%x.png", rb)
	path := imageDir + "/" + filename
	if err := os.WriteFile(path, raw, 0644); err != nil {
		return ToolResult{Result: fmt.Sprintf("Image save failed: %v", err)}, nil
	}
	publicURL := os.Getenv("ENCARTA_PUBLIC_URL")
	if publicURL == "" {
		publicURL = "http://localhost:4097"
	}
	src := publicURL + "/images/" + filename
	caption := p.Caption
	if caption == "" {
		caption = "Generated image"
	}
	blockData, _ := json.Marshal(map[string]string{"src": src, "caption": caption})
	result, _ := json.Marshal(map[string]string{"url": src, "caption": caption})
	return ToolResult{Result: string(result), Blocks: []Block{{Type: "image", Data: blockData}}}, nil
}

// webImageResult is a real sourced photo: direct image URL plus the domain
// attribution the frontend renders as a Source badge.
type webImageResult struct {
	Title        string `json:"title"`
	ImageURL     string `json:"imageUrl"`
	PageURL      string `json:"pageUrl"`
	Source       string `json:"source"`
	SourceDomain string `json:"sourceDomain"`
}

// webImageSearchExecutor searches Wikimedia Commons (no key, stdlib) for
// real freely-licensed photos. Results carry source attribution so image /
// gallery blocks can set their source field.
func webImageSearchExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		Query      string `json:"query"`
		MaxResults int    `json:"maxResults"`
	}
	if err := json.Unmarshal(args, &p); err != nil || strings.TrimSpace(p.Query) == "" {
		return ToolResult{Result: "Query required"}, nil
	}
	if p.MaxResults <= 0 {
		p.MaxResults = 4
	}
	if p.MaxResults > 10 {
		p.MaxResults = 10
	}
	scored := MultiSourceImageSearch(p.Query, p.MaxResults)
	if len(scored) == 0 {
		return ToolResult{Result: "[]"}, nil
	}
	var results []webImageResult
	for _, item := range scored {
		results = append(results, webImageResult{
			Title:        item.Candidate.Title,
			ImageURL:     item.Candidate.ImageURL,
			PageURL:      item.Candidate.PageURL,
			Source:       item.Candidate.Source,
			SourceDomain: item.Candidate.SourceDomain,
		})
	}
	data, _ := json.Marshal(results)
	return ToolResult{Result: string(data)}, nil
}

// commonsImageSearch queries the Wikimedia Commons API for filetype:bitmap
// images matching query, returning thumb URLs (1024px) + file page URLs.
func commonsImageSearch(query string, n int) ([]webImageResult, error) {
	api := "https://commons.wikimedia.org/w/api.php?action=query&format=json" +
		"&generator=search&gsrsearch=" + url.QueryEscape("filetype:bitmap "+query) +
		"&gsrnamespace=6&gsrlimit=" + fmt.Sprintf("%d", n) +
		"&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1024"
	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", api, nil)
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var parsed struct {
		Query struct {
			Pages map[string]struct {
				Title     string `json:"title"`
				ImageInfo []struct {
					ThumbURL    string `json:"thumburl"`
					URL         string `json:"url"`
					Description string `json:"descriptionurl"`
				} `json:"imageinfo"`
			} `json:"pages"`
		} `json:"query"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	var out []webImageResult
	for _, page := range parsed.Query.Pages {
		if len(page.ImageInfo) == 0 {
			continue
		}
		ii := page.ImageInfo[0]
		src := ii.ThumbURL
		if src == "" {
			src = ii.URL
		}
		if src == "" {
			continue
		}
		title := strings.TrimPrefix(page.Title, "File:")
		out = append(out, webImageResult{
			Title:        title,
			ImageURL:     src,
			PageURL:      ii.Description,
			Source:       "Wikimedia Commons",
			SourceDomain: "commons.wikimedia.org",
		})
	}
	return out, nil
}

func generateVideoExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		Prompt  string `json:"prompt"`
		Caption string `json:"caption"`
	}
	if err := json.Unmarshal(args, &p); err != nil || p.Prompt == "" {
		return ToolResult{Result: "Prompt required"}, nil
	}
	return ToolResult{Result: `{"error":"Video generation not available in this deployment"}`, Blocks: []Block{
		{Type: "text", Data: json.RawMessage(`{"content":"Video generation is not yet available in this deployment."}`)},
	}}, nil
}
