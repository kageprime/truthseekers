package registry

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseFrontmatter(t *testing.T) {
	input := `---
name: test-skill
description: A test skill
---
# Content
ignored body text`
	fm, err := parseFrontmatter(strings.NewReader(input))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fm["name"] != "test-skill" {
		t.Errorf("expected name=test-skill, got %q", fm["name"])
	}
	if fm["description"] != "A test skill" {
		t.Errorf("expected description, got %q", fm["description"])
	}
}

func TestNoFrontmatter(t *testing.T) {
	fm, err := parseFrontmatter(strings.NewReader("just content\nno frontmatter"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fm != nil {
		t.Fatal("expected nil frontmatter")
	}
}

func TestUnclosedFrontmatter(t *testing.T) {
	_, err := parseFrontmatter(strings.NewReader("---\nname: test"))
	if err == nil {
		t.Fatal("expected error for unclosed frontmatter")
	}
}

func TestScanSkillsDir(t *testing.T) {
	td := t.TempDir()
	skillDir := filepath.Join(td, "skills", "myskill")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: myskill\ndescription: my skill\n---\nbody"), 0644); err != nil {
		t.Fatal(err)
	}
	skills, err := scanSkills(filepath.Join(td, "skills"))
	if err != nil {
		t.Fatalf("scan skills: %v", err)
	}
	if len(skills) != 1 || skills[0].Name != "myskill" {
		t.Fatalf("expected 1 skill, got %+v", skills)
	}
}


