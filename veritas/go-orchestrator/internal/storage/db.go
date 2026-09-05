package storage

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// Core models matching packages/core/src/types.ts

type MediaItem struct {
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
	Caption string `json:"caption,omitempty"`
	Src     string `json:"src,omitempty"`
	Source  string `json:"source,omitempty"`
	Code    string `json:"code,omitempty"`
	Prompt  string `json:"prompt,omitempty"`
}

type Section struct {
	ID      string      `json:"id"`
	Title   string      `json:"title"`
	Content string      `json:"content"`
	Media   []MediaItem `json:"media,omitempty"`
}

type TimelineEvent struct {
	ID          string   `json:"id,omitempty"`
	Year        interface{} `json:"year"` // Mixed in TS (can be number or string, e.g. 1324 or "14th century")
	Event       string   `json:"event"`
	Description string   `json:"description,omitempty"`
	Image       string   `json:"image,omitempty"`
	Causes      []string `json:"causes,omitempty"`
	Category    string   `json:"category,omitempty"`
}

// UnmarshalJSON accepts both the canonical "event" key (used by generated
// articles) and the "title" key (used by hand-authored encyclopedia JSON
// files) so legacy data loads without a separate migration.
func (t *TimelineEvent) UnmarshalJSON(data []byte) error {
	type alias TimelineEvent
	if err := json.Unmarshal(data, (*alias)(t)); err != nil {
		return err
	}
	if t.Event == "" {
		var flex struct {
			Title string `json:"title"`
		}
		_ = json.Unmarshal(data, &flex)
		t.Event = flex.Title
	}
	return nil
}

type CrossReference struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Relationship string `json:"relationship"`
}

type Citation struct {
	URL       string `json:"url"`
	Title     string `json:"title,omitempty"`
	Accessed  string `json:"accessed,omitempty"`
	Relevance string `json:"relevance,omitempty"`
}

// ────────────────────────────────────────────────────────────
// Epistemic Pipeline Storage (Layer 1-3)
// ────────────────────────────────────────────────────────────

type Claim struct {
	ID                string                 `json:"id"`
	Text              string                 `json:"text"`
	Signature         string                 `json:"signature,omitempty"`
	Type              string                 `json:"type"` // factual | interpretive | predictive
	Status            string                 `json:"status"` // supported | disputed | weak | unknown
	ConfidenceVector  map[string]interface{} `json:"confidence_vector,omitempty"`
	DerivedConfidence float64                `json:"derived_confidence"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

type Source struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	Type             string                 `json:"type"` // institutional | individual | anonymous | leaked_material
	CredibilityVector map[string]interface{} `json:"credibility_vector,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
}

