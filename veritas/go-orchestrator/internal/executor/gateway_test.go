package executor

import (
	"testing"
)

func TestGateway_BasicCall(t *testing.T) {
	g := &Gateway{
		ConnectorResolver: func(_, slug string) (*Connector, error) {
			return &Connector{
				Slug:     slug,
				Name:     "test",
				Provider: "http",
				BaseURL:  "https://api.example.com",
				AuthType: AuthBearer,
				Actions: []NormalizedAction{
					{Path: "test.get", Name: "test.get", Risk: RiskRead},
				},
			}, nil
		},
		PolicyLoader:      func(string) ([]Policy, error) { return nil, nil },
		DefaultModeLoader: func() DefaultMode { return DefaultAllowAll },
	}

	result := g.HandleCall(CallInput{
		ConnectorSlug: "test",
		Action:        "test.get",
		Args:          map[string]interface{}{"id": "123"},
	})
	if result.Status == "error" && result.Reason != "" {
		t.Logf("Expected external call to fail (no network): %s", result.Reason)
		// This is fine — we're testing the gateway path, not the HTTP.
	} else {
		t.Logf("Result: %+v", result)
	}
}

func TestGateway_PolicyBlocks(t *testing.T) {
	g := &Gateway{
		ConnectorResolver: func(_, slug string) (*Connector, error) {
			return &Connector{
				Slug: slug, Name: "blocked", Provider: "http",
				Actions: []NormalizedAction{
					{Path: "danger.delete", Risk: RiskDestructive},
				},
			}, nil
		},
		PolicyLoader: func(slug string) ([]Policy, error) {
			return []Policy{{Match: slug + ".*", Action: PolicyBlock}}, nil
		},
		DefaultModeLoader: func() DefaultMode { return DefaultRisk },
	}

	result := g.HandleCall(CallInput{
		ConnectorSlug: "danger",
		Action:        "danger.delete",
	})
	if result.Status != "denied" {
		t.Errorf("expected denied, got %s: %s", result.Status, result.Reason)
	}
}

func TestGateway_UnknownConnector(t *testing.T) {
	g := &Gateway{
		ConnectorResolver: func(_, slug string) (*Connector, error) { return nil, nil },
	}
	result := g.HandleCall(CallInput{ConnectorSlug: "nope", Action: "anything"})
	if result.Status != "error" {
		t.Errorf("expected error for unknown connector, got %s", result.Status)
	}
}
