-- +goose Up
-- Phase 3: Global claim graph — signature dedup, claim versions, relationships

ALTER TABLE claims ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS global_status TEXT CHECK (global_status IN ('confirmed', 'contested', 'under_review'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_signature ON claims(signature) WHERE signature IS NOT NULL;

CREATE TABLE IF NOT EXISTS claim_versions (
    claim_id TEXT NOT NULL,
    generation_run_id TEXT NOT NULL,
    confidence_vector JSONB,
    derived_confidence FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (claim_id, generation_run_id)
);

CREATE TABLE IF NOT EXISTS claim_relationships (
    source_claim_id TEXT NOT NULL,
    target_claim_id TEXT NOT NULL,
    relationship_type TEXT CHECK (relationship_type IN ('supports', 'contradicts', 'related')),
    strength FLOAT,
    PRIMARY KEY (source_claim_id, target_claim_id)
);

-- +goose Down
DROP TABLE IF EXISTS claim_relationships;
DROP TABLE IF EXISTS claim_versions;
DROP INDEX IF EXISTS idx_claims_signature;
ALTER TABLE claims DROP COLUMN IF EXISTS global_status;
ALTER TABLE claims DROP COLUMN IF EXISTS signature;
