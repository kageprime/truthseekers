package executor

// ShareScope controls who can use a connector.
type ShareScope string

const (
	ShareProject ShareScope = "project" // Everyone in the project
	SharePrivate ShareScope = "private" // Only the connector author
	ShareMembers ShareScope = "members" // Specific users/groups
)

// SecretGrant specifies which users and groups have access.
type SecretGrant struct {
	UserIDs  []string
	GroupIDs []string
}

// IsSecretUsableBy checks if a subject (userID) may use a connector given its
// sharing scope, grants, and author. Empty scope means ShareProject (all
// built-in connectors) for backward compatibility. SharePrivate requires an
// exact owner match — fail closed when owner is unknown.
func IsSecretUsableBy(scope ShareScope, grants SecretGrant, ownerID, userID string) bool {
	if scope == "" {
		scope = ShareProject
	}
	switch scope {
	case ShareProject:
		return true
	case SharePrivate:
		return ownerID != "" && userID != "" && ownerID == userID
	case ShareMembers:
		for _, uid := range grants.UserIDs {
			if uid == userID {
				return true
			}
		}
		return false
	}
	return false
}
