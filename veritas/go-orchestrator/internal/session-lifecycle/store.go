package sessionlifecycle

// Store is the durability seam for sessions. The engine writes through on
// every Create/Transition; boot reloads non-terminal rows via Restore.
// The zero value (nil store) means memory-only — used by tests and file mode.
type Store interface {
	Upsert(s Session) error
}

// nullStore drops writes. Keeps NewEngine dependency-free.
type nullStore struct{}

func (nullStore) Upsert(Session) error { return nil }
