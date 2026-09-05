package storage

import (
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"time"
)

// ErrTaken reports that an email or username is already registered.
var ErrTaken = errors.New("email or username taken")

// Username signup with activation. New accounts start inactive; proving the
// inbox (activation code) flips them active. Accounts created through OTP
// login proved their inbox already (see FindOrCreateUserByEmail).

var validUsername = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,30}$`)

// ValidUsername reports whether a username is acceptable.
func ValidUsername(username string) bool {
	return validUsername.MatchString(username)
}

// CreateInactiveUser creates an inactive account with username + password.
// Email and username must both be unused.
func (d *DB) CreateInactiveUser(username, email, passwordHash string) (*User, error) {
	now := time.Now().UTC()
	if d.mockMode {
		if _, taken := d.mockUsers[email]; taken {
			return nil, ErrTaken
		}
		for _, u := range d.mockUsers {
			if strings.EqualFold(u.Username, username) {
				return nil, ErrTaken
			}
		}
		u := &User{
			ID: randID(), Email: email, Username: username,
			Name: username, Role: "member", SubscriptionTier: "free",
			CreatedAt: now, UpdatedAt: now, PasswordHash: passwordHash,
		}
		d.mockUsers[email] = u
		return u, nil
	}
	var n int
	if err := d.db.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1 OR username = $2", email, username).Scan(&n); err != nil {
		return nil, err
	}
	if n > 0 {
		return nil, ErrTaken
	}
	u := &User{
		ID: randID(), Email: email, Username: username,
		Name: username, Role: "member", SubscriptionTier: "free",
		CreatedAt: now, UpdatedAt: now, PasswordHash: passwordHash,
	}
	_, err := d.db.Exec(`INSERT INTO users (id, email, username, name, role, subscription_tier, onboarded, created_at, updated_at, password_hash, activated)
		VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,false)`,
		u.ID, u.Email, u.Username, u.Name, u.Role, u.SubscriptionTier, u.CreatedAt, u.UpdatedAt, u.PasswordHash)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// FindUserByUsername returns the user with the given username, if any.
func (d *DB) FindUserByUsername(username string) (*User, error) {
	if d.mockMode {
		for _, u := range d.mockUsers {
			if strings.EqualFold(u.Username, username) {
				return u, nil
			}
		}
		return nil, sql.ErrNoRows
	}
	var u User
	err := d.db.QueryRow(`SELECT id, email, name, avatar, role, subscription_tier, onboarded, created_at, updated_at, COALESCE(username,''), activated
		FROM users WHERE username = $1`, username).
		Scan(&u.ID, &u.Email, &u.Name, &u.Avatar, &u.Role, &u.SubscriptionTier, &u.Onboarded, &u.CreatedAt, &u.UpdatedAt, &u.Username, &u.Activated)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// SetActivated flips the activation flag for an email.
func (d *DB) SetActivated(email string, active bool) error {
	if d.mockMode {
		u, ok := d.mockUsers[email]
		if !ok {
			return sql.ErrNoRows
		}
		u.Activated = active
		return nil
	}
	res, err := d.db.Exec("UPDATE users SET activated = $1, updated_at = NOW() WHERE email = $2", active, email)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
