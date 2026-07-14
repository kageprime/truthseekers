package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	"github.com/kageprime/veritas/go-orchestrator/internal/api"
	"github.com/kageprime/veritas/go-orchestrator/internal/storage"
)

func main() {
	log.Println("Starting VERITAS Go Orchestrator...")

	// Safely load .env from common root locations (first one found)
	for _, envPath := range []string{".env", "../../.env", "../../../.env"} {
		if err := godotenv.Load(envPath); err == nil {
			log.Printf("Loaded environment from %s\n", envPath)
			break
		}
	}

	// 1. Initialize Database Connection
	// In a real environment, read from environment variables
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Printf("DATABASE_URL not set, falling back to Mock Mode")
	}

	db, err := storage.NewDB(dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// 2. Initialize and Start API Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "4097" // Matching Hono API server port
	}

	server := api.NewServer(port, db)

	// Graceful shutdown setup
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.Start(); err != nil {
			log.Fatalf("API Server failed: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down VERITAS Go Orchestrator...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	server.SessionEngine().Stop()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Error during server shutdown: %v", err)
	}

	log.Println("Shutdown complete.")
}
