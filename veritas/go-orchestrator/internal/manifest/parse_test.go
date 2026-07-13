package manifest

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadFromFile(t *testing.T) {
	td := t.TempDir()
	p := filepath.Join(td, "veritas.json")
	content := `{
		"agents": [{"name": "default", "model": "gemma-4-31B-it"}],
		"policies": [{"action": "article.*", "effect": "allow"}],
		"pipeline": {
			"nodes": [
				{"id": "retrieve", "script": "retrieve.py", "depends_on": []},
				{"id": "generate", "script": "gen.py", "depends_on": ["retrieve"]}
			]
		}
	}`
	if err := os.WriteFile(p, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	m, err := Load(p)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if m == nil {
		t.Fatal("Load returned nil manifest")
	}
	if len(m.Agents) != 1 || m.Agents[0].Name != "default" {
		t.Errorf("unexpected agents: %+v", m.Agents)
	}
	if len(m.Policies) != 1 || m.Policies[0].Effect != "allow" {
		t.Errorf("unexpected policies: %+v", m.Policies)
	}
	if m.Pipeline == nil || len(m.Pipeline.Nodes) != 2 {
		t.Fatalf("expected 2 pipeline nodes, got %+v", m.Pipeline)
	}
}

func TestLoadMissingFile(t *testing.T) {
	m, err := Load(filepath.Join(t.TempDir(), "nonexistent.json"))
	if err != nil {
		t.Fatalf("expected nil error for missing file, got %v", err)
	}
	if m != nil {
		t.Fatal("expected nil manifest for missing file")
	}
}

func TestDefaultAgent(t *testing.T) {
	if d := DefaultAgent(nil); d != nil {
		t.Fatal("expected nil default agent from nil manifest")
	}
	m := &Manifest{Agents: []AgentSpec{{Name: "a"}}}
	if d := DefaultAgent(m); d == nil || d.Name != "a" {
		t.Fatal("expected agent 'a' as default")
	}
}

func TestResolveAgentGrants(t *testing.T) {
	m := &Manifest{
		Agents: []AgentSpec{
			{Name: "alpha", Grants: []string{"article.read"}},
			{Name: "beta"},
		},
	}
	if g := ResolveAgentGrants(m, "alpha"); len(g) != 1 || g[0] != "article.read" {
		t.Fatalf("unexpected grants: %v", g)
	}
	if g := ResolveAgentGrants(m, "beta"); len(g) != 0 {
		t.Fatalf("expected no grants for beta, got %v", g)
	}
	if g := ResolveAgentGrants(m, "nonexistent"); g != nil {
		t.Fatalf("expected nil for unknown agent, got %v", g)
	}
	if g := ResolveAgentGrants(nil, "x"); g != nil {
		t.Fatal("expected nil from nil manifest")
	}
}
