-- +goose Up
-- Article visuals: generated PNGs live in Postgres (not the dyno disk —
-- Heroku's filesystem is ephemeral, so files would rot on every restart).
-- Names are deterministic per slug ({slug}-hero.png, {slug}-s1.png, …) so
-- regens upsert instead of accumulating.
CREATE TABLE IF NOT EXISTS article_images (
	name TEXT PRIMARY KEY,
	slug TEXT NOT NULL,
	mime TEXT NOT NULL DEFAULT 'image/png',
	data BYTEA NOT NULL,
	created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_images_slug ON article_images (slug);

-- +goose Down
DROP INDEX IF EXISTS idx_article_images_slug;
DROP TABLE IF EXISTS article_images;
