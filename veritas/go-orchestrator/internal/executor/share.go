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
// sharing scope and grants.
func IsSecretUsableBy(scope ShareScope, grants SecretGrant, userID string) bool {
	switch scope {
	case ShareProject:
		return true
	case SharePrivate:
		// Only the author — would need an authorID field; for now, allow all.
		return true
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
