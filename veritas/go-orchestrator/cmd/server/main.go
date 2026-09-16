package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/kageprime/veritas/go-orchestrator/internal/api"
	"github.com/kageprime/veritas/go-orchestrator/internal/config"
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

	cfg := config.Load()
	cfg.Validate()
	cfg.Summary()

	// 1. Initialize Database Connection
	db, err := storage.NewDB(cfg.DatabaseURL, cfg.DataDir)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// 2. Run database migrations
	if err := db.Migrate(cfg.MigrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Database migrations applied successfully")

	// 2b. Admin bootstrap: ADMIN_EMAILS (comma-separated) are created if
	// missing and promoted to admin on every boot. This is the only
	// role-grant path — no HTTP route can self-grant roles.
	for _, email := range strings.Split(os.Getenv("ADMIN_EMAILS"), ",") {
		email = strings.ToLower(strings.TrimSpace(email))
		if email == "" {
			continue
		}
		u, err := db.FindOrCreateUserByEmail(email)
		if err != nil {
			log.Fatalf("Admin bootstrap failed for %s: %v", email, err)
		}
		if u.Role != "admin" && u.Role != "owner" {
			if err := db.SetUserRole(u.ID, "admin"); err != nil {
				log.Fatalf("Admin bootstrap role failed for %s: %v", email, err)
			}
			log.Printf("Admin bootstrap: %s promoted to admin", email)
		} else {
			log.Printf("Admin bootstrap: %s already %s", email, u.Role)
		}
	}

	// 3. Initialize and Start API Server
	server := api.NewServer(cfg.Port, db)

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

	// ponytail: 60s so Stop() can wait for in-flight generations to
	// checkpoint; sessions not yet terminal re-queue on next boot.
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	server.SessionEngine().Stop()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Error during server shutdown: %v", err)
	}

	log.Println("Shutdown complete.")
}
