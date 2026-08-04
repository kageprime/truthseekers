.PHONY: build run db db-stop test migrate

# Default build target
build:
	go build -o bin/server cmd/server/main.go

# Run the API Server
run: build
	./bin/server

# Start PostgreSQL using Docker
db:
	docker run --name veritas-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=veritas -p 5432:5432 -d postgres:15
	@echo "Waiting for PostgreSQL to start..."
	@sleep 3
	@echo "Database started. Run 'make migrate' to apply schema."

# Apply database migrations (requires DATABASE_URL env var or uses default)
migrate:
	@echo "Applying migrations..."
	DATABASE_URL=$${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/veritas?sslmode=disable} MIGRATIONS_DIR=./migrations go run cmd/server/main.go &
	@sleep 2
	@pkill -f "go run cmd/server/main.go" || true
	@echo "Migrations applied."

# Stop PostgreSQL
db-stop:
	docker stop veritas-pg
	docker rm veritas-pg

# Run Tests
test:
	go test -v ./...

# Default build target
build:
	go build -o bin/server cmd/server/main.go

# Run the API Server
run: build
	./bin/server

# Start PostgreSQL using Docker
db:
	docker run --name veritas-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=veritas -p 5432:5432 -d postgres:15
	@echo "Waiting for PostgreSQL to start..."
	@sleep 3
	docker exec -i veritas-pg psql -U postgres -d veritas < storage/schema.sql
	@echo "Database started and schema loaded."

# Stop PostgreSQL
db-stop:
	docker stop veritas-pg
	docker rm veritas-pg

# Run Tests
test:
	go test -v ./...
