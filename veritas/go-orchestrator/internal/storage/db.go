package storage

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"crypto/rand"
)

// Core models matching packages/core/src/types.ts

type MediaItem struct {
	Type    string `json:"type" bson:"type"`
	ID      string `json:"id,omitempty" bson:"id,omitempty"`
	Caption string `json:"caption,omitempty" bson:"caption,omitempty"`
	Src     string `json:"src,omitempty" bson:"src,omitempty"`
	Source  string `json:"source,omitempty" bson:"source,omitempty"`
	Code    string `json:"code,omitempty" bson:"code,omitempty"`
	Prompt  string `json:"prompt,omitempty" bson:"prompt,omitempty"`
}

type Section struct {
	ID      string      `json:"id" bson:"id"`
	Title   string      `json:"title" bson:"title"`
	Content string      `json:"content" bson:"content"`
	Media   []MediaItem `json:"media,omitempty" bson:"media,omitempty"`
}

type TimelineEvent struct {
	ID          string   `json:"id,omitempty" bson:"id,omitempty"`
	Year        float64  `json:"year" bson:"year"` // Mixed in TS (can be float or string)
	Event       string   `json:"event" bson:"event"`
	Description string   `json:"description,omitempty" bson:"description,omitempty"`
	Image       string   `json:"image,omitempty" bson:"image,omitempty"`
	Causes      []string `json:"causes,omitempty" bson:"causes,omitempty"`
	Category    string   `json:"category,omitempty" bson:"category,omitempty"`
}

type CrossReference struct {
	ID           string `json:"id" bson:"id"`
	Title        string `json:"title" bson:"title"`
	Relationship string `json:"relationship" bson:"relationship"`
}

type Citation struct {
	URL       string `json:"url" bson:"url"`
	Title     string `json:"title,omitempty" bson:"title,omitempty"`
	Accessed  string `json:"accessed,omitempty" bson:"accessed,omitempty"`
	Relevance string `json:"relevance,omitempty" bson:"relevance,omitempty"`
}

type ThreeDScene struct {
	ID          string `json:"id" bson:"id"`
	Code        string `json:"code" bson:"code"`
	Description string `json:"description" bson:"description"`
}

type ArticleMetadata struct {
	Version     int    `json:"version" bson:"version"`
	Created     string `json:"created" bson:"created"`
	Updated     string `json:"updated" bson:"updated"`
	Status      string `json:"status" bson:"status"` // draft | published | error
	Freshness   string `json:"freshness,omitempty" bson:"freshness,omitempty"`
	GeneratedBy string `json:"generatedBy,omitempty" bson:"generatedBy,omitempty"`
}

type Article struct {
	ID                primitive.ObjectID     `json:"-" bson:"_id,omitempty"`
	Slug              string                 `json:"slug" bson:"slug"`
	Title             string                 `json:"title" bson:"title"`
	Abstract          string                 `json:"abstract" bson:"abstract"`
	Sections          []Section              `json:"sections" bson:"sections"`
	Timeline          []TimelineEvent        `json:"timeline" bson:"timeline"`
	Categories        []string               `json:"categories" bson:"categories"`
	Crossrefs         []CrossReference       `json:"crossrefs" bson:"crossrefs"`
	Citations         []Citation             `json:"citations" bson:"citations"`
	ThreedScenes      []ThreeDScene          `json:"threedScenes" bson:"threedScenes"`
	Blocks            []interface{}          `json:"blocks,omitempty" bson:"blocks,omitempty"`
	ConfidenceVector  map[string]interface{} `json:"confidence_vector,omitempty" bson:"confidence_vector,omitempty"`
	DerivedConfidence float64                `json:"derived_confidence" bson:"derived_confidence"`
	Metadata          ArticleMetadata        `json:"metadata" bson:"metadata"`
	CreatedAt         time.Time              `json:"created_at,omitempty" bson:"created_at,omitempty"`
	UpdatedAt         time.Time              `json:"updated_at,omitempty" bson:"updated_at,omitempty"`
}

type GraphEdge struct {
	Source       string `json:"source" bson:"source"`
	Target       string `json:"target" bson:"target"`
	Relationship string `json:"relationship" bson:"relationship"`
}

