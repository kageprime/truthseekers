package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Migrate runs all pending migrations from the given directory.
// Migrations are .sql files named NNN_description.sql where NNN is a zero-padded
// version number. Applied migrations are tracked in a schema_migrations table.
func (d *DB) Migrate(migrationsDir string) error {
	if d.mockMode {
		return nil
	}

	// Ensure schema_migrations tracking table exists
	if _, err := d.db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INT PRIMARY KEY,
			applied_at TIMESTAMP DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	// Read migration files
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var files []migrationFile
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		version, ok := parseVersion(entry.Name())
		if !ok {
			continue
		}
		files = append(files, migrationFile{version: version, name: entry.Name()})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].version < files[j].version
	})

	for _, mf := range files {
		var applied bool
		err := d.db.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", mf.version).Scan(&applied)
		if err != nil {
			return fmt.Errorf("check migration %d: %w", mf.version, err)
		}
		if applied {
			continue
		}

		path := filepath.Join(migrationsDir, mf.name)
		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read migration %d: %w", mf.version, err)
		}

		// Split into Up and Down sections (simple parser)
		upSQL := extractUpMigration(string(sqlBytes))
		if strings.TrimSpace(upSQL) == "" {
			continue
		}

		tx, err := d.db.Begin()
		if err != nil {
			return fmt.Errorf("begin tx for migration %d: %w", mf.version, err)
		}

		if _, err := tx.Exec(upSQL); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply migration %d: %w", mf.version, err)
		}

		if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", mf.version); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %d: %w", mf.version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %d: %w", mf.version, err)
		}
	}

	return nil
}

type migrationFile struct {
	version int
	name    string
}

func parseVersion(name string) (int, bool) {
	parts := strings.SplitN(name, "_", 2)
	if len(parts) < 2 {
		return 0, false
	}
	v, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, false
	}
	return v, true
}

func extractUpMigration(sql string) string {
	// Find the -- +goose Up section
	upStart := strings.Index(sql, "-- +goose Up")
	if upStart == -1 {
		// No goose marker — assume entire file is Up
		return sql
	}
	upStart += len("-- +goose Up")

	upEnd := strings.Index(sql[upStart:], "-- +goose Down")
	if upEnd == -1 {
		return strings.TrimSpace(sql[upStart:])
	}
	return strings.TrimSpace(sql[upStart : upStart+upEnd])
}
