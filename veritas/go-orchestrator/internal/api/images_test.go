package api

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCallImageAPI(t *testing.T) {
	png := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a} // minimal PNG header
	b64 := base64.StdEncoding.EncodeToString(png)

	// Branch 1: inline b64 (DO shape).
	meta := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"b64_json":"` + b64 + `"}]}`))
	}))
	defer meta.Close()
	raw, err := callImageAPI(meta.URL, "muse-image-1.0", "k", "a cat")
	if err != nil || string(raw) != string(png) {
		t.Fatalf("b64 branch: raw=%x err=%v", raw, err)
	}

	// Branch 2: signed URL (Muse shape) — downloaded server-side.
	file := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		w.Write(png)
	}))
	defer file.Close()
	gen := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"url":"` + file.URL + `/i.png"}]}`))
	}))
	defer gen.Close()
	raw, err = callImageAPI(gen.URL, "muse-image-1.0", "k", "a cat")
	if err != nil || string(raw) != string(png) {
		t.Fatalf("url branch: raw=%x err=%v", raw, err)
	}
}

func TestImageProviderPrefersMuse(t *testing.T) {
	t.Setenv("MODEL_API_KEY", "meta-key")
	t.Setenv("MODEL_ACCESS_KEY", "do-key")
	s := &Server{}
	base, model, key, ok := s.imageProvider()
	if !ok || key != "meta-key" || model != "muse-image-1.0" || base != "https://api.meta.ai/v1" {
		t.Fatalf("want muse provider, got %s %s ok=%v", base, model, ok)
	}
}

func TestImageProviderDOFallback(t *testing.T) {
	t.Setenv("MODEL_ACCESS_KEY", "do-key")
	s := &Server{}
	_, model, key, ok := s.imageProvider()
	if !ok || key != "do-key" || model != "stable-diffusion-3.5-large" {
		t.Fatalf("want do fallback, got %s ok=%v", model, ok)
	}
}
