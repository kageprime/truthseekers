package registry

// Registry holds all auto-discovered primitives: skills, tools, agents, and
// commands scanned from the registry directory tree on boot.
type Registry struct {
	Skills   []SkillEntry   `json:"skills"`
	Tools    []ToolEntry    `json:"tools,omitempty"`
	Commands []CommandEntry `json:"commands,omitempty"`
}

// SkillEntry is a single skill discovered from a SKILL.md file.
type SkillEntry struct {
	Name        string `json:"name"`
	Dir         string `json:"dir"`
	Description string `json:"description,omitempty"`
}

// ToolEntry is a tool definition discovered from a JSON file.
type ToolEntry struct {
	Name        string `json:"name"`
	File        string `json:"file"`
	Description string `json:"description,omitempty"`
}

// CommandEntry is a shell command discovered from a registry command file.
type CommandEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
}
