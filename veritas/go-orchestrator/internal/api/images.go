package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

// Article visuals: generated PNGs are stored in Postgres (article_images)
// and served here, because the dyno filesystem is ephemeral. The pipeline
// attaches them as section media, which the frontend already renders via
// articleToBlocks — no frontend change needed.

var imageNameRe = regexp.MustCompile(`^[a-z0-9-]+\.(png|svg)$`)

// handleArticleImage serves GET /images/{name}. Public read (article
// content is public); rate-limited at registration like other reads.
func (s *Server) handleArticleImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"use GET"}`, http.StatusMethodNotAllowed)
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/images/")
	if !imageNameRe.MatchString(name) {
		http.Error(w, `{"error":"invalid image name"}`, http.StatusBadRequest)
		return
	}
	img, err := s.db.GetArticleImage(name)
	if err != nil || img == nil {
		http.Error(w, `{"error":"image not found"}`, http.StatusNotFound)
		return
	}
	mime := img.Mime
	if mime == "" {
		mime = "image/png"
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(img.Data)
}

// apiPublicBase resolves the absolute base URL for served image srcs.
// Frontend resolves root-relative srcs against its own origin, so srcs must
// be absolute API URLs.
func apiPublicBase() string {
	if b := strings.TrimSpace(os.Getenv("API_PUBLIC_URL")); b != "" {
		return strings.TrimSuffix(b, "/")
	}
	if b := strings.TrimSpace(os.Getenv("NEXT_PUBLIC_API_URL")); b != "" {
		return strings.TrimSuffix(b, "/")
	}
	return "http://localhost:4097"
}

// imageProvider resolves the image backend: Muse Image via the Meta Model
// API key first (already configured in prod — same key as the text
// pipeline), DigitalOcean Inference as fallback. Returns base URL, model,
// and key.
func (s *Server) imageProvider() (baseURL, model, apiKey string, ok bool) {
	if s.credStore != nil {
		if k := s.credStore.Get("meta"); k != "" {
			return "https://api.meta.ai/v1", "muse-image-1.0", k, true
		}
		if k := s.credStore.Get("do"); k != "" {
			return "https://inference.do-ai.run/v1", "stable-diffusion-3.5-large", k, true
		}
	}
	if k := strings.TrimSpace(os.Getenv("MODEL_API_KEY")); k != "" {
		return "https://api.meta.ai/v1", "muse-image-1.0", k, true
	}
	if k := strings.TrimSpace(os.Getenv("MODEL_ACCESS_KEY")); k != "" {
		return "https://inference.do-ai.run/v1", "stable-diffusion-3.5-large", k, true
	}
	return "", "", "", false
}

// callImageAPI runs one text-to-image generation and returns raw PNG bytes.
// Both backends speak the OpenAI images shape; Muse returns a URL or b64,
// DO returns b64. Shared by the chat gateway executor and the pipeline.
func callImageAPI(baseURL, model, apiKey, prompt string) ([]byte, error) {
	body := map[string]interface{}{
		"model":  model,
		"prompt": prompt,
		"n":      1,
	}
	// ponytail: DO-only extras — Muse takes the minimal OpenAI shape.
	if !strings.Contains(baseURL, "api.meta.ai") {
		body["size"] = "1024x1024"
		body["quality"] = "auto"
		body["response_format"] = "b64_json"
		body["output_format"] = "png"
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", strings.TrimSuffix(baseURL, "/")+"/images/generations", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return nil, fmt.Errorf("image API %d: %s", resp.StatusCode, strings.TrimSpace(string(snippet)))
	}
	var doResp struct {
		Data []struct {
			B64JSON string `json:"b64_json"`
			URL     string `json:"url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doResp); err != nil {
		return nil, err
	}
	if len(doResp.Data) == 0 {
		return nil, fmt.Errorf("empty image result")
	}
	return fetchImageBytes(doResp.Data[0].B64JSON, doResp.Data[0].URL)
}

