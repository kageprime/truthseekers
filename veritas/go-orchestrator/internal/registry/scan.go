package registry

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DefaultRegistryDir is the default registry directory name searched relative
// to the working directory. Override by setting the REGISTRY_DIR env var.
const DefaultRegistryDir = "veritas/registry"

// Scan walks the registry directory and discovers all skills, tools, and
// commands. Missing directory is not an error — returns an empty registry.
func Scan(root string) (*Registry, error) {
	if root == "" {
		root = DefaultRegistryDir
	}
	reg := &Registry{}

	skillsDir := filepath.Join(root, "skills")
	if entries, err := scanSkills(skillsDir); err == nil {
		reg.Skills = entries
	}

	toolsDir := filepath.Join(root, "tools")
	if entries, err := scanTools(toolsDir); err == nil {
		reg.Tools = entries
	}

	cmdsDir := filepath.Join(root, "commands")
	if entries, err := scanCommands(cmdsDir); err == nil {
		reg.Commands = entries
	}

	return reg, nil
}

// scanSkills discovers SKILL.md files under dir, one directory per skill.
func scanSkills(dir string) ([]SkillEntry, error) {
	infos, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("scan skills: %w", err)
	}
	var entries []SkillEntry
	for _, info := range infos {
		if !info.IsDir() {
			continue
		}
		skillDir := filepath.Join(dir, info.Name())
		skillFile := filepath.Join(skillDir, "SKILL.md")
		f, err := os.Open(skillFile)
		if err != nil {
			continue
		}
		fm, err := parseFrontmatter(f)
		f.Close()
		if err != nil {
			continue
		}
		entry := SkillEntry{Name: info.Name(), Dir: skillDir}
		if fm != nil {
			if n, ok := fm["name"]; ok {
				entry.Name = n
			}
			entry.Description = fm["description"]
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// scanTools discovers .json and .ts tool definition files under dir.
func scanTools(dir string) ([]ToolEntry, error) {
	infos, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("scan tools: %w", err)
	}
	var entries []ToolEntry
	for _, info := range infos {
		if info.IsDir() {
			continue
		}
		ext := filepath.Ext(info.Name())
		if ext != ".json" && ext != ".ts" {
			continue
		}
		entries = append(entries, ToolEntry{
			Name: strings.TrimSuffix(info.Name(), ext),
			File: filepath.Join(dir, info.Name()),
		})
	}
	return entries, nil
}

// scanCommands discovers executable files under dir.
func scanCommands(dir string) ([]CommandEntry, error) {
	infos, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("scan commands: %w", err)
	}
	var entries []CommandEntry
	for _, info := range infos {
		if info.IsDir() || info.Name()[0] == '.' {
			continue
		}
		entries = append(entries, CommandEntry{
			Name: info.Name(),
			Path: filepath.Join(dir, info.Name()),
		})
	}
	return entries, nil
}


