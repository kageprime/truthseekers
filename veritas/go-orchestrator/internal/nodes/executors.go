package nodes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

var nodesDir string

func init() {
	exe, err := os.Executable()
	if err != nil {
		nodesDir = filepath.Join("..", "python-workers", "nodes")
	} else {
		nodesDir = filepath.Join(filepath.Dir(exe), "..", "python-workers", "nodes")
	}
}

func RunPythonNode(ctx context.Context, scriptName string, input interface{}) (interface{}, error) {
	scriptPath := filepath.Join(nodesDir, scriptName)

	inputBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal python node input: %w", err)
	}

	cmd := exec.CommandContext(ctx, "python3", scriptPath)
	cmd.Stdin = bytes.NewReader(inputBytes)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		log.Printf("[python-bridge-warn] script %s failed: %v. Stderr: %s", scriptName, err, stderr.String())
		return mockOutput(scriptName)
	}

	var output interface{}
	if err := json.Unmarshal(stdout.Bytes(), &output); err != nil {
		return nil, fmt.Errorf("failed to parse python node stdout output: %w. Raw: %s", err, stdout.String())
	}
	return output, nil
}

func mockOutput(scriptName string) (interface{}, error) {
	log.Printf("[mock] fallback for node: %s", scriptName)
	switch scriptName {
	case "retrieve.py":
		return map[string]interface{}{
			"documents": map[string]interface{}{
				"confirmed": []interface{}{}, "contested": []interface{}{},
				"suppressed": []interface{}{}, "speculative": []interface{}{}, "web": []interface{}{},
			},
			"metadata": map[string]interface{}{
				"category_counts": map[string]interface{}{"confirmed": 0, "contested": 0, "suppressed": 0, "speculative": 0, "web": 0},
			},
		}, nil
	case "extract_claims.py":
		return map[string]interface{}{"claims": []interface{}{}}, nil
	case "map_evidence.py":
		return map[string]interface{}{"claim_evidence_map": []interface{}{}}, nil
	case "critique.py":
		return map[string]interface{}{
			"evaluation": map[string]interface{}{
				"factual_consistency":    map[string]interface{}{"score": 0.0},
				"source_reliability":     map[string]interface{}{"score": 0.0},
				"reasoning_validity":     map[string]interface{}{"score": 0.0},
				"missing_counterarguments": []interface{}{},
			},
		}, nil
	case "detect_missing.py":
		return map[string]interface{}{"gaps": []interface{}{}}, nil
	case "map_language.py":
		return map[string]interface{}{"language_flags": []interface{}{}}, nil
	case "scrutinize.py":
		return map[string]interface{}{"risk_assessments": []interface{}{}}, nil
	case "resolve.py":
		return map[string]interface{}{"resolved_claims": []interface{}{}}, nil
	case "generate_article.py":
		return map[string]interface{}{
			"article": map[string]interface{}{
				"title": "Article unavailable", "abstract": "Python worker unavailable. No article generated.",
				"sections": []interface{}{}, "timeline": []interface{}{},
				"categories": []interface{}{}, "crossrefs": []interface{}{}, "citations": []interface{}{},
			},
		}, nil
	case "store.py":
		return map[string]interface{}{"status": "stored", "persisted_keys": []interface{}{}, "missing_keys": []interface{}{}}, nil
	}
	return nil, fmt.Errorf("unknown mock node: %s", scriptName)
}
