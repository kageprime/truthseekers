package storage

import "fmt"

// Article image persistence (DB-backed — the dyno filesystem is ephemeral).
// Names are deterministic per slug so regens upsert instead of accumulating.

// SaveArticleImage upserts a generated image by name.
func (d *DB) SaveArticleImage(name, slug, mime string, data []byte) error {
	if d.mockMode {
		return nil
	}
	if len(data) == 0 || len(data) > 10<<20 {
		return fmt.Errorf("save article image: invalid size %d", len(data))
	}
	_, err := d.db.Exec(`
		INSERT INTO article_images (name, slug, mime, data)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (name) DO UPDATE SET
			slug = EXCLUDED.slug,
			mime = EXCLUDED.mime,
			data = EXCLUDED.data,
			created_at = NOW()
	`, name, slug, mime, data)
	if err != nil {
		return fmt.Errorf("save article image: %w", err)
	}
	return nil
}

// ArticleImage is a stored visual served by GET /images/{name}.
type ArticleImage struct {
	Name string
	Mime string
	Data []byte
}

// GetArticleImage fetches an image by name. Returns nil, nil when missing.
func (d *DB) GetArticleImage(name string) (*ArticleImage, error) {
	if d.mockMode {
		return nil, nil
	}
	var img ArticleImage
	err := d.db.QueryRow(
		"SELECT name, mime, data FROM article_images WHERE name = $1", name,
	).Scan(&img.Name, &img.Mime, &img.Data)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("get article image: %w", err)
	}
	return &img, nil
}
