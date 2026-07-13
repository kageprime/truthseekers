package registry

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScanTools(t *testing.T) {
	td := t.TempDir()
	toolsDir := filepath.Join(td, "tools")
	if err := os.MkdirAll(toolsDir, 0755); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(toolsDir, "translate.json"), []byte(`{}`), 0644)
	os.WriteFile(filepath.Join(toolsDir, "search.ts"), []byte(`export {}`), 0644)
	os.WriteFile(filepath.Join(toolsDir, "notes.txt"), []byte(`ignore`), 0644)

	tools, err := scanTools(toolsDir)
	if err != nil {
		t.Fatalf("scan tools: %v", err)
	}
	if len(tools) != 2 {
		t.Fatalf("expected 2 tools, got %d: %+v", len(tools), tools)
	}
}

func TestScanCommands(t *testing.T) {
	td := t.TempDir()
	cmdsDir := filepath.Join(td, "commands")
	if err := os.MkdirAll(cmdsDir, 0755); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(cmdsDir, "deploy.sh"), []byte(`echo hi`), 0755)
	os.WriteFile(filepath.Join(cmdsDir, ".hidden"), []byte(`skip`), 0644)

	cmds, err := scanCommands(cmdsDir)
	if err != nil {
		t.Fatalf("scan commands: %v", err)
	}
	if len(cmds) != 1 || cmds[0].Name != "deploy.sh" {
		t.Fatalf("expected deploy.sh only, got %+v", cmds)
	}
}

func TestScanEmptyDir(t *testing.T) {
	reg, err := Scan(t.TempDir())
	if err != nil {
		t.Fatalf("Scan empty: %v", err)
	}
	if len(reg.Skills) != 0 || len(reg.Tools) != 0 || len(reg.Commands) != 0 {
		t.Fatal("expected empty registry for empty dir")
	}
}

func TestScanMissingDir(t *testing.T) {
	reg, err := Scan(t.TempDir() + "/nonexistent")
	if err != nil {
		t.Fatalf("Scan missing: %v", err)
	}
	if len(reg.Skills) != 0 {
		t.Fatal("expected empty skills for missing dir")
	}
}