type Evidence struct {
	ID                string     `json:"id"`
	ClaimID           string     `json:"claim_id"`
	Type              string     `json:"type"` // primary_document | eyewitness | expert_analysis | leaked | patent | dataset | anonymous
	URL               string     `json:"url,omitempty"`
	ChainOfCustody    string     `json:"chain_of_custody"` // verified | partial | unverified
	AcquisitionMethod string     `json:"acquisition_method,omitempty"`
	Accessibility     string     `json:"accessibility"` // public | restricted | classified | destroyed
	SupportsClaim     bool       `json:"supports_claim"`
	SourceID          *string    `json:"source_id,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type EvidenceGap struct {
	ID                 string                 `json:"id"`
	ClaimID            string                 `json:"claim_id"`
	GapType            string                 `json:"gap_type"` // expected | unexpected | unknown_expectedness
	ExpectedArtifact   string                 `json:"expected_artifact"` // patent | primary_source | dataset | eyewitness
	VerificationStatus string                 `json:"verification_status"` // verified_gap | unverified_gap | false_positive_risk
	ExternalMetadata   map[string]interface{} `json:"external_metadata,omitempty"`
	CauseLabel         string                 `json:"cause_label,omitempty"` // classified | destroyed | unlocatable | unknown
	CauseConfidence    float64                `json:"cause_confidence"`
	DetectedAt         time.Time              `json:"detected_at"`
}

type LanguageFlag struct {
	ID               string  `json:"id"`
	ClaimID          string  `json:"claim_id"`
	SourcePhrase     string  `json:"source_phrase"`
	PrecisionUpgrade string  `json:"precision_upgrade"`
	FramingOrigin    string  `json:"framing_origin"`
	FramingFunction  string  `json:"framing_function"`
	Confidence       float64 `json:"confidence"`
	DetectedAt       time.Time `json:"detected_at"`
}

type ScrutinyAssessment struct {
	ID              string                 `json:"id"`
	ClaimID         string                 `json:"claim_id"`
	RiskFactors     map[string]interface{} `json:"risk_factors,omitempty"`
	RiskScore       float64                `json:"risk_score"`
	ActionRequired  map[string]interface{} `json:"action_required,omitempty"`
	AssessedAt      time.Time              `json:"assessed_at"`
}

type ArticleClaim struct {
	ArticleID string `json:"article_id"`
	ClaimID   string `json:"claim_id"`
}

type EpistemicPipelineData struct {
	Claims      []Claim            `json:"claims"`
	Sources     []Source           `json:"sources"`
	Evidence    []Evidence         `json:"evidence"`
	Gaps        []EvidenceGap      `json:"gaps"`
	LangFlags   []LanguageFlag     `json:"language_flags"`
	Scrutinies  []ScrutinyAssessment `json:"scrutinies"`
	ArticleClaims []ArticleClaim   `json:"article_claims"`
}

type ArticleMetadata struct {
	Version     int    `json:"version"`
	Created     string `json:"created"`
	Updated     string `json:"updated"`
	Status      string `json:"status"` // draft | published | error
	Freshness   string `json:"freshness,omitempty"`
	GeneratedBy string `json:"generatedBy,omitempty"`
}

type Article struct {
	Slug              string                 `json:"slug"`
	Title             string                 `json:"title"`
	Abstract          string                 `json:"abstract"`
	Sections          []Section              `json:"sections"`
	Timeline          []TimelineEvent        `json:"timeline"`
	Categories        []string               `json:"categories"`
	Crossrefs         []CrossReference       `json:"crossrefs"`
	Citations         []Citation             `json:"citations"`
	Blocks            []interface{}          `json:"blocks,omitempty"`
	ConfidenceVector  map[string]interface{} `json:"confidence_vector,omitempty"`
	DerivedConfidence float64                `json:"derived_confidence"`
	Metadata          ArticleMetadata        `json:"metadata"`
	CreatedAt         time.Time              `json:"created_at,omitempty"`
	UpdatedAt         time.Time              `json:"updated_at,omitempty"`
}

type GraphEdge struct {
	Source       string `json:"source"`
	Target       string `json:"target"`
	Relationship string `json:"relationship"`
}

// ClaimRelationship is a typed edge between two claims (supports / contradicts /
// related). Stored in the claim_relationships table and surfaced by the
// claim-level graph API.
type ClaimRelationship struct {
	SourceClaimID    string  `json:"source_claim_id"`
	TargetClaimID    string  `json:"target_claim_id"`
	RelationshipType string  `json:"relationship_type"` // supports | contradicts | related
	Strength         float64 `json:"strength"`
}

type MapEntry struct {
	Slug        string        `json:"slug"`
	Title       string        `json:"title"`
	Subtitle    string        `json:"subtitle,omitempty"`
	Description string        `json:"description"`
	Content     string        `json:"content"`
	Image       string        `json:"image,omitempty"`
	Region      string        `json:"region,omitempty"`
	Era         string        `json:"era,omitempty"`
	Type        string        `json:"type"` // static | interactive
	ExternalUrl string        `json:"externalUrl,omitempty"`
	CenterLat   *float64      `json:"centerLat,omitempty"`
	CenterLng   *float64      `json:"centerLng,omitempty"`
	Zoom        int           `json:"zoom"`
	GeoJson     interface{}   `json:"geoJson,omitempty"`
	Markers     []interface{} `json:"markers,omitempty"`
	CreatedAt   string        `json:"createdAt"`
	UpdatedAt   string        `json:"updatedAt"`
}

type Job struct {
	Slug      string      `json:"slug"`
	Title     string      `json:"title"`
	Status    string      `json:"status"`
	Phase     string      `json:"phase"`
	Error     string      `json:"error,omitempty"`
	Meta      interface{} `json:"meta,omitempty"`
	CreatedAt string      `json:"createdAt"`
	UpdatedAt string      `json:"updatedAt"`
}

type DB struct {
	db                *sql.DB
	mockMode          bool
	storageMode       string // "postgres" | "file"
	fs                *fileStore
	mockMessages      map[string][]*StoredMessage
	mockUsers         map[string]*User
	mockConversations map[string]*Conversation
	otpMu             sync.Mutex
	mockOTP           map[string]otpEntry
}

// otpEntry is the mock-mode OTP record (postgres uses the otp_codes table).
type otpEntry struct {
	hash     string
	expires  time.Time
	attempts int
}

// StorageMode reports which backing store is active: "postgres" when a real
// database is connected, or "file" when running off the in-memory file
// store (DATABASE_URL unset/unreachable). Exposed via /health so DB-down is
// never silent.
func (d *DB) StorageMode() string {
	if d == nil {
		return "file"
	}
	if d.storageMode == "" {
		if d.mockMode {
			return "file"
		}
		return "postgres"
	}
	return d.storageMode
}

// ArticleCount returns the number of articles available in the active store.
func (d *DB) ArticleCount() int {
	if d.mockMode && d.fs != nil {
		return len(d.fs.articles)
	}
	if !d.mockMode {
		var n int
		_ = d.db.QueryRow("SELECT COUNT(*) FROM articles").Scan(&n)
		return n
	}
	return 0
}

// newMockDB builds a file-backed in-memory store for zero-infrastructure
// local development. It loads real article JSON from the data directory so
// the product is fully populated even with no database.
func newMockDB(dataDir string) *DB {
	fs, err := loadFileStore(dataDir)
	if err != nil {
		fmt.Printf("WARNING: failed to load file store (%v). Falling back to empty store.\n", err)
		fs = &fileStore{
			articles:      map[string]*Article{},
			claims:        map[string][]*Claim{},
			claimsByID:    map[string]*Claim{},
			evidence:      map[string][]*Evidence{},
			gaps:          map[string][]*EvidenceGap{},
			backlinks:     map[string][]*GraphEdge{},
			relationships: map[string][]*ClaimRelationship{},
			views:         map[string]int{},
		}
	}
	return &DB{
		mockMode:          true,
		storageMode:       "file",
		fs:                fs,
		mockMessages:      make(map[string][]*StoredMessage),
		mockUsers:         make(map[string]*User),
		mockConversations: make(map[string]*Conversation),
	}
}

func NewDB(connStr, dataDir string) (*DB, error) {
	if connStr == "" {
		fmt.Printf("WARNING: PostgreSQL connection string is empty. Entering File-backed Mode.\n")
		return newMockDB(dataDir), nil
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		fmt.Printf("WARNING: postgres connection failed (%v). Entering File-backed Mode.\n", err)
		return newMockDB(dataDir), nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		fmt.Printf("WARNING: postgres ping failed (%v). Entering File-backed Mode.\n", err)
		return newMockDB(dataDir), nil
	}

	return &DB{db: db, mockMode: false, storageMode: "postgres"}, nil
}

type Conversation struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	UserID    string `json:"userId"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type StoredMessage struct {
	ID             string        `json:"id"`
	ConversationID string        `json:"conversationId"`
	Role           string        `json:"role"`
	Content        string        `json:"content"`
	Blocks         []interface{} `json:"blocks,omitempty"`
	ToolCalls      []interface{} `json:"tool_calls,omitempty"`
	ToolCallID     string        `json:"tool_call_id,omitempty"`
	ToolName       string        `json:"tool_name,omitempty"`
	AgentEvents    []interface{} `json:"agentEvents,omitempty"`
	CreatedAt      string        `json:"createdAt"`
}

type MemoryEntry struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

type User struct {
	ID               string    `json:"id"`
	Email            string    `json:"email"`
	Name             string    `json:"name"`
	Avatar           string    `json:"avatar"`
	Role             string    `json:"role"`
	SubscriptionTier string    `json:"subscriptionTier"`
	Onboarded        bool      `json:"onboarded"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

func randID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func maxIdx(s string, n int) int {
	if len(s) < n {
		return len(s)
	}
	return n
}

func (d *DB) FindOrCreateUserByEmail(email string) (*User, error) {
	now := time.Now().UTC()

	if d.mockMode {
		if u, ok := d.mockUsers[email]; ok {
			return u, nil
		}
		u := &User{
			ID:               randID(),
			Email:            email,
			Name:             email[:maxIdx(email, 20)],
			Avatar:           "",
			Role:             "member",
			SubscriptionTier: "free",
			Onboarded:        false,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		d.mockUsers[email] = u
		return u, nil
	}

	var u User
	err := d.db.QueryRow("SELECT id, email, name, avatar, role, subscription_tier, onboarded, created_at, updated_at FROM users WHERE email = $1", email).
		Scan(&u.ID, &u.Email, &u.Name, &u.Avatar, &u.Role, &u.SubscriptionTier, &u.Onboarded, &u.CreatedAt, &u.UpdatedAt)

	if err == sql.ErrNoRows {
		u = User{
			ID:               randID(),
			Email:            email,
			Name:             email[:maxIdx(email, 20)],
			Avatar:           "",
			Role:             "member",
			SubscriptionTier: "free",
			Onboarded:        false,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		_, err = d.db.Exec("INSERT INTO users (id, email, name, avatar, role, subscription_tier, onboarded, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
			u.ID, u.Email, u.Name, u.Avatar, u.Role, u.SubscriptionTier, u.Onboarded, u.CreatedAt, u.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("create user: %w", err)
		}
		return &u, nil
	} else if err != nil {
		return nil, fmt.Errorf("find user: %w", err)
	}

	return &u, nil
}

func (d *DB) GetUser(id string) (*User, error) {
	if d.mockMode {
		for _, u := range d.mockUsers {
			if u.ID == id {
				return u, nil
			}
		}
		return nil, nil
	}

	var u User
	err := d.db.QueryRow("SELECT id, email, name, avatar, role, subscription_tier, onboarded, created_at, updated_at FROM users WHERE id = $1", id).
		Scan(&u.ID, &u.Email, &u.Name, &u.Avatar, &u.Role, &u.SubscriptionTier, &u.Onboarded, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &u, nil
}

func (d *DB) SetUserOnboarded(id string, onboarded bool) error {
	if d.mockMode {
		if u, ok := d.mockUsers[id]; ok {
			u.Onboarded = onboarded
			u.UpdatedAt = time.Now().UTC()
		}
		return nil
	}

	_, err := d.db.Exec("UPDATE users SET onboarded = $1, updated_at = $2 WHERE id = $3", onboarded, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("set user onboarded: %w", err)
	}
	return nil
}

func (d *DB) CreateConversation(id, title, userID string) (*Conversation, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	conv := &Conversation{ID: id, Title: title, UserID: userID, CreatedAt: now, UpdatedAt: now}
	if d.mockMode {
		d.mockConversations[id] = conv
		return conv, nil
	}

	_, err := d.db.Exec("INSERT INTO conversations (id, title, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)", id, title, userID, now, now)
	if err != nil {
		return nil, fmt.Errorf("create conversation: %w", err)
	}
	return conv, nil
}

func (d *DB) ListConversations(userID string) ([]*Conversation, error) {
	if d.mockMode {
		var list []*Conversation
		for _, c := range d.mockConversations {
			if userID == "" || c.UserID == userID {
				list = append(list, c)
			}
		}
		return list, nil
	}

	var rows *sql.Rows
	var err error
	if userID != "" {
		rows, err = d.db.Query("SELECT id, title, user_id, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC", userID)
	} else {
		rows, err = d.db.Query("SELECT id, title, user_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC")
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Conversation
	for rows.Next() {
		var c Conversation
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&c.ID, &c.Title, &c.UserID, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		c.UpdatedAt = updatedAt.Format(time.RFC3339)
		list = append(list, &c)
	}
	return list, nil
}

func (d *DB) GetConversation(id string) (*Conversation, error) {
	if d.mockMode {
		return d.mockConversations[id], nil
	}

	var c Conversation
	var createdAt, updatedAt time.Time
	err := d.db.QueryRow("SELECT id, title, user_id, created_at, updated_at FROM conversations WHERE id = $1", id).
		Scan(&c.ID, &c.Title, &c.UserID, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	c.CreatedAt = createdAt.Format(time.RFC3339)
	c.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &c, nil
}

func (d *DB) UpdateConversationTitle(id, title string) error {
	if d.mockMode {
		if c, ok := d.mockConversations[id]; ok {
			c.Title = title
			c.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		}
		return nil
	}
	_, err := d.db.Exec("UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3", title, time.Now().UTC(), id)
	return err
}

func (d *DB) AddMessage(msg *StoredMessage) error {
	now := time.Now().UTC().Format(time.RFC3339)
	msg.CreatedAt = now
	if d.mockMode {
		d.mockMessages[msg.ConversationID] = append(d.mockMessages[msg.ConversationID], msg)
		return nil
	}

	blocksJson, _ := json.Marshal(msg.Blocks)
	toolCallsJson, _ := json.Marshal(msg.ToolCalls)
	agentEventsJson, _ := json.Marshal(msg.AgentEvents)

	_, err := d.db.Exec("INSERT INTO messages (id, conversation_id, role, content, blocks, tool_calls, tool_call_id, tool_name, agent_events, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
		msg.ID, msg.ConversationID, msg.Role, msg.Content, blocksJson, toolCallsJson, msg.ToolCallID, msg.ToolName, agentEventsJson, now)
	if err != nil {
		return fmt.Errorf("add message: %w", err)
	}

	_, err = d.db.Exec("UPDATE conversations SET updated_at = $1 WHERE id = $2", now, msg.ConversationID)
	return err
}

func (d *DB) GetMessages(conversationID string) ([]*StoredMessage, error) {
	if d.mockMode {
		return d.mockMessages[conversationID], nil
	}

	rows, err := d.db.Query("SELECT id, conversation_id, role, content, blocks, tool_calls, tool_call_id, tool_name, agent_events, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC", conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*StoredMessage
	for rows.Next() {
		var m StoredMessage
		var blocksJson, toolCallsJson, agentEventsJson []byte
		var createdAt time.Time
		var toolCallID, toolName sql.NullString

		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &blocksJson, &toolCallsJson, &toolCallID, &toolName, &agentEventsJson, &createdAt); err != nil {
			return nil, err
		}
		m.CreatedAt = createdAt.Format(time.RFC3339)
		if toolCallID.Valid { m.ToolCallID = toolCallID.String }
		if toolName.Valid { m.ToolName = toolName.String }

		if len(blocksJson) > 0 { json.Unmarshal(blocksJson, &m.Blocks) }
		if len(toolCallsJson) > 0 { json.Unmarshal(toolCallsJson, &m.ToolCalls) }
		if len(agentEventsJson) > 0 { json.Unmarshal(agentEventsJson, &m.AgentEvents) }

		list = append(list, &m)
	}
	return list, nil
}

func (d *DB) MemStore(key, value string, ttlSeconds ...int) error {
	if d.mockMode {
		return nil
	}
	now := time.Now().UTC()
	var expiresAt *time.Time
	if len(ttlSeconds) > 0 && ttlSeconds[0] > 0 {
		exp := now.Add(time.Duration(ttlSeconds[0]) * time.Second)
		expiresAt = &exp
	}
	_, err := d.db.Exec(`
		INSERT INTO memories (key, value, updated_at, expires_at) 
		VALUES ($1, $2, $3, $4) 
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at
	`, key, value, now, expiresAt)
	return err
}

func (d *DB) MemRecall(key string) (string, error) {
	if d.mockMode {
		return "", nil
	}
	var value string
	err := d.db.QueryRow("SELECT value FROM memories WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return value, nil
}

func (d *DB) MemDeleteExpired() (int64, error) {
	if d.mockMode {
		return 0, nil
	}
	res, err := d.db.Exec("DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < NOW()")
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func DefaultSettings() map[string]string {
	return map[string]string{
		"featured_articles": "[]",
	}
}

func (d *DB) GetSettings() (map[string]string, error) {
	out := DefaultSettings()
	if d.mockMode {
		return out, nil
	}

	rows, err := d.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, fmt.Errorf("list settings failed: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan settings failed: %w", err)
		}
		out[k] = v
	}
	return out, nil
}

func (d *DB) SaveSettings(settings map[string]string) error {
	if d.mockMode {
		return nil
	}
	now := time.Now().UTC()

	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for key, value := range settings {
		_, err := tx.Exec(`
			INSERT INTO settings (key, value, updated_at) 
			VALUES ($1, $2, $3) 
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
		`, key, value, now)
		if err != nil {
			return fmt.Errorf("save setting %q: %w", key, err)
		}
	}
	return tx.Commit()
}

func (d *DB) Close() error {
	if d.mockMode || d.db == nil {
		return nil
	}
	return d.db.Close()
}

func (d *DB) GetArticle(slug string) (*Article, error) {
	if d.mockMode {
		if d.fs != nil {
			if a, ok := d.fs.articles[slug]; ok {
				return a, nil
			}
		}
		return nil, nil
	}

	var a Article
	var blocksJson, cvJson, sectionsJson, timelineJson, categoriesJson, crossrefsJson, citationsJson, metadataJson []byte
	var idStr string

	err := d.db.QueryRow(`
		SELECT id, slug, title, abstract, blocks, confidence_vector, derived_confidence, 
		       sections, timeline, categories, crossrefs, citations, metadata, created_at, updated_at 
		FROM articles WHERE slug = $1`, slug).Scan(
		&idStr, &a.Slug, &a.Title, &a.Abstract, &blocksJson, &cvJson, &a.DerivedConfidence,
		&sectionsJson, &timelineJson, &categoriesJson, &crossrefsJson, &citationsJson, &metadataJson,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, fmt.Errorf("querying article failed: %w", err)
	}

	if len(blocksJson) > 0 { json.Unmarshal(blocksJson, &a.Blocks) }
	if len(cvJson) > 0 { json.Unmarshal(cvJson, &a.ConfidenceVector) }
	if len(sectionsJson) > 0 { json.Unmarshal(sectionsJson, &a.Sections) }
	if len(timelineJson) > 0 { json.Unmarshal(timelineJson, &a.Timeline) }
	if len(categoriesJson) > 0 { json.Unmarshal(categoriesJson, &a.Categories) }
	if len(crossrefsJson) > 0 { json.Unmarshal(crossrefsJson, &a.Crossrefs) }
	if len(citationsJson) > 0 { json.Unmarshal(citationsJson, &a.Citations) }
	if len(metadataJson) > 0 { json.Unmarshal(metadataJson, &a.Metadata) }

	return &a, nil
}

func (d *DB) SaveArticle(art *Article) error {
	if d.mockMode {
		return nil
	}

	now := time.Now().UTC()
	art.UpdatedAt = now
	if art.CreatedAt.IsZero() {
		art.CreatedAt = now
	}

	blocksJson, _ := json.Marshal(art.Blocks)
	cvJson, _ := json.Marshal(art.ConfidenceVector)
	sectionsJson, _ := json.Marshal(art.Sections)
	timelineJson, _ := json.Marshal(art.Timeline)
	categoriesJson, _ := json.Marshal(art.Categories)
	crossrefsJson, _ := json.Marshal(art.Crossrefs)
	citationsJson, _ := json.Marshal(art.Citations)
	metadataJson, _ := json.Marshal(art.Metadata)

	id := randID()

	// Using UPSERT style via ON CONFLICT (slug)
	_, err := d.db.Exec(`
		INSERT INTO articles (id, slug, title, abstract, blocks, confidence_vector, derived_confidence, 
		                      sections, timeline, categories, crossrefs, citations, metadata, created_at, updated_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
		ON CONFLICT (slug) DO UPDATE SET 
			title = EXCLUDED.title, abstract = EXCLUDED.abstract, blocks = EXCLUDED.blocks, 
			confidence_vector = EXCLUDED.confidence_vector, derived_confidence = EXCLUDED.derived_confidence,
			sections = EXCLUDED.sections, timeline = EXCLUDED.timeline, categories = EXCLUDED.categories,
			crossrefs = EXCLUDED.crossrefs, citations = EXCLUDED.citations, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at
	`, id, art.Slug, art.Title, art.Abstract, blocksJson, cvJson, art.DerivedConfidence,
	sectionsJson, timelineJson, categoriesJson, crossrefsJson, citationsJson, metadataJson, art.CreatedAt, art.UpdatedAt)

	if err != nil {
		return fmt.Errorf("saving article failed: %w", err)
	}

	// Populate graph_edges from crossrefs for graph traversal
	if len(art.Crossrefs) > 0 {
		tx, err := d.db.Begin()
		if err != nil {
			return fmt.Errorf("begin tx for graph_edges: %w", err)
		}
		// Clear existing edges for this source
		_, _ = tx.Exec("DELETE FROM graph_edges WHERE source = $1", art.Slug)
		for _, cr := range art.Crossrefs {
			_, err = tx.Exec(
				"INSERT INTO graph_edges (source, target, relationship) VALUES ($1, $2, $3) ON CONFLICT (source, target) DO UPDATE SET relationship = EXCLUDED.relationship",
				art.Slug, cr.Title, cr.Relationship,
			)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("insert graph_edge: %w", err)
			}
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit graph_edges: %w", err)
		}
	}

	return nil
}

func (d *DB) ListArticles(limit, offset int) ([]*Article, error) {
	if d.mockMode {
		if d.fs == nil {
			return []*Article{}, nil
		}
		all := d.fs.articleList
		if offset >= len(all) {
			return []*Article{}, nil
		}
		end := offset + limit
		if end > len(all) {
			end = len(all)
		}
		out := make([]*Article, 0, end-offset)
		out = append(out, all[offset:end]...)
		return out, nil
	}

	rows, err := d.db.Query(`
		SELECT slug, title, abstract, blocks, confidence_vector, derived_confidence, 
		       sections, timeline, categories, crossrefs, citations, metadata, created_at, updated_at 
		FROM articles ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list articles failed: %w", err)
	}
	defer rows.Close()

	var list []*Article
	for rows.Next() {
		var a Article
		var blocksJson, cvJson, sectionsJson, timelineJson, categoriesJson, crossrefsJson, citationsJson, metadataJson []byte

		if err := rows.Scan(
			&a.Slug, &a.Title, &a.Abstract, &blocksJson, &cvJson, &a.DerivedConfidence,
			&sectionsJson, &timelineJson, &categoriesJson, &crossrefsJson, &citationsJson, &metadataJson,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if len(blocksJson) > 0 { json.Unmarshal(blocksJson, &a.Blocks) }
		if len(cvJson) > 0 { json.Unmarshal(cvJson, &a.ConfidenceVector) }
		if len(sectionsJson) > 0 { json.Unmarshal(sectionsJson, &a.Sections) }
		if len(timelineJson) > 0 { json.Unmarshal(timelineJson, &a.Timeline) }
		if len(categoriesJson) > 0 { json.Unmarshal(categoriesJson, &a.Categories) }
		if len(crossrefsJson) > 0 { json.Unmarshal(crossrefsJson, &a.Crossrefs) }
		if len(citationsJson) > 0 { json.Unmarshal(citationsJson, &a.Citations) }
		if len(metadataJson) > 0 { json.Unmarshal(metadataJson, &a.Metadata) }
		list = append(list, &a)
	}
	return list, nil
}

func (d *DB) SearchArticles(searchQuery string, limit int) ([]*Article, error) {
	if d.mockMode {
		if d.fs == nil {
			return []*Article{}, nil
		}
		q := strings.ToLower(searchQuery)
		out := []*Article{}
		for _, a := range d.fs.articleList {
			if strings.Contains(strings.ToLower(a.Title), q) || strings.Contains(strings.ToLower(a.Abstract), q) {
				out = append(out, a)
				if len(out) >= limit {
					break
				}
			}
		}
		return out, nil
	}

	q := "%" + searchQuery + "%"
	rows, err := d.db.Query(`
		SELECT slug, title, abstract, blocks, confidence_vector, derived_confidence, 
		       sections, timeline, categories, crossrefs, citations, metadata, created_at, updated_at 
		FROM articles WHERE title ILIKE $1 OR abstract ILIKE $1 ORDER BY created_at DESC LIMIT $2`, q, limit)
	if err != nil {
		return nil, fmt.Errorf("search articles failed: %w", err)
	}
	defer rows.Close()

	var list []*Article
	for rows.Next() {
		var a Article
		var blocksJson, cvJson, sectionsJson, timelineJson, categoriesJson, crossrefsJson, citationsJson, metadataJson []byte

		if err := rows.Scan(
			&a.Slug, &a.Title, &a.Abstract, &blocksJson, &cvJson, &a.DerivedConfidence,
			&sectionsJson, &timelineJson, &categoriesJson, &crossrefsJson, &citationsJson, &metadataJson,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if len(blocksJson) > 0 { json.Unmarshal(blocksJson, &a.Blocks) }
		if len(cvJson) > 0 { json.Unmarshal(cvJson, &a.ConfidenceVector) }
		if len(sectionsJson) > 0 { json.Unmarshal(sectionsJson, &a.Sections) }
		if len(timelineJson) > 0 { json.Unmarshal(timelineJson, &a.Timeline) }
		if len(categoriesJson) > 0 { json.Unmarshal(categoriesJson, &a.Categories) }
		if len(crossrefsJson) > 0 { json.Unmarshal(crossrefsJson, &a.Crossrefs) }
		if len(citationsJson) > 0 { json.Unmarshal(citationsJson, &a.Citations) }
		if len(metadataJson) > 0 { json.Unmarshal(metadataJson, &a.Metadata) }
		list = append(list, &a)
	}
	return list, nil
}

func (d *DB) SaveJob(slug string, status string, phase string, meta map[string]interface{}) error {
	if d.mockMode {
		return nil
	}

	title := slug
	if t, ok := meta["title"].(string); ok {
		title = t
	}

	now := time.Now().UTC()
	metaJson, _ := json.Marshal(meta)

	_, err := d.db.Exec(`
		INSERT INTO jobs (slug, title, status, phase, meta, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		ON CONFLICT (slug) DO UPDATE SET
			title = EXCLUDED.title, status = EXCLUDED.status, phase = EXCLUDED.phase,
			meta = EXCLUDED.meta, updated_at = EXCLUDED.updated_at
	`, slug, title, status, phase, metaJson, now)

	if err != nil {
		return fmt.Errorf("saving job failed: %w", err)
	}
	return nil
}

func (d *DB) GetJob(slug string) (*Job, error) {
	if d.mockMode {
		return nil, nil
	}

	var j Job
	var metaJson []byte
	var created, updated time.Time

	err := d.db.QueryRow("SELECT slug, title, status, phase, meta, created_at, updated_at FROM jobs WHERE slug = $1", slug).
		Scan(&j.Slug, &j.Title, &j.Status, &j.Phase, &metaJson, &created, &updated)
	
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, fmt.Errorf("querying job failed: %w", err)
	}

	if len(metaJson) > 0 { json.Unmarshal(metaJson, &j.Meta) }
	j.CreatedAt = created.Format(time.RFC3339)
	j.UpdatedAt = updated.Format(time.RFC3339)
	return &j, nil
}

func (d *DB) ListJobsByStatus(status string) ([]*Job, error) {
	if d.mockMode {
		return nil, nil
	}

	rows, err := d.db.Query("SELECT slug, title, status, phase, meta, created_at, updated_at FROM jobs WHERE status = $1 ORDER BY created_at ASC", status)
	if err != nil {
		return nil, fmt.Errorf("list jobs by status failed: %w", err)
	}
	defer rows.Close()

	var list []*Job
	for rows.Next() {
		var j Job
		var metaJson []byte
		var created, updated time.Time
		if err := rows.Scan(&j.Slug, &j.Title, &j.Status, &j.Phase, &metaJson, &created, &updated); err != nil {
			return nil, err
		}
		if len(metaJson) > 0 { json.Unmarshal(metaJson, &j.Meta) }
		j.CreatedAt = created.Format(time.RFC3339)
		j.UpdatedAt = updated.Format(time.RFC3339)
		list = append(list, &j)
	}
	return list, nil
}

func (d *DB) TrackArticleView(slug string, ip string, event string) error {
	if d.mockMode {
		return nil
	}
	_, err := d.db.Exec("INSERT INTO article_views (slug, ip, event, created_at) VALUES ($1, $2, $3, $4)", slug, ip, event, time.Now().UTC())
	return err
}

func (d *DB) GetArticleViewCount(slug string) (int, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.views[slug], nil
		}
		return 0, nil
	}
	var count int
	err := d.db.QueryRow("SELECT COUNT(*) FROM article_views WHERE slug = $1", slug).Scan(&count)
	return count, err
}

