package executor

import "testing"

func TestResolveEffectiveAction(t *testing.T) {
	tests := []struct {
		name       string
		connector  string
		action     string
		risk       Risk
		policies   []Policy
		defaultMode DefaultMode
		wantAction PolicyAction
	}{
		{
			name: "default risk read allows",
			connector: "web_search", action: "search",
			risk: RiskRead, policies: nil,
			defaultMode: DefaultRisk,
			wantAction:  PolicyAllow,
		},
		{
			name: "default risk write requires approval",
			connector: "stripe", action: "charges.create",
			risk: RiskWrite, policies: nil,
			defaultMode: DefaultRisk,
			wantAction:  PolicyRequireApproval,
		},
		{
			name: "block policy overrides",
			connector: "stripe", action: "charges.create",
			risk: RiskWrite,
			policies: []Policy{{Match: "stripe.charges.*", Action: PolicyBlock}},
			defaultMode: DefaultRisk,
			wantAction:  PolicyBlock,
		},
		{
			name: "allow all bypasses risk",
			connector: "stripe", action: "charges.delete",
			risk: RiskDestructive, policies: nil,
			defaultMode: DefaultAllowAll,
			wantAction:  PolicyAllow,
		},
		{
			name: "allow policy overrides risk",
			connector: "dangerous", action: "delete-all",
			risk: RiskDestructive,
			policies: []Policy{{Match: "dangerous.*", Action: PolicyAllow}},
			defaultMode: DefaultRisk,
			wantAction:  PolicyAllow,
		},
	}
	for _, tc := range tests {
		out := ResolveEffectiveAction(ResolveInput{
			ConnectorSlug: tc.connector,
			ActionPath:    tc.action,
			ActionRisk:    tc.risk,
			Policies:      tc.policies,
			DefaultMode:   tc.defaultMode,
		})
		if out.Action != tc.wantAction {
			t.Errorf("%s: got %v, want %v (reason: %s)", tc.name, out.Action, tc.wantAction, out.Reason)
		}
	}
}

func TestMatchPolicyGlob(t *testing.T) {
	tests := []struct {
		pattern string
		target  string
		want    bool
	}{
		{"*", "anything", true},
		{"web_search", "web_search", true},
		{"web_search.*", "web_search.search", true},
		{"web_search.*", "web_search.other", true},
		{"stripe.charges.*", "stripe.charges.create", true},
		{"stripe.charges.*", "stripe.customers.list", false},
		{"stripe.*", "stripe.charges.create", true},
		{"stripe.*", "github.repos.list", false},
	}
	for _, tc := range tests {
		got := matchPolicyGlob(tc.pattern, tc.target)
		if got != tc.want {
			t.Errorf("matchPolicyGlob(%q, %q) = %v, want %v", tc.pattern, tc.target, got, tc.want)
		}
	}
}
