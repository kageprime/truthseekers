package llmgateway

// ModelSpec describes a model's capabilities and limits.
type ModelSpec struct {
	Name        string `json:"name"`
	Provider    string `json:"provider"`    // "do", "groq", "openai"
	DisplayName string `json:"displayName"` // Human label
	Description string `json:"description,omitempty"`

	// Capabilities
	Reasoning   bool `json:"reasoning"`
	ToolCall    bool `json:"toolCall"`
	Attachment  bool `json:"attachment"`
	Temperature bool `json:"temperature"`

	// Limits
	ContextLimit int `json:"contextLimit,omitempty"`  // Max input context tokens
	OutputLimit  int `json:"outputLimit,omitempty"`   // Max output tokens

	// Cost (per 1M tokens, USD)
	InputCostPerM  float64 `json:"inputCostPerM"`
	OutputCostPerM float64 `json:"outputCostPerM"`
}

// DefaultCatalog returns the known model set for Truthseekers.
func DefaultCatalog() []ModelSpec {
	return []ModelSpec{
		// DigitalOcean Inference
		{Name: "gemma-4-31B-it", Provider: "do", DisplayName: "Gemma 4 31B", Reasoning: true, ToolCall: true, Attachment: true, Temperature: true, ContextLimit: 128000, OutputLimit: 16384, InputCostPerM: 0.50, OutputCostPerM: 0.75},
		{Name: "deepseek-4-flash", Provider: "do", DisplayName: "DeepSeek v4 Flash", ToolCall: true, Temperature: true, ContextLimit: 128000, OutputLimit: 16384, InputCostPerM: 0.15, OutputCostPerM: 0.30},
		{Name: "deepseek-v4-pro", Provider: "do", DisplayName: "DeepSeek v4 Pro", Reasoning: true, ToolCall: true, Attachment: true, Temperature: true, ContextLimit: 128000, OutputLimit: 16384, InputCostPerM: 0.75, OutputCostPerM: 1.00},
		{Name: "stable-diffusion-3.5-large", Provider: "do", DisplayName: "Stable Diffusion 3.5", ToolCall: false, Temperature: false, InputCostPerM: 0, OutputCostPerM: 0}, // image gen

		// Groq
		{Name: "llama-4-scout-17b-16e-instruct", Provider: "groq", DisplayName: "Llama 4 Scout", ToolCall: true, Temperature: true, ContextLimit: 65536, OutputLimit: 8192, InputCostPerM: 0, OutputCostPerM: 0},

		// Epistemic workers (Python-side, but cataloged for consistency)
		{Name: "qwen/qwen3-32b", Provider: "groq", DisplayName: "Qwen 3 32B", Reasoning: true, ToolCall: true, Attachment: true, Temperature: true, ContextLimit: 128000, OutputLimit: 16384, InputCostPerM: 0, OutputCostPerM: 0},
	}
}

// FindModel looks up a model by name in the catalog.
func FindModel(name string, catalog []ModelSpec) *ModelSpec {
	for _, m := range catalog {
		if m.Name == name {
			return &m
		}
	}
	return nil
}

// EstimateCost approximates the cost of a call in USD.
func EstimateCost(model ModelSpec, inputTokens, outputTokens int) float64 {
	inCost := float64(inputTokens) / 1000000 * model.InputCostPerM
	outCost := float64(outputTokens) / 1000000 * model.OutputCostPerM
	return inCost + outCost
}

// ProviderConfig holds the base URL and API key for a provider.
type ProviderConfig struct {
	BaseURL string
	APIKey  string
}

// ResolveProvider maps a model name to its provider configuration.
func ResolveProvider(modelName string, doKey, groqKey string) ProviderConfig {
	switch modelName {
	case "gemma-4-31B-it", "deepseek-4-flash", "deepseek-v4-pro", "stable-diffusion-3.5-large":
		return ProviderConfig{BaseURL: "https://inference.do-ai.run/v1", APIKey: doKey}
	default:
		// Groq is the fallback for all other models.
		return ProviderConfig{BaseURL: "https://api.groq.com/openai/v1", APIKey: groqKey}
	}
}

// IsReasoningModel checks whether a model supports reasoning, based on the
// catalog's metadata.
func IsReasoningModel(modelName string, catalog []ModelSpec) bool {
	m := FindModel(modelName, catalog)
	return m != nil && m.Reasoning
}
