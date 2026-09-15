-- +goose Up
-- Search scale: trigram GIN keeps ILIKE %..% substring semantics while using
-- an index (a tsvector rewrite would change matching behavior — bigger diff,
-- new ranking bugs). Expression index serves the contradiction ORDER BYs.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_abstract_trgm ON articles USING gin (abstract gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_maps_title_trgm ON maps USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_claims_contradiction ON claims (((confidence_vector ->> 'contradiction_level')::double precision));

-- +goose Down
DROP INDEX IF EXISTS idx_claims_contradiction;
DROP INDEX IF EXISTS idx_maps_title_trgm;
DROP INDEX IF EXISTS idx_articles_abstract_trgm;
DROP INDEX IF EXISTS idx_articles_title_trgm;
