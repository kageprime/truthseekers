package agent

import (
	"strings"
	"testing"
)

func TestExtractDSMLWrapped(t *testing.T) {
	// DSML-wrapped JSON with orphaned tags
	input := "Intro text\n<render_blocks> <｜DSML｜parameter name=\"blocks\" string=\"false\">[{\"type\": \"heading\", \"data\": {\"level\": 3, \"text\": \"Test\"}}, {\"type\": \"pullquote\", \"data\": {\"text\": \"Q.\"}}]</｜DSML｜parameter> </｜DSML｜tool_calls>"
	clean, blocks := extractDSMLBlocks(input)
	if len(blocks) != 2 {
		t.Errorf("expected 2 blocks, got %d", len(blocks))
	}
	for _, forbidden := range []string{"<render_blocks", "｜DSML｜", "tool_calls", "<｜", "</｜"} {
		if strings.Contains(clean, forbidden) {
			t.Errorf("cleaned text still contains %q: %s", forbidden, clean)
		}
	}
	if !strings.Contains(clean, "Intro text") {
		t.Errorf("intro text was lost: %s", clean)
	}
}

func TestExtractBareArray(t *testing.T) {
	// Bare JSON array dumped by the model with no wrapper tags, followed by a
	// markdown rendering of the same content. We must strip the JSON, keep
	// the markdown, and extract the blocks.
	input := `[{"type": "heading", "data": {"level": 3, "text": "Verified vs Unverified"}}, {"type": "table", "data": {"headers": ["Claim", "Status"], "rows": [["Lin was a Navy LCDR", "Confirmed"]]}}]

Verified vs Unverified
Claim	Status
Lin was a Navy LCDR	Confirmed`
	clean, blocks := extractDSMLBlocks(input)
	if len(blocks) != 2 {
		t.Fatalf("expected 2 blocks, got %d (clean=%q)", len(blocks), clean)
	}
	if blocks[0].Type != "heading" {
		t.Errorf("first block type = %s, want heading", blocks[0].Type)
	}
	if blocks[1].Type != "table" {
		t.Errorf("second block type = %s, want table", blocks[1].Type)
	}
	if strings.Contains(clean, "[{") {
		t.Errorf("bare JSON array not stripped: %s", clean)
	}
	if !strings.Contains(clean, "Verified vs Unverified") {
		t.Errorf("markdown content was lost: %s", clean)
	}
}

func TestDoesNotStripUnrelatedJSON(t *testing.T) {
	// An unrelated JSON array should NOT be stripped.
	input := `Here is some data: ["alpha", "beta", "gamma"]`
	clean, blocks := extractDSMLBlocks(input)
	if len(blocks) != 0 {
		t.Errorf("should not extract blocks from unrelated JSON, got %d", len(blocks))
	}
	if !strings.Contains(clean, `["alpha", "beta", "gamma"]`) {
		t.Errorf("unrelated JSON was wrongly stripped: %s", clean)
	}
}
