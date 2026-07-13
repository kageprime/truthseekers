package credstore

import (
	"os"
	"sync"
)

// Store holds API tokens in memory with concurrent-safe hot-swap.
// Keys are service identifiers (e.g. "do", "groq", "tavily").
type Store struct {
	mu  sync.RWMutex
	m   map[string]string
}

// New creates a Store pre-populated from the given env-to-service mapping.
// Each entry is envVar -> serviceKey; the env var is read immediately.
func New(envMap map[string]string) *Store {
	s := &Store{m: make(map[string]string, len(envMap))}
	for envVar, serviceKey := range envMap {
		if v := os.Getenv(envVar); v != "" {
			s.m[serviceKey] = v
		}
	}
	return s
}

// Get returns the token for a service, or empty string.
func (s *Store) Get(service string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.m[service]
}

// Set swaps the token for a service atomically. Takes effect immediately.
func (s *Store) Set(service, token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[service] = token
}

// All returns a snapshot of all stored tokens.
func (s *Store) All() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]string, len(s.m))
	for k, v := range s.m {
		out[k] = v
	}
	return out
}
