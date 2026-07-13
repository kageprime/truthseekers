package iam

import "fmt"

type AccountRole string

const (
	RoleOwner  AccountRole = "owner"
	RoleAdmin  AccountRole = "admin"
	RoleMember AccountRole = "member"
)

func ValidAccountRoles() []AccountRole {
	return []AccountRole{RoleOwner, RoleAdmin, RoleMember}
}

func ParseAccountRole(s string) (AccountRole, error) {
	switch s {
	case "owner":
		return RoleOwner, nil
	case "admin":
		return RoleAdmin, nil
	case "member":
		return RoleMember, nil
	default:
		return "", fmt.Errorf("unknown account role: %s", s)
	}
}

// Hierarchy: owner > admin > member
func AccountRoleAllows(role AccountRole, action string) bool {
	switch role {
	case RoleOwner:
		return true
	case RoleAdmin:
		return roleAllows(adminAccountPerms, action)
	case RoleMember:
		return roleAllows(memberAccountPerms, action)
	}
	return false
}

type ProjectRole string

const (
	RoleManager ProjectRole = "manager"
	RoleEditor  ProjectRole = "editor"
	RoleViewer  ProjectRole = "viewer"
)

func ValidProjectRoles() []ProjectRole {
	return []ProjectRole{RoleManager, RoleEditor, RoleViewer}
}

func ParseProjectRole(s string) (ProjectRole, error) {
	switch s {
	case "manager":
		return RoleManager, nil
	case "editor":
		return RoleEditor, nil
	case "viewer":
		return RoleViewer, nil
	default:
		return "", fmt.Errorf("unknown project role: %s", s)
	}
}

// Hierarchy: manager > editor > viewer
func ProjectRoleAllows(role ProjectRole, action string) bool {
	switch role {
	case RoleManager:
		return true
	case RoleEditor:
		return roleAllows(editorProjectPerms, action)
	case RoleViewer:
		return roleAllows(viewerProjectPerms, action)
	}
	return false
}

// maxProjectRole returns the higher-privilege role (manager > editor > viewer).
func MaxProjectRole(a, b ProjectRole) ProjectRole {
	rank := map[ProjectRole]int{RoleViewer: 0, RoleEditor: 1, RoleManager: 2}
	if rank[a] >= rank[b] {
		return a
	}
	return b
}

// ImplicitProjectRoleForAccount returns the project role implicitly granted by
// an account role. Owner and admin get manager on every project; member gets nil.
func ImplicitProjectRoleForAccount(role AccountRole) *ProjectRole {
	switch role {
	case RoleOwner, RoleAdmin:
		r := RoleManager
		return &r
	}
	return nil
}

// ── Permission sets ──────────────────────────────────────────

var adminAccountPerms = map[string]bool{
	AccountRead: true, AccountWrite: true, BillingAll: true,
	MemberAll: true, GroupAll: true, TokenAll: true, ProjectCreate: true,
	AdminSettingsRead: true, AdminSettingsWrite: true,
}

var memberAccountPerms = map[string]bool{
	AccountRead: true,
}

var editorProjectPerms = map[string]bool{
	ArticleRead: true, ArticleGenerate: true, ArticleRefresh: true,
	ChatRead: true, ChatSend: true, AgentRun: true, AgentStop: true,
	TriggerRead: true, TriggerFire: true,
	ProjectSession: true,
}

var viewerProjectPerms = map[string]bool{
	ArticleRead: true, ChatRead: true,
}

// ── Helpers ──────────────────────────────────────────

// Glob-perm matches: "article.*" matches "article.read", "article.generate", etc.
func roleAllows(perms map[string]bool, action string) bool {
	if perms[action] {
		return true
	}
	// Check glob — split on '.' and test parent wildcards:
	// "article.*" should match "article.read"
	for pattern := range perms {
		if matchGlob(pattern, action) {
			return true
		}
	}
	return false
}

// matchGlob tests whether a pattern like "article.*" matches an action like
// "article.read". Supports single-level wildcard (*) at any position.
// ponytail: limited glob — only '*' anywhere, no '**' or '?'. Add when needed.
func matchGlob(pattern, action string) bool {
	pi, ai := 0, 0
	for pi < len(pattern) && ai < len(action) {
		if pattern[pi] == '*' {
			// Wildcard: skip to end of segment or end of pattern
			if pi+1 < len(pattern) && pattern[pi+1] == '.' {
				// "*." matches rest of current segment then requires '.'
				for ai < len(action) && action[ai] != '.' {
					ai++
				}
				pi += 2 // skip "*."
				continue
			}
			// trailing '*', matches rest
			return true
		}
		if pattern[pi] != action[ai] {
			return false
		}
		pi++
		ai++
	}
	// Match only if both consumed, or pattern has trailing '*'
	if pi == len(pattern) && ai == len(action) {
		return true
	}
	if pi < len(pattern) && pattern[pi] == '*' && pi+1 == len(pattern) {
		return true
	}
	return false
}
