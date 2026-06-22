package dag

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestWorkflow_Validate_Success(t *testing.T) {
	w := &Workflow{
		Nodes: []Node{
			{ID: "node1", Type: "test", DependsOn: []string{}},
			{ID: "node2", Type: "test", DependsOn: []string{"node1"}},
			{ID: "node3", Type: "test", DependsOn: []string{"node1"}},
			{ID: "node4", Type: "test", DependsOn: []string{"node2", "node3"}},
		},
	}

	err := w.Validate()
	if err != nil {
		t.Fatalf("expected validation to pass, got error: %v", err)
	}
}

func TestWorkflow_Validate_CircularDependency(t *testing.T) {
	w := &Workflow{
		Nodes: []Node{
			{ID: "node1", Type: "test", DependsOn: []string{"node3"}},
			{ID: "node2", Type: "test", DependsOn: []string{"node1"}},
			{ID: "node3", Type: "test", DependsOn: []string{"node2"}},
		},
	}

	err := w.Validate()
	if err == nil {
		t.Fatal("expected circular dependency validation error, got nil")
	}
}

func TestWorkflow_Validate_MissingDependency(t *testing.T) {
	w := &Workflow{
		Nodes: []Node{
			{ID: "node1", Type: "test", DependsOn: []string{"non_existent"}},
		},
	}

	err := w.Validate()
	if err == nil {
		t.Fatal("expected missing dependency validation error, got nil")
	}
}

func TestWorkflow_Execute_Success(t *testing.T) {
	var mu sync.Mutex
	executionOrder := make([]string, 0)

	node1Exec := func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
		mu.Lock()
		executionOrder = append(executionOrder, "node1")
		mu.Unlock()
		return "data1", nil
	}

	node2Exec := func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
		time.Sleep(10 * time.Millisecond) // ensure slight delay to verify concurrency
		mu.Lock()
		executionOrder = append(executionOrder, "node2")
		mu.Unlock()
		return "data2", nil
	}

	node3Exec := func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
		mu.Lock()
		executionOrder = append(executionOrder, "node3")
		mu.Unlock()
		return "data3", nil
	}

	node4Exec := func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
		mu.Lock()
		executionOrder = append(executionOrder, "node4")
		mu.Unlock()
		return "data4", nil
	}

	w := &Workflow{
		Nodes: []Node{
			{ID: "node1", Type: "test", DependsOn: []string{}, Execute: node1Exec},
			{ID: "node2", Type: "test", DependsOn: []string{"node1"}, Execute: node2Exec},
			{ID: "node3", Type: "test", DependsOn: []string{"node1"}, Execute: node3Exec},
			{ID: "node4", Type: "test", DependsOn: []string{"node2", "node3"}, Execute: node4Exec},
		},
	}

	ctx := context.Background()
	updates, err := w.Execute(ctx, "test query")
	if err != nil {
		t.Fatalf("expected Execute to start, got error: %v", err)
	}

	completedNodes := make(map[string]bool)
	for update := range updates {
		if update.Status == "completed" {
			completedNodes[update.NodeID] = true
		}
		if update.Status == "failed" {
			t.Fatalf("node %s failed with: %s", update.NodeID, update.Error)
		}
	}

	if len(completedNodes) != 4 {
		t.Fatalf("expected 4 completed nodes, got %d", len(completedNodes))
	}

	mu.Lock()
	defer mu.Unlock()

	// Verify order constraints
	node1Idx, node2Idx, node3Idx, node4Idx := -1, -1, -1, -1
	for idx, val := range executionOrder {
		switch val {
		case "node1":
			node1Idx = idx
		case "node2":
			node2Idx = idx
		case "node3":
			node3Idx = idx
		case "node4":
			node4Idx = idx
		}
	}

	if node1Idx == -1 || node2Idx == -1 || node3Idx == -1 || node4Idx == -1 {
		t.Fatalf("some nodes did not run: %v", executionOrder)
	}

	if node1Idx > node2Idx || node1Idx > node3Idx {
		t.Errorf("node1 did not run before node2/node3: %v", executionOrder)
	}

	if node2Idx > node4Idx || node3Idx > node4Idx {
		t.Errorf("node2/node3 did not run before node4: %v", executionOrder)
	}
}

func TestWorkflow_Execute_Retry(t *testing.T) {
	attempts := 0
	failingExec := func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
		attempts++
		if attempts < 3 {
			return nil, errors.New("temporary error")
		}
		return "success after retries", nil
	}

	w := &Workflow{
		Nodes: []Node{
			{
				ID:        "failing_node",
				Type:      "test",
				DependsOn: []string{},
				Execute:   failingExec,
				Retry: RetryPolicy{
					MaxAttempts: 3,
					BackoffBase: 1 * time.Millisecond,
					BackoffMax:  5 * time.Millisecond,
				},
			},
		},
	}

	ctx := context.Background()
	updates, err := w.Execute(ctx, "test query")
	if err != nil {
		t.Fatalf("expected Execute to start, got error: %v", err)
	}

	success := false
	for update := range updates {
		if update.NodeID == "failing_node" && update.Status == "completed" {
			success = true
			if update.Output.(string) != "success after retries" {
				t.Errorf("expected payload, got: %v", update.Output)
			}
		}
	}

	if !success {
		t.Fatal("node did not successfully complete after retries")
	}

	if attempts != 3 {
		t.Errorf("expected exactly 3 attempts, got %d", attempts)
	}
}
