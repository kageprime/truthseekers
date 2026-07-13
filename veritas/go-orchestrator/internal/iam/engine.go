package iam

// AuthorizeTarget specifies what resource is being accessed.
type AuthorizeTarget struct {
	// Type is the resource type: "account", "project", "article", "chat", etc.
	Type string
	// ID is the resource identifier (empty for account-level actions).
	ID string
}

type AuthorizeResult struct {
	Allowed bool
	Reason  string
}

// Authorize checks whether a principal with the given roles may perform an
// action on a target. If target.Type is "project", the project role is checked;
// otherwise the account role is used.
func Authorize(accountRole AccountRole, projectRole *ProjectRole, target AuthorizeTarget, action string) AuthorizeResult {
	// Owner bypasses everything.
	if accountRole == RoleOwner {
		return AuthorizeResult{Allowed: true}
	}

	switch target.Type {
	case ResourceAccount:
		if AccountRoleAllows(accountRole, action) {
			return AuthorizeResult{Allowed: true}
		}
		return AuthorizeResult{Allowed: false, Reason: "account role insufficient"}

	case ResourceProject, ResourceArticle, ResourceChat, ResourceSandbox,
		ResourceTrigger, ResourceChannel:
		if projectRole != nil && ProjectRoleAllows(*projectRole, action) {
			return AuthorizeResult{Allowed: true}
		}
		if implicit := ImplicitProjectRoleForAccount(accountRole); implicit != nil {
			if ProjectRoleAllows(*implicit, action) {
				return AuthorizeResult{Allowed: true}
			}
		}
		return AuthorizeResult{Allowed: false, Reason: "project role insufficient"}

	case ResourceAdmin:
		if AccountRoleAllows(accountRole, action) {
			return AuthorizeResult{Allowed: true}
		}
		return AuthorizeResult{Allowed: false, Reason: "admin access denied"}

	default:
		return AuthorizeResult{Allowed: false, Reason: "unknown resource type"}
	}
}

// AccessibleResources describes which resources a principal can see.
type AccessibleResources struct {
	// Mode is "all", "none", or "allow_only".
	Mode string
	// Allowed is the set of resource IDs the principal may access (only when Mode=="allow_only").
	Allowed map[string]bool
}

// AuthorizedResources computes the set of project-level resources visible to a
// principal. In the current model, owner/admin see everything; other roles
// see only explicitly granted projects.
func AuthorizedResources(accountRole AccountRole, grantedProjectIDs []string) AccessibleResources {
	switch accountRole {
	case RoleOwner, RoleAdmin:
		return AccessibleResources{Mode: "all"}
	}
	return AccessibleResources{
		Mode:    "allow_only",
		Allowed: sliceToSet(grantedProjectIDs),
	}
}

func sliceToSet(s []string) map[string]bool {
	m := make(map[string]bool, len(s))
	for _, v := range s {
		m[v] = true
	}
	return m
}
