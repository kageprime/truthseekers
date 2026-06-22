# Stage 1: Build the Go binary
FROM golang:1.26-alpine AS builder

WORKDIR /build

COPY go-orchestrator/go.mod go-orchestrator/go.sum ./
RUN go mod download

COPY go-orchestrator/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /build/bin/veritas-orchestrator cmd/server/main.go

# Stage 2: Python workers + runtime image
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir httpx

COPY python-workers/requirements.txt ./python-workers/
RUN pip install --no-cache-dir -r python-workers/requirements.txt

COPY python-workers/ ./python-workers/
COPY --from=builder /build/bin/veritas-orchestrator ./go-orchestrator/veritas-orchestrator

EXPOSE 4097

WORKDIR /app/go-orchestrator

CMD ["./veritas-orchestrator"]
