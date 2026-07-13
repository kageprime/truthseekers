package manifest

// ResolveAgentGrants looks up the agent by name in the manifest and returns
// its IAM grant list. Returns nil when the agent or manifest has no grants.
func ResolveAgentGrants(m *Manifest, name string) []string {
	if m == nil {
		return nil
	}
	for _, a := range m.Agents {
		if a.Name == name {
			return a.Grants
		}
	}
	return nil
}

// DefaultAgent returns the first agent spec from the manifest, or nil.
func DefaultAgent(m *Manifest) *AgentSpec {
	if m == nil || len(m.Agents) == 0 {
		return nil
	}
	return &m.Agents[0]
}
