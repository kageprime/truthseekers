package llmgateway

import "testing"

func TestDefaultCatalog(t *testing.T) {
	catalog := DefaultCatalog()
	if len(catalog) == 0 {
		t.Fatal("default catalog should not be empty")
	}
	// Check known models exist.
	models := map[string]bool{}
	for _, m := range catalog {
		models[m.Name] = true
	}
	for _, name := range []string{"gemma-4-31B-it", "deepseek-4-flash", "llama-4-scout-17b-16e-instruct", "muse-spark-1.3-contributor"} {
		if !models[name] {
			t.Errorf("expected model %q in catalog", name)
		}
	}
}

func TestFindModel(t *testing.T) {
	catalog := DefaultCatalog()
	m := FindModel("gemma-4-31B-it", catalog)
	if m == nil {
		t.Fatal("expected to find gemma-4-31B-it")
	}
	if !m.Reasoning {
		t.Errorf("expected gemma-4-31B-it to support reasoning")
	}

	m = FindModel("nonexistent", catalog)
	if m != nil {
		t.Errorf("expected nil for nonexistent model, got %+v", m)
	}
}

func TestEstimateCost(t *testing.T) {
	m := ModelSpec{InputCostPerM: 1.0, OutputCostPerM: 2.0}
	cost := EstimateCost(m, 1000, 500)
	expected := (1000.0/1000000)*1.0 + (500.0/1000000)*2.0
	if cost != expected {
		t.Errorf("cost = %f, want %f", cost, expected)
	}
}

func TestResolveProvider(t *testing.T) {
	p := ResolveProvider("gemma-4-31B-it", "do-key", "groq-key", "meta-key")
	if p.APIKey != "do-key" {
		t.Errorf("expected do-key, got %s", p.APIKey)
	}
	p = ResolveProvider("llama-4-scout-17b-16e-instruct", "do-key", "groq-key", "meta-key")
	if p.APIKey != "groq-key" {
		t.Errorf("expected groq-key, got %s", p.APIKey)
	}
	p = ResolveProvider("muse-spark-1.3-contributor", "do-key", "groq-key", "meta-key")
	if p.APIKey != "meta-key" {
		t.Errorf("expected meta-key, got %s", p.APIKey)
	}
	if p.BaseURL != "https://api.meta.ai/v1" {
		t.Errorf("expected meta base URL, got %s", p.BaseURL)
	}
}
