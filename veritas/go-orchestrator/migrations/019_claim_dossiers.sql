-- +goose Up
-- Claim Finder (internet mode): open-web verdicts are cached per normalized
-- statement so a repeat search is instant and the "recent checks" feed has
-- something durable to read. Payload holds the full dossier JSON.
CREATE TABLE IF NOT EXISTS claim_dossiers (
    statement_hash   TEXT PRIMARY KEY,
    statement        TEXT NOT NULL,
    verdict          TEXT NOT NULL,
    confidence       DOUBLE PRECISION NOT NULL DEFAULT 0,
    grounded         BOOLEAN NOT NULL DEFAULT FALSE,
    sources_reviewed INT NOT NULL DEFAULT 0,
    payload          JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claim_dossiers_updated_at ON claim_dossiers (updated_at DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_claim_dossiers_updated_at;
DROP TABLE IF EXISTS claim_dossiers;