type MapEntry struct {
	Slug        string        `json:"slug" bson:"slug"`
	Title       string        `json:"title" bson:"title"`
	Subtitle    string        `json:"subtitle,omitempty" bson:"subtitle,omitempty"`
	Description string        `json:"description" bson:"description"`
	Content     string        `json:"content" bson:"content"`
	Image       string        `json:"image,omitempty" bson:"image,omitempty"`
	Region      string        `json:"region,omitempty" bson:"region,omitempty"`
	Era         string        `json:"era,omitempty" bson:"era,omitempty"`
	Type        string        `json:"type" bson:"type"` // static | interactive
	ExternalUrl string        `json:"externalUrl,omitempty" bson:"externalUrl,omitempty"`
	CenterLat   *float64      `json:"centerLat,omitempty" bson:"centerLat,omitempty"`
	CenterLng   *float64      `json:"centerLng,omitempty" bson:"centerLng,omitempty"`
	Zoom        int           `json:"zoom" bson:"zoom"`
	GeoJson     interface{}   `json:"geoJson,omitempty" bson:"geoJson,omitempty"`
	Markers     []interface{} `json:"markers,omitempty" bson:"markers,omitempty"`
	Layers      []interface{} `json:"layers,omitempty" bson:"layers,omitempty"`
	Timeline    []interface{} `json:"timeline,omitempty" bson:"timeline,omitempty"`
	ThreedScene interface{}   `json:"threedScene,omitempty" bson:"threedScene,omitempty"`
	CreatedAt   string        `json:"createdAt" bson:"createdAt"`
	UpdatedAt   string        `json:"updatedAt" bson:"updatedAt"`
}

type Job struct {
	Slug      string      `json:"slug" bson:"slug"`
	Title     string      `json:"title" bson:"title"`
	Status    string      `json:"status" bson:"status"`
	Phase     string      `json:"phase" bson:"phase"`
	Error     string      `json:"error,omitempty" bson:"error,omitempty"`
	Meta      interface{} `json:"meta,omitempty" bson:"meta,omitempty"`
	CreatedAt string      `json:"createdAt" bson:"createdAt"`
	UpdatedAt string      `json:"updatedAt" bson:"updatedAt"`
}

type DB struct {
	client       *mongo.Client
	db           *mongo.Database
	mockMode     bool
	mockMessages map[string][]*StoredMessage
	mockUsers    map[string]*User
	mockConversations map[string]*Conversation
}

func NewDB(connStr string) (*DB, error) {
	if connStr == "" {
		fmt.Printf("WARNING: MongoDB connection string is empty. Entering Mock Mode.\n")
		return &DB{mockMode: true, mockMessages: make(map[string][]*StoredMessage), mockUsers: make(map[string]*User), mockConversations: make(map[string]*Conversation)}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(connStr))
	if err != nil {
		fmt.Printf("WARNING: mongo connection failed (%v). Entering Mock Mode.\n", err)
		return &DB{mockMode: true}, nil
	}

	if err := client.Ping(ctx, nil); err != nil {
		fmt.Printf("WARNING: mongo ping failed (%v). Entering Mock Mode.\n", err)
		return &DB{mockMode: true}, nil
	}

	// Based on Mongoose default or typical Next.js config without db in URI
	database := client.Database("test") 

	return &DB{client: client, db: database, mockMode: false}, nil
}

type Conversation struct {
	ID        string `bson:"id" json:"id"`
	Title     string `bson:"title" json:"title"`
	UserID    string `bson:"userId" json:"userId"`
	CreatedAt string `bson:"createdAt" json:"createdAt"`
	UpdatedAt string `bson:"updatedAt" json:"updatedAt"`
}

type StoredMessage struct {
	ID             string          `bson:"id" json:"id"`
	ConversationID string          `bson:"conversationId" json:"conversationId"`
	Role           string          `bson:"role" json:"role"`
	Content        string          `bson:"content" json:"content"`
	Blocks         []interface{}   `bson:"blocks,omitempty" json:"blocks,omitempty"`
	ToolCalls      []interface{}   `bson:"tool_calls,omitempty" json:"tool_calls,omitempty"`
	ToolCallID     string          `bson:"tool_call_id,omitempty" json:"tool_call_id,omitempty"`
	ToolName       string          `bson:"tool_name,omitempty" json:"tool_name,omitempty"`
	AgentEvents    []interface{}   `bson:"agentEvents,omitempty" json:"agentEvents,omitempty"`
	CreatedAt      string          `bson:"createdAt" json:"createdAt"`
}

