-- Migration 016: GIN trigram indexes for search and expression index for claim graph contradiction ranking

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast ILIKE search indexes
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_abstract_trgm ON articles USING gin (abstract gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_maps_title_trgm ON maps USING gin (title gin_trgm_ops);

-- Expression index for global & article claim-graph contradiction ranking
CREATE INDEX IF NOT EXISTS idx_claims_contradiction_level ON claims (((confidence_vector ->> 'contradiction_level')::double precision));
