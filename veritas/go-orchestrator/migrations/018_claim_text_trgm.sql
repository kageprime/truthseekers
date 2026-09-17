-- +goose Up
-- Claim Finder: trigram GIN keeps the claims.text ILIKE %..% substring match
-- indexed (same rationale as 017 — a tsvector rewrite would change matching
-- behavior for a bigger diff).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_claims_text_trgm ON claims USING gin (text gin_trgm_ops);

-- +goose Down
DROP INDEX IF EXISTS idx_claims_text_trgm;
