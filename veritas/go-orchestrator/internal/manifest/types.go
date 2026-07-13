package manifest

// Manifest is the top-level project configuration loaded from veritas.json.
type Manifest struct {
	Agents    []AgentSpec     `json:"agents,omitempty"`
	Connectors []ConnectorSpec `json:"connectors,omitempty"`
	Pipeline  *PipelineSpec   `json:"pipeline,omitempty"`
	Policies  []PolicySpec    `json:"policies,omitempty"`
	Triggers  []TriggerSpec   `json:"triggers,omitempty"`
	Sandbox   *SandboxSpec    `json:"sandbox,omitempty"`
}

// AgentSpec declares an agent persona with its model binding, tool set, and
// IAM grants. The first agent entry is the default.
type AgentSpec struct {
	Name         string   `json:"name"`
	Model        string   `json:"model,omitempty"`
	MaxIterations int     `json:"max_iterations,omitempty"`
	Tools        []string `json:"tools,omitempty"`
	Grants       []string `json:"grants,omitempty"`
}

// ConnectorSpec declares an external service connector. The KeyEnv field
// names the environment variable holding the credential; when the executor
// gateway is active the credential is read server-side only.
type ConnectorSpec struct {
	Type     string `json:"type"`
	Provider string `json:"provider"`
	KeyEnv   string `json:"key_env,omitempty"`
	BaseURL  string `json:"base_url,omitempty"`
}

// PipelineSpec defines the DAG node list. When nil the hardcoded default
// 9-node pipeline is used.
type PipelineSpec struct {
	Nodes []NodeSpec `json:"nodes"`
}

// NodeSpec declares a single pipeline node.
type NodeSpec struct {
	ID        string   `json:"id"`
	Script    string   `json:"script"`
	DependsOn []string `json:"depends_on"`
}

// PolicySpec overrides the default allow/block/approval for an action.
type PolicySpec struct {
	Action string `json:"action"`
	Effect string `json:"effect"` // allow | block | require_approval
	Roles  []string `json:"roles,omitempty"`
}

// TriggerSpec defines a scheduled or event-driven trigger.
type TriggerSpec struct {
	Name      string            `json:"name"`
	Schedule  string            `json:"schedule,omitempty"`
	Action    string            `json:"action"`
	Connector string            `json:"connector,omitempty"`
	Params    map[string]string `json:"params,omitempty"`
}

// SandboxSpec sets default sandbox constraints for tool execution.
type SandboxSpec struct {
	WorkDir        string `json:"work_dir,omitempty"`
	MemoryLimitMB  int    `json:"memory_limit_mb,omitempty"`
	TimeoutSeconds int    `json:"timeout_seconds,omitempty"`
}
