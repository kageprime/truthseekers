package dag

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type RetryPolicy struct {
	MaxAttempts int
	BackoffBase time.Duration
	BackoffMax  time.Duration
}

type Node struct {
	ID        string
	Type      string // retrieve | extract_claims | map_evidence | critique | detect_missing | map_language | scrutinize | resolve | generate_article | store
	DependsOn []string
	Execute   func(ctx context.Context, input map[string]interface{}) (interface{}, error)
	Retry     RetryPolicy
	Timeout   time.Duration
}

type Workflow struct {
	Nodes []Node
}

type ProgressUpdate struct {
	NodeID    string
	Status    string // running | completed | failed
	Output    interface{}
	Error     string
	Timestamp time.Time
}

func (w *Workflow) Execute(ctx context.Context, query string) (<-chan ProgressUpdate, error) {
	progressCh := make(chan ProgressUpdate, 16)

	// Validate workflow (no cycles, valid dependencies)
	if err := w.Validate(); err != nil {
		close(progressCh)
		return nil, err
	}

	go func() {
		defer close(progressCh)

		var mu sync.RWMutex
		completed := make(map[string]interface{})
		inProgress := make(map[string]bool)
		failed := make(map[string]bool)
		var executionErr error

		// Seed initial query as input for root nodes
		completed["__query__"] = query

		totalNodes := len(w.Nodes)
		doneCh := make(chan struct{}, totalNodes)

		for {
			mu.RLock()
			completedCount := len(completed) - 1 // subtract __query__
			hasFailed := len(failed) > 0
			mu.RUnlock()

			if completedCount == totalNodes || hasFailed || ctx.Err() != nil {
				if ctx.Err() != nil {
					executionErr = ctx.Err()
				}
				break
			}

			for _, node := range w.Nodes {
				mu.RLock()
				_, isCompleted := completed[node.ID]
				isExecuting := inProgress[node.ID]
				isFailed := failed[node.ID]
				mu.RUnlock()

				if isCompleted || isExecuting || isFailed {
					continue
				}

				// Check dependencies
				mu.RLock()
				depMet := true
				for _, dep := range node.DependsOn {
					if _, ok := completed[dep]; !ok {
						depMet = false
						break
					}
				}
				mu.RUnlock()

				if !depMet {
					continue
				}

				// Start executing node
				mu.Lock()
				inProgress[node.ID] = true
				mu.Unlock()

				go func(n Node) {
					progressCh <- ProgressUpdate{
						NodeID:    n.ID,
						Status:    "running",
						Timestamp: time.Now(),
					}

					mu.RLock()
					// Gather inputs. If it has no dependencies, pass the query.
					input := make(map[string]interface{})
					if len(n.DependsOn) == 0 {
						input["query"] = completed["__query__"]
					} else {
						for _, dep := range n.DependsOn {
							input[dep] = completed[dep]
						}
					}
					mu.RUnlock()

					// Execute with timeout if specified
					var output interface{}
					var err error
					runNode := func() (interface{}, error) {
						if n.Timeout > 0 {
							nCtx, cancel := context.WithTimeout(ctx, n.Timeout)
							defer cancel()
							return n.Execute(nCtx, input)
						}
						return n.Execute(ctx, input)
					}

					output, err = runNode()

					if err != nil && n.Retry.MaxAttempts > 0 {
						for attempt := 1; attempt <= n.Retry.MaxAttempts; attempt++ {
							backoff := time.Duration(attempt) * n.Retry.BackoffBase
							if backoff > n.Retry.BackoffMax {
								backoff = n.Retry.BackoffMax
							}

							select {
							case <-ctx.Done():
								err = ctx.Err()
								break
							case <-time.After(backoff):
							}

							if ctx.Err() != nil {
								err = ctx.Err()
								break
							}

							output, err = runNode()
							if err == nil {
								break
							}
						}
					}

					mu.Lock()
					inProgress[n.ID] = false
					if err != nil {
						failed[n.ID] = true
						mu.Unlock()
						progressCh <- ProgressUpdate{
							NodeID:    n.ID,
							Status:    "failed",
							Error:     err.Error(),
							Timestamp: time.Now(),
						}
					} else {
						completed[n.ID] = output
						mu.Unlock()
						progressCh <- ProgressUpdate{
							NodeID:    n.ID,
							Status:    "completed",
							Output:    output,
							Timestamp: time.Now(),
						}
					}
					doneCh <- struct{}{}
				}(node)
			}

			select {
			case <-doneCh:
			case <-ctx.Done():
			}
		}

		if executionErr != nil {
			progressCh <- ProgressUpdate{
				NodeID:    "workflow",
				Status:    "failed",
				Error:     executionErr.Error(),
				Timestamp: time.Now(),
			}
		}
	}()

	return progressCh, nil
}

// Validate checks for circular dependencies and missing dependsOn references.
func (w *Workflow) Validate() error {
	nodeMap := make(map[string]Node)
	for _, n := range w.Nodes {
		nodeMap[n.ID] = n
	}

	// Validate dependencies exist
	for _, n := range w.Nodes {
		for _, dep := range n.DependsOn {
			if _, ok := nodeMap[dep]; !ok {
				return fmt.Errorf("node %q depends on non-existent node %q", n.ID, dep)
			}
		}
	}

	// Cycle detection using DFS recursion stack tracking
	visited := make(map[string]bool)
	recStack := make(map[string]bool)

	var hasCycle func(string) bool
	hasCycle = func(id string) bool {
		visited[id] = true
		recStack[id] = true

		for _, dep := range nodeMap[id].DependsOn {
			if !visited[dep] {
				if hasCycle(dep) {
					return true
				}
			} else if recStack[dep] {
				return true
			}
		}

		recStack[id] = false
		return false
	}

	for _, n := range w.Nodes {
		if !visited[n.ID] {
			if hasCycle(n.ID) {
				return fmt.Errorf("circular dependency detected in workflow")
			}
		}
	}

	return nil
}
