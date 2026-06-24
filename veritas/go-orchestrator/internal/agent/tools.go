package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

func ChatToolDefinitions() []ToolDefinition {
	return append(
		EpistemicToolDefinitions(),
		[]ToolDefinition{
			{Type: "function", Function: ToolFunctionDef{Name: "web_search", Description: "Search the web for current information on a topic", Parameters: json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"maxResults":{"type":"number","description":"Max results (default 5)"}},"required":["query"]}`)}},
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
		Query      string `json:"query"`
		MaxResults int    `json:"maxResults"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return ToolResult{Result: "Invalid arguments"}, nil
	}
	if p.MaxResults <= 0 {
		p.MaxResults = 5
	}
	key := os.Getenv("TAVILY_API_KEY")
	if key == "" {
		key = os.Getenv("FIRECRAWL_API_KEY")
		if key != "" {
			return firecrawlSearch(p.Query, p.MaxResults)
		}
		return ToolResult{Result: "No search API key configured"}, nil
	}
	body := map[string]interface{}{
		"api_key":      key,
		"query":        p.Query,
		"max_results":  p.MaxResults,
		"search_depth": "advanced",
		"include_answer": false,
	}
	payload, _ := json.Marshal(body)
	resp, err := http.Post("https://api.tavily.com/search", "application/json", bytes.NewReader(payload))
	if err != nil {
		return ToolResult{Result: fmt.Sprintf("Search failed: %v", err)}, nil
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
	type item struct {
		Title   string `json:"title"`
		URL     string `json:"url"`
		Snippet string `json:"snippet"`
	}
	var items []item
	for _, r := range result.Results {
		s := r.Content
		if len(s) > 500 {
			s = s[:500]
		}
		items = append(items, item{Title: r.Title, URL: r.URL, Snippet: s})
	}
	data, _ := json.Marshal(items)
	return ToolResult{Result: string(data)}, nil
}

func firecrawlSearch(query string, maxResults int) (ToolResult, error) {
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
		return ToolResult{Result: fmt.Sprintf("Search failed: %v", err)}, nil
	}
	defer resp.Body.Close()
	var result struct {
		Success bool `json:"success"`
		Data    []struct {
			Title     string `json:"title"`
			URL       string `json:"url"`
			Markdown  string `json:"markdown"`
			Description string `json:"description"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	type item struct {
		Title   string `json:"title"`
		URL     string `json:"url"`
		Snippet string `json:"snippet"`
	}
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
	data, _ := json.Marshal(items)
	return ToolResult{Result: string(data)}, nil
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
	route := defaultRoute()
	if route.APIKey == "" {
		return ToolResult{Result: `{"supported":false,"confidence":0,"explanation":"No API key configured"}`}, nil
	}
	return llmVerify(systemPrompt, userMsg, route)
}

func llmVerify(system, user string, route ModelRoute) (ToolResult, error) {
	body := map[string]interface{}{
		"model": route.ModelID,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"max_tokens": 500,
		"temperature": 0.3,
	}
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", route.BaseURL+"/chat/completions", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+route.APIKey)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ToolResult{Result: fmt.Sprintf(`{"supported":false,"confidence":0,"explanation":"LLM call failed: %v"}`, err)}, nil
	}
	defer resp.Body.Close()
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if len(result.Choices) > 0 {
		return ToolResult{Result: result.Choices[0].Message.Content}, nil
	}
	return ToolResult{Result: `{"supported":false,"confidence":0,"explanation":"No response from LLM"}`}, nil
}

func generateImageExecutor(args json.RawMessage) (ToolResult, error) {
	var p struct {
		Prompt  string `json:"prompt"`
		Caption string `json:"caption"`
	}
	if err := json.Unmarshal(args, &p); err != nil || p.Prompt == "" {
		return ToolResult{Result: "Prompt required"}, nil
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


