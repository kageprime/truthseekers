-- +goose Up

-- 10. Article contestations: a reader's argued challenge plus the
-- adjudicator's verdict. Audit trail for regeneration decisions; the
-- argument itself travels into an approved regen via the session Note,
-- not by re-reading this table mid-pipeline.
CREATE TABLE IF NOT EXISTS contestations (
    id UUID PRIMARY KEY,
    article_slug TEXT NOT NULL,
    user_id TEXT NOT NULL,
    argument TEXT NOT NULL,
    verdict TEXT NOT NULL DEFAULT 'pending',
    reasoning TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contestations_slug ON contestations(article_slug);
