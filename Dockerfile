FROM golang:1.26-alpine

WORKDIR /app

COPY go-orchestrator/go.mod go-orchestrator/go.sum ./
RUN go mod download

COPY go-orchestrator/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o veritas-orchestrator cmd/server/main.go

EXPOSE 4097

CMD ["./veritas-orchestrator"]
