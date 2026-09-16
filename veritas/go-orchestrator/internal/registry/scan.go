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

// maxSkillFile caps SKILL.md reads (S29) — registry content flows into agent
// context, so a hostile multi-MB file must not balloon prompts.
const maxSkillFile = 64 * 1024

// maxSkillDescription caps frontmatter descriptions kept for agent context.
const maxSkillDescription = 500

// Scan walks the registry directory and discovers all skills, tools, and
// commands. Missing directory is not an error — returns an empty registry.
func Scan(root string) (*Registry, error) {
	if root == "" {
		root = os.Getenv("REGISTRY_DIR")
	}
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
		st, err := os.Stat(skillFile)
		if err != nil || st.Size() > maxSkillFile {
			continue
		}
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
			// ponytail: truncate + strip newlines (S29) — descriptions land
			// in agent context where embedded instructions could steer it.
			entry.Description = sanitizeDescription(fm["description"])
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// sanitizeDescription truncates a skill description for agent context and
// collapses whitespace so multi-line instruction smuggling stands out less.
// Registry content is trusted-but-unreviewed; caps bound prompt bloat.
func sanitizeDescription(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > maxSkillDescription {
		s = s[:maxSkillDescription]
	}
	return s
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
