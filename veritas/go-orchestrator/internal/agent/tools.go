package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
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
			{Type: "function", Function: ToolFunctionDef{Name: "generate_image", Description: "Generate an image using AI. Returns a URL to the generated image.", Parameters: json.RawMessage(`{"type":"object","properties":{"prompt":{"type":"string","description":"Detailed image generation prompt"},"caption":{"type":"string","description":"Optional short caption"}},"required":["prompt"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "generate_video", Description: "Generate a short video clip from a text description using AI video generation.", Parameters: json.RawMessage(`{"type":"object","properties":{"prompt":{"type":"string","description":"Detailed text description"},"caption":{"type":"string","description":"Caption for the video"}},"required":["prompt"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "verify_citation", Description: "Verify a claim against a source URL. Returns a confidence score and explanation.", Parameters: json.RawMessage(`{"type":"object","properties":{"claim":{"type":"string","description":"The claim to verify"},"sourceUrl":{"type":"string","description":"The URL of the source"}},"required":["claim","sourceUrl"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "suggest_related", Description: "Find articles and topics related to a given slug.", Parameters: json.RawMessage(`{"type":"object","properties":{"slug":{"type":"string","description":"Article slug to find related topics for"}},"required":["slug"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "task", Description: "Delegate a sub-task to a sub-agent for parallel research.", Parameters: json.RawMessage(`{"type":"object","properties":{"objective":{"type":"string","description":"What the sub-agent should accomplish"},"tools":{"type":"array","items":{"type":"string"},"description":"Tools the sub-agent may use"}},"required":["objective"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "mem_store", Description: "Store a piece of information about the user for future conversations.", Parameters: json.RawMessage(`{"type":"object","properties":{"key":{"type":"string","description":"Memory key"},"value":{"type":"string","description":"The value to remember"}},"required":["key","value"]}`)}},
			{Type: "function", Function: ToolFunctionDef{Name: "mem_recall", Description: "Retrieve stored information about the user from previous conversations.", Parameters: json.RawMessage(`{"type":"object","properties":{"key":{"type":"string","description":"Memory key to look up"}},"required":["key"]}`)}},
		}...,
	)
}

type ToolExecutors struct {
	WebSearch       ToolExecutor
	RenderBlocks    ToolExecutor
	WebFetch        ToolExecutor
	VerifyCitation  ToolExecutor
	GenerateImage   ToolExecutor
	GenerateVideo   ToolExecutor
}

func BuiltinToolExecutors() ToolExecutors {
	return ToolExecutors{
		WebSearch:       webSearchExecutor,
		RenderBlocks:    renderBlocksExecutor,
		WebFetch:        webFetchExecutor,
		VerifyCitation:  verifyCitationExecutor,
		GenerateImage:   generateImageExecutor,
		GenerateVideo:   generateVideoExecutor,
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
	key := os.Getenv("TAVILY_API_KEY")
	if key == "" {
		key = os.Getenv("FIRECRAWL_API_KEY")
		if key != "" {
			return firecrawlSearch(query, maxResults)
		}
		return nil, fmt.Errorf("no search API key configured")
	}
	body := map[string]interface{}{
		"api_key":       key,
		"query":         query,
		"max_results":   maxResults,
		"search_depth":  "advanced",
		"include_answer": false,
	}
	payload, _ := json.Marshal(body)
	resp, err := http.Post("https://api.tavily.com/search", "application/json", bytes.NewReader(payload))
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

// RealRetrieveDocuments performs real web retrieval for the epistemic
// retrieve node. It runs the main query plus 2–3 sub-queries through
// generalWebSearch (Tavily or Firecrawl), then fetches the full text of
// the top 3 URLs via a simple HTTP GET. Results are deduplicated by URL.
// Returns a flat list of RetrievedDoc. When no search API key is
// configured, returns nil (the pipeline falls back to LLM-only mode).
func RealRetrieveDocuments(query string) ([]RetrievedDoc, error) {
	// Build related sub-queries to broaden recall.
	subQueries := []string{
		query,
		query + " history background",
		query + " controversy debate",
	}

	var allDocs []RetrievedDoc
	seen := map[string]bool{}

	for _, sq := range subQueries {
		results, err := generalWebSearch(sq, 5)
		if err != nil {
			continue // one failed sub-query shouldn't kill the whole retrieve
		}
		for _, r := range results {
			if seen[r.URL] || r.URL == "" {
				continue
			}
			seen[r.URL] = true

			// Fetch the full page text for richer evidence.
			text := fetchURLText(r.URL)
			if text == "" {
				text = r.Snippet
			}
			if len(text) > 8000 {
				text = text[:8000]
			}

			allDocs = append(allDocs, RetrievedDoc{
				ID:      "doc-" + shortHash(r.URL),
				Title:   r.Title,
				Text:    text,
				URL:     r.URL,
				Snippet: r.Snippet,
			})

			if len(allDocs) >= 9 {
				return allDocs, nil
			}
		}
	}

	if len(allDocs) == 0 {
		return nil, fmt.Errorf("no search API key configured")
	}
	return allDocs, nil
}

// fetchURLText does a simple HTTP GET and strips HTML to return plain text.
func fetchURLText(rawURL string) string {
	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", rawURL, nil)
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return ""
	}
	body, _ := io.ReadAll(resp.Body)
	text := string(body)
	text = tagRegex.ReplaceAllString(text, "")
	text = wsRegex.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
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
		"query": query,
		"limit": maxResults,
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
					Title   string `json:"title"`
					Permalink string `json:"permalink"`
					Selftext string `json:"selftext"`
					Subreddit string `json:"subreddit"`
					URL     string `json:"url"`
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
	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", p.URL, nil)
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	resp, err := client.Do(req)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf("Fetch failed: %v", err)}, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return ToolResult{Result: fmt.Sprintf("HTTP %d: %s", resp.StatusCode, resp.Status)}, nil
	}
	raw, _ := io.ReadAll(resp.Body)
	text := string(raw)
	text = tagRegex.ReplaceAllString(text, "")
	text = wsRegex.ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	if len(text) > 8000 {
		text = text[:8000]
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
	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", p.SourceURL, nil)
	req.Header.Set("User-Agent", "Truthseekers/1.0 (encyclopedia agent)")
	resp, err := client.Do(req)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf(`{"supported":false,"confidence":0,"explanation":"Failed to fetch: %v"}`, err)}, nil
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	html := string(raw)
	text := tagRegex.ReplaceAllString(html, " ")
	text = wsRegex.ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	if len(text) > 6000 {
		text = text[:6000]
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
		"model": "stable-diffusion-3.5-large",
		"prompt": p.Prompt,
		"n": 1,
		"size": "1024x1024",
		"quality": "auto",
		"response_format": "b64_json",
		"output_format": "png",
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
	filename := fmt.Sprintf("chat-%d.png", time.Now().UnixMilli())
	path := imageDir + "/" + filename
	decoded := doResp.Data[0].B64JSON
	if err := os.WriteFile(path, []byte(decoded), 0644); err != nil {
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




