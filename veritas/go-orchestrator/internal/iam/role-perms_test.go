package iam

import "testing"

func TestAccountRoleAllows(t *testing.T) {
	tests := []struct {
		role   AccountRole
		action string
		want   bool
	}{
		{RoleOwner, AccountRead, true},
		{RoleOwner, AdminSettingsWrite, true},
		{RoleOwner, ArticleGenerate, true}, // owner bypasses everything
		{RoleAdmin, AccountRead, true},
		{RoleAdmin, AdminSettingsRead, true},
		{RoleAdmin, AccountWrite, true},
		{RoleAdmin, MemberAll, true},
		{RoleAdmin, ProjectCreate, true},
		{RoleAdmin, ArticleGenerate, false}, // admin cannot do article.* without project context
		{RoleMember, AccountRead, true},
		{RoleMember, AccountWrite, false},
		{RoleMember, AdminSettingsRead, false},
	}
	for _, tc := range tests {
		got := AccountRoleAllows(tc.role, tc.action)
		if got != tc.want {
			t.Errorf("AccountRoleAllows(%q, %q) = %v, want %v", tc.role, tc.action, got, tc.want)
		}
	}
}

func TestProjectRoleAllows(t *testing.T) {
	tests := []struct {
		role   ProjectRole
		action string
		want   bool
	}{
		{RoleManager, ArticleRead, true},
		{RoleManager, ArticleGenerate, true},
		{RoleManager, ArticleDelete, true},
		{RoleManager, ProjectDeploy, true},
		{RoleManager, ProjectSession, true},
		{RoleManager, AgentRun, true},
		{RoleEditor, ArticleRead, true},
		{RoleEditor, ArticleGenerate, true},
		{RoleEditor, ArticleRefresh, true},
		{RoleEditor, ArticleDelete, false},
		{RoleEditor, ProjectDeploy, false},
		{RoleEditor, AgentRun, true},
		{RoleViewer, ArticleRead, true},
		{RoleViewer, ArticleGenerate, false},
		{RoleViewer, ChatRead, true},
		{RoleViewer, ChatSend, false},
	}
	for _, tc := range tests {
		got := ProjectRoleAllows(tc.role, tc.action)
		if got != tc.want {
			t.Errorf("ProjectRoleAllows(%q, %q) = %v, want %v", tc.role, tc.action, got, tc.want)
		}
	}
}

func TestMatchGlob(t *testing.T) {
	tests := []struct {
		pattern string
		action  string
		want    bool
	}{
		{"article.*", "article.read", true},
		{"article.*", "article.generate", true},
		{"article.*", "chat.read", false},
		{"project.*", "project.deploy", true},
		{"project.*", "project.session.*", true},
		{"project.cr.*", "project.cr.open", true},
		{"*", "anything.here", true},
		{"billing.*", "billing.read", true},
		{"billing.*", "billing.write", true},
		{"billing.*", "article.read", false},
	}
	for _, tc := range tests {
		got := matchGlob(tc.pattern, tc.action)
		if got != tc.want {
			t.Errorf("matchGlob(%q, %q) = %v, want %v", tc.pattern, tc.action, got, tc.want)
		}
	}
}

func TestAuthorize(t *testing.T) {
	editor := RoleEditor
	viewer := RoleViewer

	tests := []struct {
		name     string
		accRole  AccountRole
		projRole *ProjectRole
		target   AuthorizeTarget
		action   string
		want     bool
	}{
		{"owner bypass", RoleOwner, nil, AuthorizeTarget{Type: ResourceArticle}, ArticleGenerate, true},
		{"admin project article", RoleAdmin, nil, AuthorizeTarget{Type: ResourceArticle}, ArticleGenerate, true}, // implicit manager
		{"member viewer article read", RoleMember, &viewer, AuthorizeTarget{Type: ResourceArticle}, ArticleRead, true},
		{"member viewer article gen denied", RoleMember, &viewer, AuthorizeTarget{Type: ResourceArticle}, ArticleGenerate, false},
		{"member editor article gen", RoleMember, &editor, AuthorizeTarget{Type: ResourceArticle}, ArticleGenerate, true},
		{"admin admin settings", RoleAdmin, nil, AuthorizeTarget{Type: ResourceAdmin}, AdminSettingsRead, true},
		{"member admin settings denied", RoleMember, nil, AuthorizeTarget{Type: ResourceAdmin}, AdminSettingsRead, false},
	}
	for _, tc := range tests {
		got := Authorize(tc.accRole, tc.projRole, tc.target, tc.action)
		if got.Allowed != tc.want {
			t.Errorf("Authorize(%q, %v, %v, %q) = %+v, want allowed=%v",
				tc.accRole, tc.projRole, tc.target, tc.action, got, tc.want)
		}
	}
}

func TestMaxProjectRole(t *testing.T) {
	if got := MaxProjectRole(RoleViewer, RoleEditor); got != RoleEditor {
		t.Errorf("MaxProjectRole(viewer, editor) = %v, want editor", got)
	}
	if got := MaxProjectRole(RoleManager, RoleEditor); got != RoleManager {
		t.Errorf("MaxProjectRole(manager, editor) = %v, want manager", got)
	}
}

func TestImplicitProjectRole(t *testing.T) {
	if r := ImplicitProjectRoleForAccount(RoleOwner); r == nil || *r != RoleManager {
		t.Errorf("ImplicitProjectRoleForAccount(owner) = %v, want manager", r)
	}
	if r := ImplicitProjectRoleForAccount(RoleMember); r != nil {
		t.Errorf("ImplicitProjectRoleForAccount(member) = %v, want nil", r)
	}
}
