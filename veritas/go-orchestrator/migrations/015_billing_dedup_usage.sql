-- +goose Up
-- Billing hardening: webhook event dedup (replayed bodies must not re-fire
-- fulfillment or re-downgrade) + daily generation usage for quota enforcement.
CREATE TABLE IF NOT EXISTS webhook_events (
    event_key TEXT PRIMARY KEY,
    received_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS daily_usage (
    user_id TEXT NOT NULL,
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    generations INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

-- +goose Down
DROP TABLE IF EXISTS daily_usage;
DROP TABLE IF EXISTS webhook_events;
