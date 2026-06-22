# Stage 1: Build the Go binary
FROM golang:1.21-alpine AS builder

WORKDIR /build

# Copy go mod files
COPY go-orchestrator/go.mod ./go-orchestrator/
# Since there is no go.sum currently, we just copy go.mod

WORKDIR /build/go-orchestrator
# Download dependencies if any (currently none external besides standard lib mostly, but good practice)
RUN go mod download

# Copy the rest of the Go source code
COPY go-orchestrator/ ./

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /build/bin/veritas-orchestrator cmd/server/main.go

# Stage 2: Setup Python environment and Final Image
FROM python:3.11-slim

WORKDIR /app

# Install dependencies needed for python workers
COPY python-workers/requirements.txt ./python-workers/
RUN pip install --no-cache-dir -r python-workers/requirements.txt

# Copy Python worker scripts
COPY python-workers/ ./python-workers/

# Copy the Go binary from the builder stage
COPY --from=builder /build/bin/veritas-orchestrator ./go-orchestrator/veritas-orchestrator

# Expose the API port
EXPOSE 4097

# Set working directory to where the Go binary expects to be run so relative paths work
# The Go code looks for filepath.Join("..", "python-workers", "nodes", scriptName)
WORKDIR /app/go-orchestrator

# Run the Go orchestrator
CMD ["./veritas-orchestrator"]