// fetchImageBytes resolves one OpenAI image object to raw bytes: inline
// b64 preferred, otherwise a server-side download of the (signed) URL.
func fetchImageBytes(b64, url string) ([]byte, error) {
	if b64 != "" {
		raw, err := base64.StdEncoding.DecodeString(b64)
		if err != nil || len(raw) == 0 || len(raw) > 10<<20 {
			return nil, fmt.Errorf("invalid image payload")
		}
		return raw, nil
	}
	if url == "" {
		return nil, fmt.Errorf("empty image result")
	}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("image download %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20+1))
	if err != nil || len(raw) == 0 || len(raw) > 10<<20 {
		return nil, fmt.Errorf("invalid image download")
	}
	return raw, nil
}

// generateArticleImages creates up to 3 visuals (hero + first two meaty
// sections) and attaches them as section media, then re-saves the article.
// Guaranteed visual output: if AI image API key is missing or fails, generates
// crisp SVG editorial visual plates so no article is left text-only.
func (s *Server) generateArticleImages(slug string, art *storage.Article) {
	baseURL, model, key, ok := s.imageProvider()
	if !ok {
		log.Printf("[images] slug=%s: no remote image key configured — using procedural visual plates", slug)
	} else {
		log.Printf("[images] slug=%s: generating via %s (%s)", slug, model, baseURL)
	}
	_ = s.db.SaveJob(slug, "media", "media", map[string]interface{}{"title": art.Title})
	BroadcastProgress(slug, "progress", map[string]interface{}{
		"slug": slug, "phase": "media", "node": "generate_media",
		"status": "running", "timestamp": time.Now().Unix(),
	})

	type target struct {
		secIdx  int // -1 = abstract hero on sections[0]
		name    string
		caption string
		prompt  string
	}
	clean := func(t string) string {
		t = anchorStripRe.ReplaceAllString(t, " ")
		t = strings.Join(strings.Fields(t), " ")
		if len(t) > 220 {
			t = t[:220] + "…"
		}
		return t
	}
	var targets []target
	if len(art.Sections) > 0 {
		targets = append(targets, target{-1, slug + "-hero.png",
			"Illustration: " + art.Title,
			"Encyclopedia editorial illustration, no text or words: " + art.Title + " — " + clean(art.Abstract)})
		n := 0
		for i := range art.Sections {
			if n >= 2 {
				break
			}
			if len(art.Sections[i].Content) < 200 || len(art.Sections[i].Media) > 0 {
				continue
			}
			n++
			targets = append(targets, target{i, fmt.Sprintf("%s-s%d.png", slug, n),
				"Illustration: " + art.Sections[i].Title,
				"Encyclopedia editorial illustration, no text or words: " + art.Sections[i].Title + " — " + clean(art.Sections[i].Content)})
		}
	}
	if len(targets) == 0 {
		return
	}
	base := apiPublicBase()
	made := 0
	for _, t := range targets {
		var raw []byte
		var mime = "image/png"
		var err error
		if ok {
			raw, err = callImageAPI(baseURL, model, key, t.prompt)
		} else {
			err = fmt.Errorf("no image provider key")
		}

		if err != nil {
			log.Printf("[images] slug=%s %s: %v — using procedural editorial visual plate", slug, t.name, err)
			t.name = strings.TrimSuffix(t.name, ".png") + ".svg"
			raw, mime = makeFallbackSVG(art.Title, t.caption)
		}

		if err := s.db.SaveArticleImage(t.name, slug, mime, raw); err != nil {
			log.Printf("[images] slug=%s save %s: %v", slug, t.name, err)
			continue
		}
		item := storage.MediaItem{Type: "image", Caption: t.caption, Src: base + "/images/" + t.name, Source: "ai-generated"}
		idx := t.secIdx
		if idx < 0 {
			idx = 0
		}
		art.Sections[idx].Media = append(art.Sections[idx].Media, item)
		made++
	}
	if made == 0 {
		return
	}
	if err := s.db.SaveArticle(art); err != nil {
		log.Printf("[images] slug=%s re-save with media: %v", slug, err)
		return
	}
	log.Printf("[images] slug=%s: %d/%d visuals attached", slug, made, len(targets))
}

func makeFallbackSVG(title, caption string) ([]byte, string) {
	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <linearGradient id="g1" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#1e293b"/>
      <stop offset="50%%" stop-color="#0f172a"/>
      <stop offset="100%%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="g2" x1="0%%" y1="0%%" x2="100%%" y2="0%%">
      <stop offset="0%%" stop-color="#c59b27"/>
      <stop offset="100%%" stop-color="#eab308"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#g1)"/>
  <circle cx="400" cy="210" r="140" fill="none" stroke="url(#g2)" stroke-width="2" stroke-dasharray="6,6" opacity="0.4"/>
  <circle cx="400" cy="210" r="90" fill="none" stroke="#eab308" stroke-width="1.5" opacity="0.6"/>
  <path d="M 200 350 Q 400 120 600 350" fill="none" stroke="url(#g2)" stroke-width="3" opacity="0.8"/>
  <rect x="40" y="400" width="720" height="60" fill="rgba(0,0,0,0.6)" rx="8"/>
  <text x="60" y="432" fill="#ffffff" font-family="Georgia, serif" font-size="20" font-weight="bold">%s</text>
  <text x="60" y="450" fill="#94a3b8" font-family="sans-serif" font-size="12">%s</text>
</svg>`, xmlEscape(title), xmlEscape(caption))
	return []byte(svg), "image/svg+xml"
}

func xmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	return s
}
