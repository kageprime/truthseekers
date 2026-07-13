package iam

const (
	ResourceAccount = "account"
	ResourceProject = "project"
	ResourceArticle = "article"
	ResourceChat    = "chat"
	ResourceSandbox = "sandbox"
	ResourceTrigger = "trigger"
	ResourceChannel = "channel"
	ResourceMember  = "member"
	ResourceAdmin   = "admin"
)

// Account-scoped actions (always scope_type='account')
const (
	AccountRead    = "account.read"
	AccountWrite   = "account.write"
	BillingAll     = "billing.*"
	MemberAll      = "member.*"
	GroupAll       = "group.*"
	TokenAll       = "token.*"
	ProjectCreate  = "project.create"
)

// Project-scoped actions (scope_type='project' or 'account')
const (
	ProjectAll      = "project.*"
	ProjectDeploy   = "project.deploy"
	ProjectCROpen   = "project.cr.open"
	ProjectCRAll    = "project.cr.*"
	ProjectSession  = "project.session.*"
	ProjectTrigger  = "project.trigger.*"
	ProjectGateway  = "project.gateway.*"
)

// Article-scoped actions
const (
	ArticleRead     = "article.read"
	ArticleGenerate = "article.generate"
	ArticleRefresh  = "article.refresh"
	ArticleDelete   = "article.delete"
	ArticleAll      = "article.*"
)

// Chat/Agent-scoped actions
const (
	ChatRead    = "chat.read"
	ChatSend    = "chat.send"
	ChatAll     = "chat.*"
	AgentRun    = "agent.run"
	AgentStop   = "agent.stop"
)

// Trigger-scoped actions
const (
	TriggerRead   = "trigger.read"
	TriggerUpdate = "trigger.update"
	TriggerDelete = "trigger.delete"
	TriggerFire   = "trigger.fire"
)

// Channel-scoped actions
const (
	ChannelRead       = "channel.read"
	ChannelConnect    = "channel.connect"
	ChannelSend       = "channel.send"
	ChannelDisconnect = "channel.disconnect"
)

// Admin-scoped actions
const (
	AdminSettingsRead  = "admin.settings.read"
	AdminSettingsWrite = "admin.settings.write"
	AdminAll           = "admin.*"
)

// ResourceTypes is the set of all valid resource type prefixes.
var ResourceTypes = []string{
	ResourceAccount, ResourceProject, ResourceArticle, ResourceChat,
	ResourceSandbox, ResourceTrigger, ResourceChannel, ResourceMember,
	ResourceAdmin,
}
