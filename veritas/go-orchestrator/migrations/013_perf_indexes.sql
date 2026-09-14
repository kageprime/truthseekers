-- +goose Up
-- Hot-FK indexes: epistemic reads fan out by claim_id with zero indexes.
CREATE INDEX IF NOT EXISTS idx_evidence_claim_id ON evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_gaps_claim_id ON evidence_gaps(claim_id);
CREATE INDEX IF NOT EXISTS idx_flags_claim_id ON language_flags(claim_id);
CREATE INDEX IF NOT EXISTS idx_scrutiny_claim_id ON scrutiny_assessments(claim_id);
CREATE INDEX IF NOT EXISTS idx_article_claims_claim_id ON article_claims(claim_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- +goose Down
DROP INDEX IF EXISTS idx_evidence_claim_id;
DROP INDEX IF EXISTS idx_gaps_claim_id;
DROP INDEX IF EXISTS idx_flags_claim_id;
DROP INDEX IF EXISTS idx_scrutiny_claim_id;
DROP INDEX IF EXISTS idx_article_claims_claim_id;
DROP INDEX IF EXISTS idx_graph_edges_target;
DROP INDEX IF EXISTS idx_claims_status;
