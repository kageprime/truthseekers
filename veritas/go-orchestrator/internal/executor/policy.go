package executor

import (
	"regexp"
	"strings"
)

type PolicyAction string

const (
	PolicyAllow          PolicyAction = "allow"
	PolicyBlock          PolicyAction = "block"
	PolicyRequireApproval PolicyAction = "require_approval"
)

type Policy struct {
	Match  string       // Glob pattern: "stripe.*", "web_search"
	Action PolicyAction // allow | block | require_approval
}

type DefaultMode string

const (
	DefaultRisk     DefaultMode = "risk"
	DefaultAllowAll DefaultMode = "allow_all"
)

// ResolveInput is the full context for policy resolution.
type ResolveInput struct {
	ConnectorSlug string
	ActionPath    string
	ActionRisk    Risk
	Policies      []Policy // Project-level policies (fully qualified)
	DefaultMode   DefaultMode
}

// ResolveOutput is the effective resolution of layered policies.
type ResolveOutput struct {
	Action PolicyAction
	Reason string
}

// ResolveEffectiveAction applies layered policy resolution:
// 1. Project policies (fully-qualified "<slug>.<path>") — highest priority
// 2. If no match, use defaultMode rules
func ResolveEffectiveAction(input ResolveInput) ResolveOutput {
	fullPath := input.ConnectorSlug + "." + input.ActionPath

	// Check project policies first.
	for _, p := range input.Policies {
		if matchPolicyGlob(p.Match, fullPath) || matchPolicyGlob(p.Match, input.ActionPath) {
			return ResolveOutput{Action: p.Action, Reason: "policy: " + p.Match}
		}
	}

	// Fall back to default mode.
	switch input.DefaultMode {
	case DefaultAllowAll:
		return ResolveOutput{Action: PolicyAllow, Reason: "default: allow_all"}
	default:
		switch input.ActionRisk {
		case RiskRead:
			return ResolveOutput{Action: PolicyAllow, Reason: "default: risk=read"}
		case RiskWrite, RiskDestructive:
			return ResolveOutput{Action: PolicyRequireApproval, Reason: "default: risk=" + string(input.ActionRisk)}
		}
		return ResolveOutput{Action: PolicyAllow, Reason: "default: unknown risk"}
	}
}

// matchPolicyGlob matches a glob pattern against a string. Supports:
// - "*" at any position (matches any sequence except '.')
// - Full wildcard "**" matches everything
func matchPolicyGlob(pattern, s string) bool {
	if pattern == "*" || pattern == "**" || pattern == "*.*" {
		return true
	}
	// Simple glob: split on '.' and match segments
	patternSegs := strings.Split(pattern, ".")
	targetSegs := strings.Split(s, ".")
	if len(patternSegs) > len(targetSegs) {
		return false
	}
	for i, seg := range patternSegs {
		if seg == "*" || seg == "**" {
			return true
		}
		if seg == "" {
			continue
		}
		// Check for regex pattern /^...$/i
		if strings.HasPrefix(seg, "/") && strings.HasSuffix(seg, "/i") {
			reStr := seg[1 : len(seg)-2]
			matched, err := regexp.MatchString("(?i)"+reStr, targetSegs[i])
			if err != nil || !matched {
				return false
			}
			continue
		}
		if i >= len(targetSegs) || !strings.EqualFold(seg, targetSegs[i]) {
			return false
		}
	}
	return true
}
