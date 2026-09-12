-- +goose Up

-- 11. Evidence freshness: the code has always written and read
-- evidence.created_at (freshness scoring depends on it), but the column
-- was never created — every evidence write and every freshness read has
-- failed since launch. ADD COLUMN backfills existing rows with NOW().
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
