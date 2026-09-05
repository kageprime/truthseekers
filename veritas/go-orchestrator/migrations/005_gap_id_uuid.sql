-- +goose Up
-- gap_upvotes/gap_submissions gap_id was TEXT while evidence_gaps.id is UUID,
-- which breaks every JOIN between them (pq: operator does not exist: uuid = text).
ALTER TABLE gap_upvotes ALTER COLUMN gap_id TYPE UUID USING gap_id::uuid;
ALTER TABLE gap_submissions ALTER COLUMN gap_id TYPE UUID USING gap_id::uuid;

-- +goose Down
ALTER TABLE gap_submissions ALTER COLUMN gap_id TYPE TEXT USING gap_id::text;
ALTER TABLE gap_upvotes ALTER COLUMN gap_id TYPE TEXT USING gap_id::text;
