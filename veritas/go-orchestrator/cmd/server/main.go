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
		log.Printf("DATABASE_URL not set, falling back to File-backed Mode")
	}

	// ENCARTA_DATA_DIR points at the encyclopedia JSON directory used by the
	// file-backed store when no database is available. Defaults to a few
	// common relative locations resolved inside the storage layer.
	dataDir := os.Getenv("ENCARTA_DATA_DIR")
	db, err := storage.NewDB(dbURL, dataDir)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

		// 2. Run database migrations
	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "migrations"
	}
	if err := db.Migrate(migrationsDir); err != nil {
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

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	server.SessionEngine().Stop()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Error during server shutdown: %v", err)
	}

	log.Println("Shutdown complete.")
}
