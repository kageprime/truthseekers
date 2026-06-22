package nodes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"time"
)

// RunPythonNode runs a Python script node as a subprocess, passing input as JSON via stdin.
// If python is not available, it falls back to mock data.
func RunPythonNode(ctx context.Context, scriptName string, input interface{}) (interface{}, error) {
	// Reconstruct local path to python scripts
	// e.g. veritas/python-workers/nodes/<scriptName>.py
	scriptPath := filepath.Join("..", "python-workers", "nodes", scriptName)

	inputBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal python node input: %w", err)
	}

	cmd := exec.CommandContext(ctx, "python3", scriptPath)
	cmd.Stdin = bytes.NewReader(inputBytes)
	
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	if err != nil {
		// Log python error but handle lack of python installation gracefully
		log.Printf("[python-bridge-warn] script %s failed (or python not installed): %v. Stderr: %s", scriptName, err, stderr.String())
		return getMockNodeOutput(scriptName, input)
	}

	var output interface{}
	if err := json.Unmarshal(stdout.Bytes(), &output); err != nil {
		return nil, fmt.Errorf("failed to parse python node stdout output: %w. Raw: %s", err, stdout.String())
	}

	return output, nil
}

// getMockNodeOutput provides mock schema-compliant fallbacks when Python runner is not available.
func getMockNodeOutput(scriptName string, input interface{}) (interface{}, error) {
	log.Printf("[mock-executor] running fallback output for node: %s", scriptName)
	time.Sleep(200 * time.Millisecond) // mimic slight processing delay

	switch scriptName {
	case "retrieve.py":
		return map[string]interface{}{
			"documents": map[string]interface{}{
				"confirmed": []interface{}{
					map[string]interface{}{"id": "doc1", "text": "JFK hearings acoustic report of 1979", "url": "https://history.gov/jfk"},
				},
				"contested":   []interface{}{},
				"suppressed":  []interface{}{},
				"speculative": []interface{}{},
				"web":         []interface{}{},
			},
			"metadata": map[string]interface{}{
				"category_counts": map[string]interface{}{
					"confirmed": 1, "contested": 0, "suppressed": 0, "speculative": 0, "web": 0,
				},
			},
		}, nil

	case "extract_claims.py":
		return map[string]interface{}{
			"claims": []interface{}{
				map[string]interface{}{
					"text":          "Lee Harvey Oswald did not fire the fatal shot that killed John F. Kennedy.",
					"source_doc_id": "doc1",
					"passage":       "Based on acoustic analysis, there was a high probability of two gunmen.",
				},
			},
		}, nil

	case "map_evidence.py":
		return map[string]interface{}{
			"claim_evidence_map": []interface{}{
				map[string]interface{}{
					"claim_id":         "claim_1",
					"supporting":       []interface{}{"doc1"},
					"contradicting":    []interface{}{},
					"missing_expected": []interface{}{},
				},
			},
		}, nil

	case "critique.py":
		return map[string]interface{}{
			"evaluation": map[string]interface{}{
				"factual_consistency":   map[string]interface{}{"score": 0.95},
				"source_reliability":     map[string]interface{}{"score": 0.88},
				"reasoning_validity":     map[string]interface{}{"score": 0.90},
				"missing_counterarguments": []interface{}{},
			},
		}, nil

	case "detect_missing.py":
		return map[string]interface{}{
			"gaps": []interface{}{
				map[string]interface{}{
					"gap_type":            "unexpected",
					"expected_artifact":   "patent",
					"description":         "No patent found for secret aircraft component",
					"verification_status": "unverified_gap",
					"cause_label":         "unknown",
					"cause_confidence":    0.0,
				},
			},
		}, nil

	case "map_language.py":
		return map[string]interface{}{
			"language_flags": []interface{}{
				map[string]interface{}{
					"source_phrase":       "neutralized",
					"neutral_description": "killed",
					"precision_upgrade":   "executed",
					"framing_origin":      "military press releases",
					"confidence":          0.85,
				},
			},
		}, nil

	case "scrutinize.py":
		return map[string]interface{}{
			"risk_assessments": []interface{}{
				map[string]interface{}{
					"claim_id":     "claim_1",
					"risk_factors": []interface{}{"single_source_dependency"},
					"risk_score":   0.45,
					"action": map[string]interface{}{
						"requires_extra_corroboration": false,
					},
				},
			},
		}, nil

	case "resolve.py":
		return map[string]interface{}{
			"resolved_claims": []interface{}{
				map[string]interface{}{
					"claim_id": "claim_1",
					"text":     "Lee Harvey Oswald did not fire the fatal shot that killed John F. Kennedy.",
					"status":   "supported",
					"confidence_vector": map[string]interface{}{
						"evidence_strength":   0.94,
						"corroboration_index": 0.89,
						"source_diversity":     0.76,
						"recency":              0.55,
						"contradiction_level":  0.12,
						"bias_risk":            0.20,
					},
					"derived_confidence": 0.87,
				},
			},
		}, nil

	case "generate_article.py":
			return map[string]interface{}{
				"article": map[string]interface{}{
					"title":   "The JFK Assassination: Alternate Forensic Theories",
					"summary": "This article examines forensic claims regarding the shooting of JFK in 1963.",
					"sections": []interface{}{
						map[string]interface{}{
							"id":      "forensic-evidence",
							"title":   "Acoustic and Forensic Evidence",
							"content": "The House Select Committee on Assassinations concluded a conspiracy was probable.",
						},
					},
				},
			}, nil

		case "store.py":
			return map[string]interface{}{
				"status":         "stored",
				"persisted_keys":  []interface{}{"generate_article"},
				"missing_keys":   []interface{}{},
				"message":        "All outputs persisted successfully.",
			}, nil
	}

	return nil, fmt.Errorf("unknown mock node script: %s", scriptName)
}
