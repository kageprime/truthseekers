FROM golang:1.26-alpine

WORKDIR /app

COPY veritas/go-orchestrator/go.mod veritas/go-orchestrator/go.sum ./
RUN go mod download

COPY veritas/go-orchestrator/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o veritas-orchestrator cmd/server/main.go

EXPOSE 4097

CMD ["./veritas-orchestrator"]