type MemoryEntry struct {
	Key       string `bson:"key" json:"key"`
	Value     string `bson:"value" json:"value"`
	UpdatedAt string `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

type User struct {
	ID               string    `bson:"id" json:"id"`
	Email            string    `bson:"email" json:"email"`
	Name             string    `bson:"name" json:"name"`
	Avatar           string    `bson:"avatar" json:"avatar"`
	SubscriptionTier string    `bson:"subscriptionTier" json:"subscriptionTier"`
	Onboarded        bool      `bson:"onboarded" json:"onboarded"`
	CreatedAt        time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time `bson:"updatedAt" json:"updatedAt"`
}

func randID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
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
			SubscriptionTier: "free",
			Onboarded:        false,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		d.mockUsers[email] = u
		return u, nil
	}

	ctx := context.Background()
	var u User
	err := d.db.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&u)
	if err == nil {
		return &u, nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, fmt.Errorf("find user: %w", err)
	}

	u = User{
		ID:               randID(),
		Email:            email,
		Name:             email[:maxIdx(email, 20)],
		Avatar:           "",
		SubscriptionTier: "free",
		Onboarded:        false,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	_, err = d.db.Collection("users").InsertOne(ctx, u)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
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
	err := d.db.Collection("users").FindOne(context.Background(), bson.M{"id": id}).Decode(&u)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &u, nil
}

// SetUserOnboarded flips the onboarding flag for a user. Used by
// handleAuthOnboard so the frontend's post-onboard /auth/me reflects the
// change instead of still reporting onboarded:false.
func (d *DB) SetUserOnboarded(id string, onboarded bool) error {
	if d.mockMode {
		if u, ok := d.mockUsers[id]; ok {
			u.Onboarded = onboarded
			u.UpdatedAt = time.Now().UTC()
		}
		return nil
	}

	_, err := d.db.Collection("users").UpdateOne(
		context.Background(),
		bson.M{"id": id},
		bson.M{"$set": bson.M{"onboarded": onboarded, "updatedAt": time.Now().UTC()}},
	)
	if err != nil {
		return fmt.Errorf("set user onboarded: %w", err)
	}
	return nil
}

func maxIdx(s string, n int) int {
	if len(s) < n {
		return len(s)
	}
	return n
}

func (d *DB) CreateConversation(id, title, userID string) (*Conversation, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	conv := &Conversation{ID: id, Title: title, UserID: userID, CreatedAt: now, UpdatedAt: now}
	if d.mockMode {
		d.mockConversations[id] = conv
		return conv, nil
	}
	_, err := d.db.Collection("conversations").InsertOne(context.Background(), conv)
	if err != nil {
		return nil, fmt.Errorf("create conversation: %w", err)
	}
	return conv, nil
}

func (d *DB) ListConversations(userID string) ([]*Conversation, error) {
	if d.mockMode {
		var list []*Conversation
		for _, c := range d.mockConversations {
			if c.UserID == userID {
				list = append(list, c)
			}
		}
		return list, nil
	}
	filter := bson.M{}
	if userID != "" {
		filter["userId"] = userID
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := d.db.Collection("conversations").Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []*Conversation
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) GetConversation(id string) (*Conversation, error) {
	if d.mockMode {
		return d.mockConversations[id], nil
	}
	var conv Conversation
	err := d.db.Collection("conversations").FindOne(context.Background(), bson.M{"id": id}).Decode(&conv)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

func (d *DB) UpdateConversationTitle(id, title string) error {
	if d.mockMode {
		if c, ok := d.mockConversations[id]; ok {
			c.Title = title
		}
		return nil
	}
	_, err := d.db.Collection("conversations").UpdateOne(context.Background(), bson.M{"id": id}, bson.M{"$set": bson.M{"title": title}})
	return err
}

func (d *DB) AddMessage(msg *StoredMessage) error {
	now := time.Now().UTC().Format(time.RFC3339)
	msg.CreatedAt = now
	if d.mockMode {
		d.mockMessages[msg.ConversationID] = append(d.mockMessages[msg.ConversationID], msg)
		return nil
	}
	_, err := d.db.Collection("messages").InsertOne(context.Background(), msg)
	if err != nil {
		return fmt.Errorf("add message: %w", err)
	}
	_, err = d.db.Collection("conversations").UpdateOne(context.Background(), bson.M{"id": msg.ConversationID}, bson.M{"$set": bson.M{"updatedAt": now}})
	return err
}

func (d *DB) GetMessages(conversationID string) ([]*StoredMessage, error) {
	if d.mockMode {
		return d.mockMessages[conversationID], nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := d.db.Collection("messages").Find(ctx, bson.M{"conversationId": conversationID}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []*StoredMessage
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) MemStore(key, value string) error {
	if d.mockMode {
		return nil
	}
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := d.db.Collection("memory").UpdateOne(
		context.Background(),
		bson.M{"key": key},
		bson.M{"$set": bson.M{"key": key, "value": value, "updatedAt": now}},
		options.Update().SetUpsert(true),
	)
	return err
}

func (d *DB) MemRecall(key string) (string, error) {
	if d.mockMode {
		return "", nil
	}
	var entry MemoryEntry
	err := d.db.Collection("memory").FindOne(context.Background(), bson.M{"key": key}).Decode(&entry)
	if err == mongo.ErrNoDocuments {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return entry.Value, nil
}

// SiteSettings is a simple key/value store for admin-configurable values
// (e.g. `featured_articles`, a JSON-encoded array of slugs). The frontend's
// `GET /admin/settings` returns the whole map merged over defaults; `PUT`
// accepts `{ "settings": { key: value, ... } }` and upserts each key.
type SiteSetting struct {
	Key       string `bson:"key" json:"key"`
	Value     string `bson:"value" json:"value"`
	UpdatedAt string `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

// DefaultSettings seeds the values the frontend relies on when nothing is set.
func DefaultSettings() map[string]string {
	return map[string]string{
		"featured_articles": "[]",
	}
}

// GetSettings returns all stored settings merged over defaults.
func (d *DB) GetSettings() (map[string]string, error) {
	out := DefaultSettings()
	if d.mockMode {
		return out, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := d.db.Collection("settings").Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("list settings failed: %w", err)
	}
	defer cursor.Close(ctx)

	var entries []SiteSetting
	if err := cursor.All(ctx, &entries); err != nil {
		return nil, fmt.Errorf("scan settings failed: %w", err)
	}
	for _, e := range entries {
		out[e.Key] = e.Value
	}
	return out, nil
}

// SaveSettings upserts each key/value pair.
func (d *DB) SaveSettings(settings map[string]string) error {
	if d.mockMode {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now().UTC().Format(time.RFC3339)
	for key, value := range settings {
		_, err := d.db.Collection("settings").UpdateOne(
			ctx,
			bson.M{"key": key},
			bson.M{"$set": bson.M{"key": key, "value": value, "updatedAt": now}},
			options.Update().SetUpsert(true),
		)
		if err != nil {
			return fmt.Errorf("save setting %q: %w", key, err)
		}
	}
	return nil
}

func (d *DB) Close() error {
	if d.mockMode || d.client == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return d.client.Disconnect(ctx)
}

func (d *DB) GetArticle(slug string) (*Article, error) {
	if d.mockMode {
		return &Article{
			Slug:              slug,
			Title:             "Mock Article",
			Abstract:          "This is a mock article because the database is offline.",
			Metadata:          ArticleMetadata{Status: "published"},
			DerivedConfidence: 0.95,
			Blocks:            []interface{}{map[string]interface{}{"id": "h1", "type": "heading", "data": map[string]interface{}{"level": 1, "text": "Mock Article"}}},
		}, nil
	}

	var art Article
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := d.db.Collection("articles").FindOne(ctx, bson.M{"slug": slug}).Decode(&art)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	} else if err != nil {
		return nil, fmt.Errorf("querying article failed: %w", err)
	}

	return &art, nil
}

func (d *DB) SaveArticle(art *Article) error {
	if d.mockMode {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	art.UpdatedAt = time.Now()
	if art.CreatedAt.IsZero() {
		art.CreatedAt = time.Now()
	}

	opts := options.Update().SetUpsert(true)
	update := bson.M{
		"$set": art,
	}

	_, err := d.db.Collection("articles").UpdateOne(ctx, bson.M{"slug": art.Slug}, update, opts)
	if err != nil {
		return fmt.Errorf("saving article failed: %w", err)
	}
	return nil
}

func (d *DB) ListArticles(limit, offset int) ([]*Article, error) {
	if d.mockMode {
		return []*Article{
			{Slug: "mock-article-1", Title: "The Apollo 11 Moon Landing", Abstract: "A mock historical analysis.", DerivedConfidence: 0.99, Metadata: ArticleMetadata{Status: "published", Created: time.Now().Format(time.RFC3339)}},
			{Slug: "mock-article-2", Title: "The JFK Assassination", Abstract: "Mock epistemic evaluation.", DerivedConfidence: 0.85, Metadata: ArticleMetadata{Status: "published", Created: time.Now().Format(time.RFC3339)}},
		}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := d.db.Collection("articles").Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, fmt.Errorf("list articles failed: %w", err)
	}
	defer cursor.Close(ctx)

	// Decode one document at a time rather than cursor.All: the collection
	// holds legacy documents from the old Mongoose/TS backend whose field
	// shapes (e.g. year as string, confidence_vector as nested array) don't
	// fit the strict Go struct. cursor.All fails the WHOLE list if even one
	// document won't decode, which surfaced as a 500 on /articles. We instead
	// skip the un-decodable docs and log them, so one bad record can't take
	// down the listing endpoint.
	var list []*Article
	for cursor.Next(ctx) {
		var art Article
		if err := cursor.Decode(&art); err != nil {
			fmt.Printf("WARNING: skipping undecodable article document: %v\n", err)
			continue
		}
		list = append(list, &art)
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("scanning listed article failed: %w", err)
	}
	return list, nil
}

func (d *DB) SearchArticles(searchQuery string, limit int) ([]*Article, error) {
	if d.mockMode {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use regex for partial search
	filter := bson.M{
		"$or": []bson.M{
			{"title": primitive.Regex{Pattern: searchQuery, Options: "i"}},
			{"abstract": primitive.Regex{Pattern: searchQuery, Options: "i"}},
		},
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(int64(limit))
	
	cursor, err := d.db.Collection("articles").Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("search articles failed: %w", err)
	}
	defer cursor.Close(ctx)

	// Decode one document at a time; skip legacy docs that don't fit the struct
	// (see ListArticles for rationale).
	var list []*Article
	for cursor.Next(ctx) {
		var art Article
		if err := cursor.Decode(&art); err != nil {
			fmt.Printf("WARNING: skipping undecodable article document in search: %v\n", err)
			continue
		}
		list = append(list, &art)
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("scanning searched article failed: %w", err)
	}
	return list, nil
}

func (d *DB) SaveJob(slug string, status string, phase string, meta map[string]interface{}) error {
	if d.mockMode {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	title := slug
	if t, ok := meta["title"].(string); ok {
		title = t
	}

	opts := options.Update().SetUpsert(true)
	update := bson.M{
		"$set": bson.M{
			"slug":       slug,
			"title":      title,
			"status":     status,
			"phase":      phase,
			"meta":       meta,
			"updatedAt":  time.Now().Format(time.RFC3339),
		},
		"$setOnInsert": bson.M{
			"createdAt": time.Now().Format(time.RFC3339),
		},
	}

	_, err := d.db.Collection("jobs").UpdateOne(ctx, bson.M{"slug": slug}, update, opts)
	if err != nil {
		return fmt.Errorf("saving job failed: %w", err)
	}
	return nil
}

func (d *DB) GetJob(slug string) (*Job, error) {
	if d.mockMode {
		return nil, nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var job Job
	err := d.db.Collection("jobs").FindOne(ctx, bson.M{"slug": slug}).Decode(&job)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	} else if err != nil {
		return nil, fmt.Errorf("querying job failed: %w", err)
	}
	return &job, nil
}

// ListJobsByStatus returns jobs in a given status (e.g. "queued", "writing").
// Used by the generation worker pool to restore in-flight jobs on boot.
func (d *DB) ListJobsByStatus(status string) ([]*Job, error) {
	if d.mockMode {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := d.db.Collection("jobs").Find(ctx, bson.M{"status": status}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		return nil, fmt.Errorf("list jobs by status failed: %w", err)
	}
	defer cursor.Close(ctx)

	var list []*Job
	if err = cursor.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("scanning jobs failed: %w", err)
	}
	return list, nil
}

func (d *DB) TrackArticleView(slug string, ip string, event string) error {
	if d.mockMode {
		return nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	doc := bson.M{
		"slug":      slug,
		"event":     event,
		"ip":        ip,
		"createdAt": time.Now(),
	}
	_, err := d.db.Collection("articleviews").InsertOne(ctx, doc)
	return err
}

func (d *DB) GetArticleViewCount(slug string) (int, error) {
	if d.mockMode {
		return 42, nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	count, err := d.db.Collection("articleviews").CountDocuments(ctx, bson.M{"slug": slug})
	return int(count), err
}

func (d *DB) GetTopArticles(limit int) ([]*Article, error) {
	if d.mockMode {
		return d.ListArticles(limit, 0)
	}

	// Using standard list for MongoDB simplification (a full aggregate view count can be done later if needed)
	return d.ListArticles(limit, 0)
}

func (d *DB) GetGraphEdges(slug string) ([]*GraphEdge, error) {
	if d.mockMode {
		return nil, nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := d.db.Collection("graphedges").Find(ctx, bson.M{"source": slug})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []*GraphEdge
	if err = cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) GetBacklinks(slug string) ([]*GraphEdge, error) {
	if d.mockMode {
		return nil, nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := d.db.Collection("graphedges").Find(ctx, bson.M{"target": slug})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []*GraphEdge
	if err = cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) GetMap(slug string) (*MapEntry, error) {
	if d.mockMode {
		return nil, nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var m MapEntry
	err := d.db.Collection("mapentries").FindOne(ctx, bson.M{"slug": slug}).Decode(&m)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &m, nil
}

func (d *DB) GetMaps(limit, offset int) ([]*MapEntry, []*MapEntry, error) {
	if d.mockMode {
		return nil, nil, nil
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := d.db.Collection("mapentries").Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, nil, err
	}
	defer cursor.Close(ctx)

	var staticMaps []*MapEntry
	var interactiveMaps []*MapEntry

	var allMaps []*MapEntry
	if err = cursor.All(ctx, &allMaps); err != nil {
		return nil, nil, err
	}

	for _, m := range allMaps {
		if m.Type == "interactive" {
			interactiveMaps = append(interactiveMaps, m)
		} else {
			staticMaps = append(staticMaps, m)
		}
	}
	return staticMaps, interactiveMaps, nil
}

func (d *DB) SearchMaps(searchQuery string, limit int) ([]*MapEntry, error) {
	if d.mockMode {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"$or": []bson.M{
			{"title": primitive.Regex{Pattern: searchQuery, Options: "i"}},
			{"subtitle": primitive.Regex{Pattern: searchQuery, Options: "i"}},
			{"description": primitive.Regex{Pattern: searchQuery, Options: "i"}},
			{"region": primitive.Regex{Pattern: searchQuery, Options: "i"}},
			{"era": primitive.Regex{Pattern: searchQuery, Options: "i"}},
		},
	}
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit))

	cursor, err := d.db.Collection("mapentries").Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("search maps failed: %w", err)
	}
	defer cursor.Close(ctx)

	var list []*MapEntry
	if err = cursor.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("scanning searched maps failed: %w", err)
	}
	return list, nil
}

// IsMockMode reports whether the database is running in mock (in-memory) mode.
// The health endpoint uses this to let operators know the storage layer has no
// real backing database.
func (d *DB) IsMockMode() bool {
	return d.mockMode
}
