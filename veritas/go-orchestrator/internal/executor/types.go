package executor

import "encoding/json"

// ── Risk levels ─────────────────────────────────────────────

type Risk string

const (
	RiskRead        Risk = "read"
	RiskWrite       Risk = "write"
	RiskDestructive Risk = "destructive"
)

// ── Actions ─────────────────────────────────────────────────

// NormalizedAction is a provider-agnostic description of an executable action.
type NormalizedAction struct {
	Path        string                 // Connector-relative, e.g. "charges.create"
	Name        string                 // Human label
	Description string                 // What it does
	InputSchema map[string]interface{} // JSON Schema for arguments
	Risk        Risk
}

// ── Binding ─────────────────────────────────────────────────

// ActionBinding describes how to actually call an action on the wire.
type ActionBinding struct {
	Method string // HTTP method: GET, POST, DELETE, etc.
	Path   string // URL path template: "/charges" or "/users/{id}"
	Server string // Base URL override (empty = connector baseUrl)
}

// ── Auth ────────────────────────────────────────────────────

type AuthType string

const (
	AuthBearer AuthType = "bearer"
	AuthBasic  AuthType = "basic"
	AuthCustom AuthType = "custom"
)

type ExecutorAuth struct {
	Type   AuthType
	Header string // Default: "Authorization" for bearer, "Authorization" for basic
	Prefix string // Default: "Bearer " for bearer
	User   string // For basic auth
}

// ── Call input/output ───────────────────────────────────────

type CallInput struct {
	ConnectorSlug string                 `json:"connector"`
	Action        string                 `json:"action"`
	Args          map[string]interface{} `json:"args,omitempty"`
	UserID        string                 `json:"-"`
	SessionID     string                 `json:"-"`
}

type CallResult struct {
	Status string      `json:"status"` // "ok", "denied", "pending_approval", "error"
	Data   interface{} `json:"data,omitempty"`
	Risk   Risk        `json:"risk,omitempty"`
	Reason string      `json:"reason,omitempty"`
}

// ── Connector ───────────────────────────────────────────────

type Connector struct {
	Slug        string  // Unique id
	Name        string  // Human label
	Provider    string  // "http", "openapi", "mcp", "pipedream"
	BaseURL     string  // Base URL for API calls
	AuthType    AuthType
	AccessToken string  // Resolved server-side credential
	Actions     []NormalizedAction
}

// ── Audit ───────────────────────────────────────────────────

type ExecutionRecord struct {
	ConnectorSlug string      `json:"connectorSlug"`
	Action        string      `json:"action"`
	Args          interface{} `json:"args"`
	UserID        string      `json:"userId"`
	SessionID     string      `json:"sessionId"`
	Status        string      `json:"status"` // "allowed", "denied", "error"
	Risk          Risk        `json:"risk"`
	Error         string      `json:"error,omitempty"`
	RawArgs       json.RawMessage `json:"-"`
}
