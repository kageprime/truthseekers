package iam

// AgentGrant represents the permissions an agent is granted by its project
// configuration. A nil grant means "no restriction" (full user access).
// An empty grant (struct with empty slices) means "default deny" — the agent
// is governed by the project but listed without permissions.
type AgentGrant struct {
	Connectors GrantSet
	KortixCLI  GrantSet
}

// GrantSet is either a list of explicit action/tool strings or the special
// value "all" meaning everything the launching user can do.
type GrantSet interface {
	Contains(action string) bool
	IsAll() bool
}

type stringListGrant []string

func (s stringListGrant) Contains(action string) bool {
	for _, a := range s {
		if a == action || matchGlob(a, action) {
			return true
		}
	}
	return false
}
func (s stringListGrant) IsAll() bool { return false }

type allGrant struct{}

func (allGrant) Contains(string) bool { return true }
func (allGrant) IsAll() bool          { return true }

var AllGrant GrantSet = allGrant{}

func NewGrantSet(items []string) GrantSet {
	if len(items) == 0 {
		return stringListGrant{}
	}
	// Check if "all" is in the list.
	for _, item := range items {
		if item == "all" {
			return AllGrant
		}
	}
	return stringListGrant(items)
}

// AgentMayPerform checks if the agent's grant allows a specific action.
func AgentMayPerform(grant *AgentGrant, action string) bool {
	if grant == nil {
		// No restriction = full user access.
		return true
	}
	return grant.KortixCLI.Contains(action)
}

// AgentMayUseConnector checks if the agent's grant allows using a connector.
func AgentMayUseConnector(grant *AgentGrant, slug string) bool {
	if grant == nil {
		return true
	}
	return grant.Connectors.Contains(slug)
}