func (d *DB) GetTopArticles(limit int) ([]*Article, error) {
	if d.mockMode {
		if d.fs == nil {
			return []*Article{}, nil
		}
		all := make([]*Article, len(d.fs.articleList))
		copy(all, d.fs.articleList)
		sort.Slice(all, func(i, j int) bool {
			return d.fs.views[all[i].Slug] > d.fs.views[all[j].Slug]
		})
		if limit > len(all) {
			limit = len(all)
		}
		if limit < 0 {
			limit = 0
		}
		return all[:limit], nil
	}
	rows, err := d.db.Query(`
		SELECT a.slug, a.title, a.abstract, a.blocks, a.confidence_vector, a.derived_confidence,
		       a.sections, a.timeline, a.categories, a.crossrefs, a.citations, a.threed_scenes, a.metadata, a.created_at, a.updated_at
		FROM articles a
		JOIN (
			SELECT slug, COUNT(*) as view_count
			FROM article_views
			GROUP BY slug
		) av ON a.slug = av.slug
		ORDER BY av.view_count DESC, a.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("get top articles failed: %w", err)
	}
	defer rows.Close()

	var list []*Article
	for rows.Next() {
		var a Article
		var blocksJson, cvJson, sectionsJson, timelineJson, categoriesJson, crossrefsJson, citationsJson, metadataJson []byte
		if err := rows.Scan(
			&a.Slug, &a.Title, &a.Abstract, &blocksJson, &cvJson, &a.DerivedConfidence,
			&sectionsJson, &timelineJson, &categoriesJson, &crossrefsJson, &citationsJson, &metadataJson,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if len(blocksJson) > 0 { json.Unmarshal(blocksJson, &a.Blocks) }
		if len(cvJson) > 0 { json.Unmarshal(cvJson, &a.ConfidenceVector) }
		if len(sectionsJson) > 0 { json.Unmarshal(sectionsJson, &a.Sections) }
		if len(timelineJson) > 0 { json.Unmarshal(timelineJson, &a.Timeline) }
		if len(categoriesJson) > 0 { json.Unmarshal(categoriesJson, &a.Categories) }
		if len(crossrefsJson) > 0 { json.Unmarshal(crossrefsJson, &a.Crossrefs) }
		if len(citationsJson) > 0 { json.Unmarshal(citationsJson, &a.Citations) }
		if len(metadataJson) > 0 { json.Unmarshal(metadataJson, &a.Metadata) }
		list = append(list, &a)
	}
	return list, nil
}

func (d *DB) GetGraphEdges(slug string) ([]*GraphEdge, error) {
	if d.mockMode {
		if d.fs == nil {
			return nil, nil
		}
		out := []*GraphEdge{}
		for _, e := range d.fs.edges {
			if e.Source == slug {
				out = append(out, e)
			}
		}
		return out, nil
	}
	rows, err := d.db.Query("SELECT source, target, relationship FROM graph_edges WHERE source = $1", slug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*GraphEdge
	for rows.Next() {
		var e GraphEdge
		if err := rows.Scan(&e.Source, &e.Target, &e.Relationship); err != nil {
			return nil, err
		}
		list = append(list, &e)
	}
	return list, nil
}

func (d *DB) GetBacklinks(slug string) ([]*GraphEdge, error) {
	if d.mockMode {
		if d.fs != nil {
			return d.fs.backlinks[slug], nil
		}
		return nil, nil
	}
	rows, err := d.db.Query("SELECT source, target, relationship FROM graph_edges WHERE target = $1", slug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*GraphEdge
	for rows.Next() {
		var e GraphEdge
		if err := rows.Scan(&e.Source, &e.Target, &e.Relationship); err != nil {
			return nil, err
		}
		list = append(list, &e)
	}
	return list, nil
}

func (d *DB) GetMap(slug string) (*MapEntry, error) {
	if d.mockMode {
		return nil, nil
	}

	var m MapEntry
	var clat, clng sql.NullFloat64
	var geoJson, markersJson []byte
	var created, updated time.Time

	err := d.db.QueryRow(`
		SELECT slug, title, subtitle, description, content, image, region, era, type, external_url, 
		       center_lat, center_lng, zoom, geo_json, markers, created_at, updated_at 
		FROM maps WHERE slug = $1`, slug).Scan(
		&m.Slug, &m.Title, &m.Subtitle, &m.Description, &m.Content, &m.Image, &m.Region, &m.Era, &m.Type, &m.ExternalUrl,
		&clat, &clng, &m.Zoom, &geoJson, &markersJson, &created, &updated,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	if clat.Valid { m.CenterLat = &clat.Float64 }
	if clng.Valid { m.CenterLng = &clng.Float64 }
	if len(geoJson) > 0 { json.Unmarshal(geoJson, &m.GeoJson) }
	if len(markersJson) > 0 { json.Unmarshal(markersJson, &m.Markers) }

	m.CreatedAt = created.Format(time.RFC3339)
	m.UpdatedAt = updated.Format(time.RFC3339)

	return &m, nil
}

func (d *DB) GetMaps(limit, offset int) ([]*MapEntry, []*MapEntry, error) {
	if d.mockMode {
		return nil, nil, nil
	}

	rows, err := d.db.Query(`
		SELECT slug, title, subtitle, description, content, image, region, era, type, external_url, 
		       center_lat, center_lng, zoom, geo_json, markers, created_at, updated_at 
		FROM maps LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var staticMaps []*MapEntry
	var interactiveMaps []*MapEntry

	for rows.Next() {
		var m MapEntry
		var clat, clng sql.NullFloat64
		var geoJson, markersJson []byte
		var created, updated time.Time
		if err := rows.Scan(
			&m.Slug, &m.Title, &m.Subtitle, &m.Description, &m.Content, &m.Image, &m.Region, &m.Era, &m.Type, &m.ExternalUrl,
			&clat, &clng, &m.Zoom, &geoJson, &markersJson, &created, &updated,
		); err != nil {
			return nil, nil, err
		}

		if clat.Valid { m.CenterLat = &clat.Float64 }
		if clng.Valid { m.CenterLng = &clng.Float64 }
		if len(geoJson) > 0 { json.Unmarshal(geoJson, &m.GeoJson) }
		if len(markersJson) > 0 { json.Unmarshal(markersJson, &m.Markers) }

		m.CreatedAt = created.Format(time.RFC3339)
		m.UpdatedAt = updated.Format(time.RFC3339)

		if m.Type == "interactive" {
			interactiveMaps = append(interactiveMaps, &m)
		} else {
			staticMaps = append(staticMaps, &m)
		}
	}
	return staticMaps, interactiveMaps, nil
}

func (d *DB) SearchMaps(searchQuery string, limit int) ([]*MapEntry, error) {
	if d.mockMode {
		return nil, nil
	}

	q := "%" + searchQuery + "%"
	rows, err := d.db.Query(`
		SELECT slug, title, subtitle, description, content, image, region, era, type, external_url, 
		       center_lat, center_lng, zoom, geo_json, markers, created_at, updated_at 
		FROM maps 
		WHERE title ILIKE $1 OR subtitle ILIKE $1 OR description ILIKE $1 OR region ILIKE $1 OR era ILIKE $1 
		ORDER BY created_at DESC LIMIT $2`, q, limit)
	if err != nil {
		return nil, fmt.Errorf("search maps failed: %w", err)
	}
	defer rows.Close()

	var list []*MapEntry
	for rows.Next() {
		var m MapEntry
		var clat, clng sql.NullFloat64
		var geoJson, markersJson []byte
		var created, updated time.Time
		if err := rows.Scan(
			&m.Slug, &m.Title, &m.Subtitle, &m.Description, &m.Content, &m.Image, &m.Region, &m.Era, &m.Type, &m.ExternalUrl,
			&clat, &clng, &m.Zoom, &geoJson, &markersJson, &created, &updated,
		); err != nil {
			return nil, err
		}

		if clat.Valid { m.CenterLat = &clat.Float64 }
		if clng.Valid { m.CenterLng = &clng.Float64 }
		if len(geoJson) > 0 { json.Unmarshal(geoJson, &m.GeoJson) }
		if len(markersJson) > 0 { json.Unmarshal(markersJson, &m.Markers) }

		m.CreatedAt = created.Format(time.RFC3339)
		m.UpdatedAt = updated.Format(time.RFC3339)
		list = append(list, &m)
	}
	return list, nil
}

// ────────────────────────────────────────────────────────────
// Epistemic Pipeline Storage Methods
// ────────────────────────────────────────────────────────────

func (d *DB) SaveEpistemicPipeline(data *EpistemicPipelineData) error {
	if d.mockMode {
		return nil
	}
	if data == nil {
		return nil
	}

	tx, err := d.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// 1. Save Claims
	for _, c := range data.Claims {
		cvJson, _ := json.Marshal(c.ConfidenceVector)
		_, err = tx.Exec(`
			INSERT INTO claims (id, text, type, status, confidence_vector, derived_confidence, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				text = EXCLUDED.text, type = EXCLUDED.type, status = EXCLUDED.status,
				confidence_vector = EXCLUDED.confidence_vector, derived_confidence = EXCLUDED.derived_confidence,
				updated_at = EXCLUDED.updated_at
		`, c.ID, c.Text, c.Type, c.Status, cvJson, c.DerivedConfidence, c.CreatedAt, c.UpdatedAt)
		if err != nil {
			return fmt.Errorf("save claim %s: %w", c.ID, err)
		}
	}

	// 2. Save Sources
	for _, s := range data.Sources {
		cvJson, _ := json.Marshal(s.CredibilityVector)
		_, err = tx.Exec(`
			INSERT INTO sources (id, name, type, credibility_vector, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name, type = EXCLUDED.type, credibility_vector = EXCLUDED.credibility_vector
		`, s.ID, s.Name, s.Type, cvJson, s.CreatedAt)
		if err != nil {
			return fmt.Errorf("save source %s: %w", s.ID, err)
		}
	}

	// 3. Save Evidence
	for _, e := range data.Evidence {
		var sourceID interface{}
		if e.SourceID != nil {
			sourceID = *e.SourceID
		}
		_, err = tx.Exec(`
			INSERT INTO evidence (id, claim_id, type, url, chain_of_custody, acquisition_method, accessibility, supports_claim, source_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (id) DO UPDATE SET
				claim_id = EXCLUDED.claim_id, type = EXCLUDED.type, url = EXCLUDED.url,
				chain_of_custody = EXCLUDED.chain_of_custody, acquisition_method = EXCLUDED.acquisition_method,
				accessibility = EXCLUDED.accessibility, supports_claim = EXCLUDED.supports_claim, source_id = EXCLUDED.source_id
		`, e.ID, e.ClaimID, e.Type, e.URL, e.ChainOfCustody, e.AcquisitionMethod, e.Accessibility, e.SupportsClaim, sourceID, e.CreatedAt)
		if err != nil {
			return fmt.Errorf("save evidence %s: %w", e.ID, err)
		}
	}

	// 4. Save Evidence Gaps
	for _, g := range data.Gaps {
		emJson, _ := json.Marshal(g.ExternalMetadata)
		_, err = tx.Exec(`
			INSERT INTO evidence_gaps (id, claim_id, gap_type, expected_artifact, verification_status, external_metadata, cause_label, cause_confidence, detected_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (id) DO UPDATE SET
				claim_id = EXCLUDED.claim_id, gap_type = EXCLUDED.gap_type, expected_artifact = EXCLUDED.expected_artifact,
				verification_status = EXCLUDED.verification_status, external_metadata = EXCLUDED.external_metadata,
				cause_label = EXCLUDED.cause_label, cause_confidence = EXCLUDED.cause_confidence
		`, g.ID, g.ClaimID, g.GapType, g.ExpectedArtifact, g.VerificationStatus, emJson, g.CauseLabel, g.CauseConfidence, g.DetectedAt)
		if err != nil {
			return fmt.Errorf("save evidence gap %s: %w", g.ID, err)
		}
	}

	// 5. Save Language Flags
	for _, lf := range data.LangFlags {
		_, err = tx.Exec(`
			INSERT INTO language_flags (id, claim_id, source_phrase, precision_upgrade, framing_origin, framing_function, confidence, detected_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				claim_id = EXCLUDED.claim_id, source_phrase = EXCLUDED.source_phrase,
				precision_upgrade = EXCLUDED.precision_upgrade, framing_origin = EXCLUDED.framing_origin,
				framing_function = EXCLUDED.framing_function, confidence = EXCLUDED.confidence
		`, lf.ID, lf.ClaimID, lf.SourcePhrase, lf.PrecisionUpgrade, lf.FramingOrigin, lf.FramingFunction, lf.Confidence, lf.DetectedAt)
		if err != nil {
			return fmt.Errorf("save language flag %s: %w", lf.ID, err)
		}
	}

	// 6. Save Scrutiny Assessments
	for _, s := range data.Scrutinies {
		rfJson, _ := json.Marshal(s.RiskFactors)
		arJson, _ := json.Marshal(s.ActionRequired)
		_, err = tx.Exec(`
			INSERT INTO scrutiny_assessments (id, claim_id, risk_factors, risk_score, action_required, assessed_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (id) DO UPDATE SET
				claim_id = EXCLUDED.claim_id, risk_factors = EXCLUDED.risk_factors,
				risk_score = EXCLUDED.risk_score, action_required = EXCLUDED.action_required
		`, s.ID, s.ClaimID, rfJson, s.RiskScore, arJson, s.AssessedAt)
		if err != nil {
			return fmt.Errorf("save scrutiny %s: %w", s.ID, err)
		}
	}

	// 7. Save Article-Claim junctions
	for _, ac := range data.ArticleClaims {
		_, err = tx.Exec(`
			INSERT INTO article_claims (article_id, claim_id)
			VALUES ($1, $2)
			ON CONFLICT (article_id, claim_id) DO NOTHING
		`, ac.ArticleID, ac.ClaimID)
		if err != nil {
			return fmt.Errorf("save article_claim %s-%s: %w", ac.ArticleID, ac.ClaimID, err)
		}
	}

	return tx.Commit()
}

func (d *DB) GetEpistemicPipelineForArticle(articleID string) (*EpistemicPipelineData, error) {
	if d.mockMode {
		return &EpistemicPipelineData{}, nil
	}

	data := &EpistemicPipelineData{}

	// Get article-claim links
	rows, err := d.db.Query("SELECT claim_id FROM article_claims WHERE article_id = $1", articleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var claimIDs []string
	for rows.Next() {
		var cid string
		if err := rows.Scan(&cid); err != nil {
			return nil, err
		}
		claimIDs = append(claimIDs, cid)
	}
	if len(claimIDs) == 0 {
		return data, nil
	}

	// Build placeholders for IN clause
	placeholders := make([]string, len(claimIDs))
	args := make([]interface{}, len(claimIDs))
	for i, id := range claimIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	inClause := strings.Join(placeholders, ",")

	// Get Claims
	rows, err = d.db.Query(fmt.Sprintf("SELECT id, text, type, status, confidence_vector, derived_confidence, created_at, updated_at FROM claims WHERE id IN (%s)", inClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c Claim
		var cvJson []byte
		if err := rows.Scan(&c.ID, &c.Text, &c.Type, &c.Status, &cvJson, &c.DerivedConfidence, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		if len(cvJson) > 0 { json.Unmarshal(cvJson, &c.ConfidenceVector) }
		data.Claims = append(data.Claims, c)
	}

	// Get Evidence for these claims
	rows, err = d.db.Query(fmt.Sprintf("SELECT id, claim_id, type, url, chain_of_custody, acquisition_method, accessibility, supports_claim, source_id, created_at FROM evidence WHERE claim_id IN (%s)", inClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var e Evidence
		var sourceID sql.NullString
		if err := rows.Scan(&e.ID, &e.ClaimID, &e.Type, &e.URL, &e.ChainOfCustody, &e.AcquisitionMethod, &e.Accessibility, &e.SupportsClaim, &sourceID, &e.CreatedAt); err != nil {
			return nil, err
		}
		if sourceID.Valid { e.SourceID = &sourceID.String }
		data.Evidence = append(data.Evidence, e)
	}

	// Get Evidence Gaps
	rows, err = d.db.Query(fmt.Sprintf("SELECT id, claim_id, gap_type, expected_artifact, verification_status, external_metadata, cause_label, cause_confidence, detected_at FROM evidence_gaps WHERE claim_id IN (%s)", inClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var g EvidenceGap
		var emJson []byte
		if err := rows.Scan(&g.ID, &g.ClaimID, &g.GapType, &g.ExpectedArtifact, &g.VerificationStatus, &emJson, &g.CauseLabel, &g.CauseConfidence, &g.DetectedAt); err != nil {
			return nil, err
		}
		if len(emJson) > 0 { json.Unmarshal(emJson, &g.ExternalMetadata) }
		data.Gaps = append(data.Gaps, g)
	}

	// Get Language Flags
	rows, err = d.db.Query(fmt.Sprintf("SELECT id, claim_id, source_phrase, precision_upgrade, framing_origin, framing_function, confidence, detected_at FROM language_flags WHERE claim_id IN (%s)", inClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var lf LanguageFlag
		if err := rows.Scan(&lf.ID, &lf.ClaimID, &lf.SourcePhrase, &lf.PrecisionUpgrade, &lf.FramingOrigin, &lf.FramingFunction, &lf.Confidence, &lf.DetectedAt); err != nil {
			return nil, err
		}
		data.LangFlags = append(data.LangFlags, lf)
	}

	// Get Scrutiny Assessments
	rows, err = d.db.Query(fmt.Sprintf("SELECT id, claim_id, risk_factors, risk_score, action_required, assessed_at FROM scrutiny_assessments WHERE claim_id IN (%s)", inClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s ScrutinyAssessment
		var rfJson, arJson []byte
		if err := rows.Scan(&s.ID, &s.ClaimID, &rfJson, &s.RiskScore, &arJson, &s.AssessedAt); err != nil {
			return nil, err
		}
		if len(rfJson) > 0 { json.Unmarshal(rfJson, &s.RiskFactors) }
		if len(arJson) > 0 { json.Unmarshal(arJson, &s.ActionRequired) }
		data.Scrutinies = append(data.Scrutinies, s)
	}

	// Get Sources referenced by evidence
	sourceIDs := make(map[string]bool)
	for _, e := range data.Evidence {
		if e.SourceID != nil {
			sourceIDs[*e.SourceID] = true
		}
	}
	if len(sourceIDs) > 0 {
		srcIDs := make([]string, 0, len(sourceIDs))
		for id := range sourceIDs {
			srcIDs = append(srcIDs, id)
		}
		srcPlaceholders := make([]string, len(srcIDs))
		srcArgs := make([]interface{}, len(srcIDs))
		for i, id := range srcIDs {
			srcPlaceholders[i] = fmt.Sprintf("$%d", i+1)
			srcArgs[i] = id
		}
		srcInClause := strings.Join(srcPlaceholders, ",")
		rows, err = d.db.Query(fmt.Sprintf("SELECT id, name, type, credibility_vector, created_at FROM sources WHERE id IN (%s)", srcInClause), srcArgs...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var s Source
			var cvJson []byte
			if err := rows.Scan(&s.ID, &s.Name, &s.Type, &cvJson, &s.CreatedAt); err != nil {
				return nil, err
			}
			if len(cvJson) > 0 { json.Unmarshal(cvJson, &s.CredibilityVector) }
			data.Sources = append(data.Sources, s)
		}
	}

	return data, nil
}

func (d *DB) IsMockMode() bool {
	return d.mockMode
}
