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

var imageNameRe = regexp.MustCompile(`^[a-z0-9-]+\.png$`)

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

// imageAPIKey resolves the server-side image credential: hot-swapped
// credstore first (admin UI, no redeploy), env fallback.
func (s *Server) imageAPIKey() string {
	if s.credStore != nil {
		if k := s.credStore.Get("do"); k != "" {
			return k
		}
	}
	return os.Getenv("MODEL_ACCESS_KEY")
}

// callImageAPI runs one DO Inference image generation and returns raw PNG
// bytes. Shared by the chat gateway executor and the article pipeline.
func callImageAPI(baseURL, apiKey, prompt string) ([]byte, error) {
	body := map[string]interface{}{
		"model":           "stable-diffusion-3.5-large",
		"prompt":          prompt,
		"n":               1,
		"size":            "1024x1024",
		"quality":         "auto",
		"response_format": "b64_json",
		"output_format":   "png",
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
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doResp); err != nil {
		return nil, err
	}
	if len(doResp.Data) == 0 || doResp.Data[0].B64JSON == "" {
		return nil, fmt.Errorf("empty image result")
	}
	raw, err := base64.StdEncoding.DecodeString(doResp.Data[0].B64JSON)
	if err != nil || len(raw) == 0 || len(raw) > 10<<20 {
		return nil, fmt.Errorf("invalid image payload")
	}
	return raw, nil
}

// generateArticleImages creates up to 3 visuals (hero + first two meaty
// sections) and attaches them as section media, then re-saves the article.
// Non-fatal: a missing key or failed call logs loudly and the article ships
// text-only — never fail a 3-minute generation over images.
func (s *Server) generateArticleImages(slug string, art *storage.Article) {
	key := s.imageAPIKey()
	if key == "" {
		log.Printf("[images] slug=%s: MODEL_ACCESS_KEY/credstore(do) unset — skipping visuals (set via admin credentials page)", slug)
		return
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
		raw, err := callImageAPI("https://inference.do-ai.run/v1", key, t.prompt)
		if err != nil {
			log.Printf("[images] slug=%s %s: %v", slug, t.name, err)
			continue
		}
		if err := s.db.SaveArticleImage(t.name, slug, "image/png", raw); err != nil {
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
