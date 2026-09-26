package agent

import "testing"

func TestNormalizeClaimVerdict(t *testing.T) {
	cases := map[string]string{
		"supported":              "supported",
		"Supported by consensus": "supported",
		"uncontested":            "supported",
		"CONTESTED":              "contested",
		"disputed":               "contested",
		"contradicted by study":  "contested",
		"weak support":           "weak",
		"partially true":         "weak",
		"not supported":          "weak",
		"unsupported by sources": "weak",
		"unverified":             "unverified",
		"unknown":                "unverified",
		"insufficient evidence":  "unverified",
		"":                       "unverified",
	}
	for in, want := range cases {
		if got := normalizeClaimVerdict(in); got != want {
			t.Errorf("normalizeClaimVerdict(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCiteKeyNormalizesVariants(t *testing.T) {
	const want = "example.org/article"
	variants := []string{
		"https://example.org/article",
		"https://www.example.org/article/",
		"http://example.org/article?utm_source=twitter",
		"example.org/article#section-2",
	}
	for _, v := range variants {
		if got := citeKey(v); got != want {
			t.Errorf("citeKey(%q) = %q, want %q", v, got, want)
		}
	}
	if got := citeKey(""); got != "" {
		t.Errorf("citeKey(\"\") = %q, want empty", got)
	}
}

// TestAdmitCitationsDropsHallucinations is the integrity guard: a model that
// invents a source URL must not be able to attach it as evidence.
func TestAdmitCitationsDropsHallucinations(t *testing.T) {
	allowed := map[string]string{
		"nature.com/paper-1":   "https://www.nature.com/paper-1",
		"archive.org/report-2": "https://archive.org/report-2",
	}
	in := []WebClaimSource{
		{Title: "Real paper", URL: "https://nature.com/paper-1?ref=x", Quote: "verbatim span"},
		{Title: "Invented", URL: "https://fabricated-blog.invalid/made-up"},
		{Title: "Real report", URL: "https://archive.org/report-2/"},
	}
	out := admitCitations(in, allowed, "supports")
	if len(out) != 2 {
		t.Fatalf("expected 2 admitted citations, got %d (%+v)", len(out), out)
	}
	if out[0].URL != "https://www.nature.com/paper-1" {
		t.Errorf("citation should be rewritten to the fetched canonical URL, got %q", out[0].URL)
	}
	if out[0].Source != "nature.com" {
		t.Errorf("expected host badge nature.com, got %q", out[0].Source)
	}
	if out[0].Stance != "supports" {
		t.Errorf("expected stance to be stamped, got %q", out[0].Stance)
	}
}

// TestAdmitCitationsUngrounded proves that with no retrieved documents the
// allow-list is empty and therefore every citation is discarded.
func TestAdmitCitationsUngrounded(t *testing.T) {
	out := admitCitations([]WebClaimSource{{URL: "https://example.org/anything"}}, map[string]string{}, "contextual")
	if len(out) != 0 {
		t.Fatalf("expected all citations dropped without retrieval, got %+v", out)
	}
}

func TestClamp01AndCleanCaveats(t *testing.T) {
	if clamp01(-0.5) != 0 || clamp01(1.7) != 1 || clamp01(0.42) != 0.42 {
		t.Errorf("clamp01 out of range behavior broken")
	}
	long := make([]string, 0, 10)
	for i := 0; i < 10; i++ {
		long = append(long, "caveat")
	}
	long = append(long, "   ")
	capped := cleanCaveats(long)
	if len(capped) != 6 {
		t.Errorf("expected caveats capped at 6, got %d", len(capped))
	}
	if got := cleanCaveats([]string{"  ", ""}); len(got) != 0 {
		t.Errorf("expected blank caveats dropped, got %+v", got)
	}
}
