package main

import (
	"context"
	"log"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/agent"
	"github.com/kageprime/veritas/go-orchestrator/internal/dag"
)

func main() {
	log.Println("Starting End-to-End DAG test with Go LLM nodes...")

	systemPrompt := `You are VERITAS, a knowledge construction engine. Deliver accurate, evidence-based responses. Never hallucinate.`
	execs := agent.DAGNodeExecutors(systemPrompt)

	w := &dag.Workflow{
		Nodes: []dag.Node{
			{ID: "retrieve", Type: "retrieve", DependsOn: []string{}, Execute: execs["retrieve"]},
			{ID: "extract_claims", Type: "extract_claims", DependsOn: []string{"retrieve"}, Execute: execs["extract_claims"]},
			{ID: "map_evidence", Type: "map_evidence", DependsOn: []string{"retrieve", "extract_claims"}, Execute: execs["map_evidence"]},
			{ID: "critique", Type: "critique", DependsOn: []string{"retrieve", "extract_claims", "map_evidence"}, Execute: execs["critique"]},
			{ID: "detect_missing", Type: "detect_missing", DependsOn: []string{"extract_claims", "map_evidence"}, Execute: execs["detect_missing"]},
			{ID: "map_language", Type: "map_language", DependsOn: []string{"extract_claims"}, Execute: execs["map_language"]},
			{ID: "scrutinize", Type: "scrutinize", DependsOn: []string{"extract_claims", "critique", "detect_missing", "map_language"}, Execute: execs["scrutinize"]},
			{ID: "resolve", Type: "resolve", DependsOn: []string{"extract_claims", "map_evidence", "critique", "scrutinize"}, Execute: execs["resolve"]},
			{ID: "generate_article", Type: "generate_article", DependsOn: []string{"resolve"}, Execute: execs["generate_article"]},
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
