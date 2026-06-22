.PHONY: up down build logs

# Start the full VERITAS stack (Postgres, Go Orchestrator, Next.js Frontend)
up:
	docker-compose up -d

# Stop the stack
down:
	docker-compose down

# Build/Rebuild the docker images
build:
	docker-compose build

# Tail logs
logs:
	docker-compose logs -f
