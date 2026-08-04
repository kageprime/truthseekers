-- +goose Up
-- Phase 4: Gap engagement (upvotes + community evidence submissions)

CREATE TABLE IF NOT EXISTS gap_upvotes (
    gap_id   TEXT NOT NULL,
    user_id  TEXT NOT NULL DEFAULT 'anonymous',
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (gap_id, user_id)
);

CREATE TABLE IF NOT EXISTS gap_submissions (
    id          TEXT PRIMARY KEY,
    gap_id      TEXT NOT NULL,
    user_id     TEXT NOT NULL DEFAULT 'anonymous',
    url         TEXT NOT NULL,
    note        TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gap_submissions_gap ON gap_submissions(gap_id);

-- +goose Down
DROP TABLE IF EXISTS gap_submissions;
DROP TABLE IF EXISTS gap_upvotes;
