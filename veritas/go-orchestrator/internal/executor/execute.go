package executor

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// FetchImpl is a dependency-injectable HTTP client. Production uses
// http.DefaultClient; tests inject a canned round tripper.
type FetchImpl interface {
	Do(req *http.Request) (*http.Response, error)
}

// ExecuteCall performs the actual HTTP call with server-side credential
// attachment. The secret is resolved server-side and never reaches the agent.
func ExecuteCall(opts struct {
	Binding  ActionBinding
	BaseURL  string
	Auth     ExecutorAuth
	Secret   string
	Args     map[string]interface{}
	Fetch    FetchImpl
}) CallResult {
	url := resolveURL(opts.BaseURL, opts.Binding, opts.Args)
	body := buildBody(opts.Binding, opts.Args)

	req, err := http.NewRequest(opts.Binding.Method, url, bytes.NewReader(body))
	if err != nil {
		return CallResult{Status: "error", Reason: fmt.Sprintf("create request: %v", err)}
	}
	req.Header.Set("Content-Type", "application/json")

	// Attach credential server-side — the caller (sandbox/agent) never sees it.
	attachAuth(req, opts.Auth, opts.Secret)

	client := &http.Client{Timeout: 30 * time.Second}
	fetch := opts.Fetch
	if fetch == nil {
		fetch = client
	}

	resp, err := fetch.Do(req)
	if err != nil {
		return CallResult{Status: "error", Reason: fmt.Sprintf("request failed: %v", err)}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return CallResult{
			Status: "error",
			Reason: fmt.Sprintf("HTTP %d: %s", resp.StatusCode, truncate(string(respBody), 2000)),
		}
	}

	// Try to parse as JSON; fall back to raw text.
	var parsed interface{}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return CallResult{Status: "ok", Data: string(respBody)}
	}
	return CallResult{Status: "ok", Data: parsed}
}

func resolveURL(baseURL string, binding ActionBinding, args map[string]interface{}) string {
	u := baseURL
	if binding.Server != "" {
		u = binding.Server
	}
	u = strings.TrimRight(u, "/")

	path := binding.Path
	// Template path params: /users/{id} -> /users/123
	for key, val := range args {
		placeholder := "{" + key + "}"
		if strings.Contains(path, placeholder) {
			path = strings.ReplaceAll(path, placeholder, fmt.Sprintf("%v", val))
			delete(args, key) // consumed
		}
	}
	return u + path
}

func buildBody(binding ActionBinding, args map[string]interface{}) []byte {
	// For GET/DELETE, no body.
	if binding.Method == "GET" || binding.Method == "DELETE" || binding.Method == "HEAD" {
		return nil
	}
	if len(args) == 0 {
		return nil
	}
	body, _ := json.Marshal(args)
	return body
}

func attachAuth(req *http.Request, auth ExecutorAuth, secret string) {
	if secret == "" {
		return
	}
	switch auth.Type {
	case AuthBearer:
		prefix := "Bearer "
		if auth.Prefix != "" {
			prefix = auth.Prefix
		}
		req.Header.Set("Authorization", prefix+secret)
	case AuthBasic:
		u := secret
		p := ""
		if auth.User != "" {
			u = auth.User
			p = secret
		}
		encoded := base64.StdEncoding.EncodeToString([]byte(u + ":" + p))
		req.Header.Set("Authorization", "Basic "+encoded)
	case AuthCustom:
		header := "Authorization"
		if auth.Header != "" {
			header = auth.Header
		}
		val := secret
		if auth.Prefix != "" {
			val = auth.Prefix + " " + secret
		}
		req.Header.Set(header, val)
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
