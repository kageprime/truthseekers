package executor

import (
	"encoding/json"
	"fmt"
	"os"
)

// CustomExecutor is a specialized handler for a connector+action pair that
// cannot be expressed as a simple HTTP call. When set, it replaces the
// generic ExecuteCall path.
type CustomExecutor func(input CallInput, conn *Connector) CallResult

// Gateway handles tool execution with credential isolation, policy
// enforcement, and audit. The sandbox/agent calls POST /v1/executor/call
// and the gateway resolves everything server-side.
type Gateway struct {
	// ConnectorResolver loads a connector by slug (and optionally project).
	ConnectorResolver func(projectID, slug string) (*Connector, error)
	// PolicyLoader returns policies for a connector (or project).
	PolicyLoader func(connectorSlug string) ([]Policy, error)
	// DefaultModeLoader returns the default policy mode.
	DefaultModeLoader func() DefaultMode
	// AuditSink records execution outcomes.
	AuditSink func(record ExecutionRecord) error
	// FetchImpl is the HTTP client.
	FetchImpl FetchImpl
	// CustomExecutors maps "connector.action" to specialized handlers.
	CustomExecutors map[string]CustomExecutor
}

// HandleCall is the public entry point. It resolves the connector, action,
// credential, checks policies, executes, and audits.
func (g *Gateway) HandleCall(input CallInput) CallResult {
	// 1. Resolve connector.
	conn, err := g.ConnectorResolver("", input.ConnectorSlug)
	if err != nil || conn == nil {
		return CallResult{Status: "error", Reason: fmt.Sprintf("connector %q not found", input.ConnectorSlug)}
	}

	// 2. Resolve action.
	var action *NormalizedAction
	for _, a := range conn.Actions {
		if a.Path == input.Action {
			action = &a
			break
		}
	}
	if action == nil {
		return CallResult{Status: "error", Reason: fmt.Sprintf("action %q not found on connector %q", input.Action, input.ConnectorSlug)}
	}

	// 3. Ensure credential is resolved (server-side only).
	secret := conn.AccessToken

	// 4. Policy enforcement.
	policies, _ := g.PolicyLoader(input.ConnectorSlug)
	mode := g.DefaultModeLoader()
	policy := ResolveEffectiveAction(ResolveInput{
		ConnectorSlug: input.ConnectorSlug,
		ActionPath:    action.Path,
		ActionRisk:    action.Risk,
		Policies:      policies,
		DefaultMode:   mode,
	})
	switch policy.Action {
	case PolicyBlock:
		argsJSON, _ := json.Marshal(input.Args)
		g.audit(ExecutionRecord{
			ConnectorSlug: input.ConnectorSlug, Action: action.Path,
			UserID: input.UserID, SessionID: input.SessionID,
			Status: "denied", Risk: action.Risk, RawArgs: argsJSON,
		})
		return CallResult{Status: "denied", Reason: policy.Reason}
	case PolicyRequireApproval:
		argsJSON, _ := json.Marshal(input.Args)
		g.audit(ExecutionRecord{
			ConnectorSlug: input.ConnectorSlug, Action: action.Path,
			UserID: input.UserID, SessionID: input.SessionID,
			Status: "pending_approval", Risk: action.Risk, RawArgs: argsJSON,
		})
		return CallResult{Status: "pending_approval", Reason: policy.Reason}
	}

	// 5. Check for custom executor (specialized handler that bypasses generic HTTP).
	key := input.ConnectorSlug + "." + input.Action
	if custom, ok := g.CustomExecutors[key]; ok {
		result := custom(input, conn)
		argsJSON, _ := json.Marshal(input.Args)
		status := result.Status
		if status == "ok" {
			status = "allowed"
		}
		g.audit(ExecutionRecord{
			ConnectorSlug: input.ConnectorSlug, Action: action.Path,
			UserID: input.UserID, SessionID: input.SessionID,
			Status: status, Risk: action.Risk, RawArgs: argsJSON,
		})
		result.Risk = action.Risk
		return result
	}

	// 6. Derive binding from action.
	binding := ActionBinding{
		Method: deriveMethod(action),
		Path:   derivePath(action),
		Server: conn.BaseURL,
	}

	// 7. Generic HTTP execution.
	auth := conn.AuthType
	result := ExecuteCall(struct {
		Binding  ActionBinding
		BaseURL  string
		Auth     ExecutorAuth
		Secret   string
		Args     map[string]interface{}
		Fetch    FetchImpl
	}{
		Binding: binding,
		BaseURL: conn.BaseURL,
		Auth:    ExecutorAuth{Type: auth},
		Secret:  secret,
		Args:    input.Args,
		Fetch:   g.FetchImpl,
	})

	// 7. Audit.
	argsJSON, _ := json.Marshal(input.Args)
	status := result.Status
	if status == "ok" {
		status = "allowed"
	}
	g.audit(ExecutionRecord{
		ConnectorSlug: input.ConnectorSlug, Action: action.Path,
		UserID: input.UserID, SessionID: input.SessionID,
		Status: status, Risk: action.Risk, RawArgs: argsJSON,
	})

	result.Risk = action.Risk
	return result
}

func (g *Gateway) audit(rec ExecutionRecord) {
	if g.AuditSink != nil {
		g.AuditSink(rec)
	}
}

// deriveMethod picks an HTTP method. For Truthseekers tools we default to
// POST for write operations, GET for read.
func deriveMethod(a *NormalizedAction) string {
	switch a.Risk {
	case RiskRead:
		return "GET"
	case RiskDestructive:
		return "DELETE"
	default:
		return "POST"
	}
}

func derivePath(a *NormalizedAction) string {
	return "/" + a.Path
}

// ── Default connector for built-in tools ────────────────────

// NewConnector creates a Connector from env-based credentials.
func NewConnector(slug, name, baseURL, envKey string, actions []NormalizedAction) *Connector {
	token := os.Getenv(envKey)
	return &Connector{
		Slug:        slug,
		Name:        name,
		Provider:    "http",
		BaseURL:     baseURL,
		AuthType:    AuthBearer,
		AccessToken: token,
		Actions:     actions,
	}
}
