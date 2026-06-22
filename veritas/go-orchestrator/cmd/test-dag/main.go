package main

import (
	"context"
	"log"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/dag"
	"github.com/kageprime/veritas/go-orchestrator/internal/nodes"
)

func main() {
	log.Println("Starting End-to-End DAG test with Python/Groq nodes...")

	pythonExec := func(scriptName string) func(context.Context, map[string]interface{}) (interface{}, error) {
		return func(ctx context.Context, input map[string]interface{}) (interface{}, error) {
			log.Printf("Executing Python node: %s", scriptName)
			return nodes.RunPythonNode(ctx, scriptName, input)
		}
	}

	w := &dag.Workflow{
		Nodes: []dag.Node{
			{ID: "retrieve", Type: "retrieve", DependsOn: []string{}, Execute: pythonExec("retrieve.py")},
			{ID: "extract_claims", Type: "extract_claims", DependsOn: []string{"retrieve"}, Execute: pythonExec("extract_claims.py")},
			{ID: "map_evidence", Type: "map_evidence", DependsOn: []string{"retrieve", "extract_claims"}, Execute: pythonExec("map_evidence.py")},
			{ID: "critique", Type: "critique", DependsOn: []string{"retrieve", "extract_claims", "map_evidence"}, Execute: pythonExec("critique.py")},
			{ID: "detect_missing", Type: "detect_missing", DependsOn: []string{"extract_claims", "map_evidence"}, Execute: pythonExec("detect_missing.py")},
			{ID: "map_language", Type: "map_language", DependsOn: []string{"extract_claims"}, Execute: pythonExec("map_language.py")},
			{ID: "scrutinize", Type: "scrutinize", DependsOn: []string{"extract_claims", "critique", "detect_missing", "map_language"}, Execute: pythonExec("scrutinize.py")},
			{ID: "resolve", Type: "resolve", DependsOn: []string{"extract_claims", "map_evidence", "critique", "scrutinize"}, Execute: pythonExec("resolve.py")},
			{ID: "generate_article", Type: "generate_article", DependsOn: []string{"resolve"}, Execute: pythonExec("generate_article.py")},
				{ID: "store", Type: "store", DependsOn: []string{"generate_article"}, Execute: pythonExec("store.py")},
			},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	updates, err := w.Execute(ctx, `{"topic": "The Apollo 11 Moon Landing"}`)
	if err != nil {
		log.Fatalf("Failed to execute DAG: %v", err)
	}

	for update := range updates {
		log.Printf("[DAG] Node: %s | Status: %s", update.NodeID, update.Status)
		if update.Status == "failed" {
			log.Fatalf("DAG Execution failed at node %s: %s", update.NodeID, update.Error)
		}
		if update.Status == "completed" && update.NodeID == "generate_article" {
			log.Printf("Final Output generated successfully!")
		}
	}
	
	log.Println("End-to-End Test completed successfully.")
}
