package registry

import (
	"bufio"
	"fmt"
	"io"
	"strings"
)

// parseFrontmatter reads the YAML frontmatter block (delimited by ---) from
// a reader and returns a key-value map. Everything before/after the block is
// ignored. Returns nil when no frontmatter is found.
func parseFrontmatter(r io.Reader) (map[string]string, error) {
	scanner := bufio.NewScanner(r)
	if !scanner.Scan() {
		return nil, nil
	}
	line := strings.TrimSpace(scanner.Text())
	if line != "---" {
		return nil, nil
	}
	fm := make(map[string]string)
	for scanner.Scan() {
		line = strings.TrimSpace(scanner.Text())
		if line == "---" {
			return fm, nil
		}
		k, v, ok := cut(line, ":")
		if !ok {
			continue
		}
		fm[strings.TrimSpace(k)] = strings.TrimSpace(v)
	}
	// Never reached if file is well-formed, but tolerate missing closing ---.
	return nil, fmt.Errorf("unclosed frontmatter block")
}

// cut splits s on the first sep and returns (before, after, true).
// Returns (s, "", false) when sep is absent.
func cut(s, sep string) (string, string, bool) {
	i := strings.Index(s, sep)
	if i < 0 {
		return s, "", false
	}
	return s[:i], s[i+len(sep):], true
}
