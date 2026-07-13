package manifest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// DefaultManifestFileName is the default manifest file name searched at boot.
const DefaultManifestFileName = "veritas.json"

// Load reads and parses a manifest from the given file path. If path is empty
// it walks parent directories looking for DefaultManifestFileName. Returns nil
// (no error) when no manifest file is found — the caller should use defaults.
func Load(path string) (*Manifest, error) {
	if path == "" {
		p, err := findUp(DefaultManifestFileName)
		if err != nil {
			return nil, nil // not found, use defaults
		}
		path = p
	}
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("manifest: open %s: %w", path, err)
	}
	defer f.Close()

	var m Manifest
	if err := json.NewDecoder(f).Decode(&m); err != nil {
		return nil, fmt.Errorf("manifest: parse %s: %w", path, err)
	}
	return &m, nil
}

// findUp walks up from the working directory looking for name. Returns the
// first match or an error if not found.
func findUp(name string) (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		candidate := filepath.Join(dir, name)
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("manifest: %s not found from %s", name, dir)
		}
		dir = parent
	}
}
