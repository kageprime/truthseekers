package executor

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExecuteCall_Success(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"result": "ok"})
	}))
	defer ts.Close()

	result := ExecuteCall(struct {
		Binding  ActionBinding
		BaseURL  string
		Auth     ExecutorAuth
		Secret   string
		Args     map[string]interface{}
		Fetch    FetchImpl
	}{
		Binding: ActionBinding{Method: "GET", Path: "/test"},
		BaseURL: ts.URL,
		Auth:    ExecutorAuth{Type: AuthBearer},
		Secret:  "test-token",
	})
	if result.Status != "ok" {
		t.Errorf("expected ok, got %s: %s", result.Status, result.Reason)
	}
	data, ok := result.Data.(map[string]interface{})
	if !ok || data["result"] != "ok" {
		t.Errorf("unexpected data: %+v", result.Data)
	}
}

func TestExecuteCall_AuthInjection(t *testing.T) {
	var authHeader string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	ExecuteCall(struct {
		Binding  ActionBinding
		BaseURL  string
		Auth     ExecutorAuth
		Secret   string
		Args     map[string]interface{}
		Fetch    FetchImpl
	}{
		Binding: ActionBinding{Method: "POST", Path: "/test"},
		BaseURL: ts.URL,
		Auth:    ExecutorAuth{Type: AuthBearer},
		Secret:  "sk-secret-123",
	})

	if authHeader != "Bearer sk-secret-123" {
		t.Errorf("expected Bearer auth, got %q", authHeader)
	}
}

func TestExecuteCall_HTTPError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"bad request"}`))
	}))
	defer ts.Close()

	result := ExecuteCall(struct {
		Binding  ActionBinding
		BaseURL  string
		Auth     ExecutorAuth
		Secret   string
		Args     map[string]interface{}
		Fetch    FetchImpl
	}{
		Binding: ActionBinding{Method: "GET", Path: "/fail"},
		BaseURL: ts.URL,
	})

	if result.Status != "error" || result.Reason == "" {
		t.Errorf("expected error, got %s", result.Status)
	}
}
