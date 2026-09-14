-- +goose Up
-- Durable generation sessions: the lifecycle engine was in-memory only, so a
-- restart wiped the queue and in-flight work. Write-through rows let boot
-- re-queue anything non-terminal. Dead-letter = failed rows at max retries.
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    status TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT '',
    persona TEXT NOT NULL DEFAULT 'veritas',
    source TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    idempotency_key TEXT NOT NULL DEFAULT '',
    retry_count INT NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_idempotency ON sessions(idempotency_key) WHERE idempotency_key <> '';
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_slug ON sessions(slug);

-- +goose Down
DROP TABLE IF EXISTS sessions;
