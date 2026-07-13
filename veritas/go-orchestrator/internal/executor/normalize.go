package executor

import "strings"

// DeriveRisk determines the risk level from an HTTP method.
func DeriveRisk(method string) Risk {
	switch strings.ToUpper(method) {
	case "GET", "HEAD", "OPTIONS":
		return RiskRead
	case "DELETE":
		return RiskDestructive
	default:
		return RiskWrite
	}
}

// NormalizeHTTPRoute converts a manually-defined HTTP route spec into a
// NormalizedAction.
func NormalizeHTTPRoute(method, path, name, description string, inputSchema map[string]interface{}) NormalizedAction {
	return NormalizedAction{
		Path:        name,
		Name:        name,
		Description: description,
		InputSchema: inputSchema,
		Risk:        DeriveRisk(method),
	}
}
