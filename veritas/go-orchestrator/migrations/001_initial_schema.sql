-- +goose Up
-- PostgreSQL schema for VERITAS — AI Truth Encyclopedia System (Ported & Upgraded)

-- 1. Claims table (central unit of truth)
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY,
    text TEXT NOT NULL,
    type TEXT CHECK (type IN ('factual', 'interpretive', 'predictive')),
    status TEXT CHECK (status IN ('supported', 'disputed', 'weak', 'unknown')),
    confidence_vector JSONB,
    derived_confidence FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Sources table
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('institutional', 'individual', 'anonymous', 'leaked_material')),
    credibility_vector JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Evidence table
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('primary_document', 'eyewitness', 'expert_analysis', 'leaked', 'patent', 'dataset', 'anonymous')),
    url TEXT,
    chain_of_custody TEXT CHECK (chain_of_custody IN ('verified', 'partial', 'unverified')),
    acquisition_method TEXT,
    accessibility TEXT CHECK (accessibility IN ('public', 'restricted', 'classified', 'destroyed')),
    supports_claim BOOLEAN,
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL
);

-- 4. Articles table
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    abstract TEXT,
    content TEXT,
    blocks JSONB,
    confidence_vector JSONB,
    derived_confidence FLOAT,
    version INT DEFAULT 1,
    sections JSONB,
    timeline JSONB,
    categories JSONB,
    crossrefs JSONB,
    citations JSONB,
    metadata JSONB,
    status TEXT CHECK (status IN ('draft', 'published', 'error')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Article-Claim junction
CREATE TABLE IF NOT EXISTS article_claims (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, claim_id)
);

-- 6. Gap detection log
CREATE TABLE IF NOT EXISTS evidence_gaps (
    id UUID PRIMARY KEY,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    gap_type TEXT,
    expected_artifact TEXT,
    verification_status TEXT,
    external_metadata JSONB,
    cause_label TEXT,
    cause_confidence FLOAT,
    detected_at TIMESTAMP DEFAULT NOW()
);

-- 7. Language flag log
CREATE TABLE IF NOT EXISTS language_flags (
    id UUID PRIMARY KEY,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    source_phrase TEXT,
    precision_upgrade TEXT,
    framing_origin TEXT,
    confidence FLOAT,
    detected_at TIMESTAMP DEFAULT NOW()
);

-- 8. Scrutiny log
CREATE TABLE IF NOT EXISTS scrutiny_assessments (
    id UUID PRIMARY KEY,
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    risk_factors JSONB,
    risk_score FLOAT,
    action_required JSONB,
    assessed_at TIMESTAMP DEFAULT NOW()
);

-- 9. Graph edges
CREATE TABLE IF NOT EXISTS graph_edges (
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    relationship TEXT DEFAULT 'related',
    PRIMARY KEY (source, target)
);

-- 10. Map Entries
CREATE TABLE IF NOT EXISTS maps (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT NOT NULL,
    content TEXT DEFAULT '',
    image TEXT,
    region TEXT,
    era TEXT,
    type TEXT CHECK (type IN ('static', 'interactive')) NOT NULL,
    external_url TEXT,
    center_lat FLOAT,
    center_lng FLOAT,
    zoom INT DEFAULT 5,
    geo_json JSONB,
    markers JSONB DEFAULT '[]'::jsonb,
    layers JSONB DEFAULT '[]'::jsonb,
    timeline JSONB DEFAULT '[]'::jsonb,
    threed_scene JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. Article View counts
CREATE TABLE IF NOT EXISTS article_views (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL,
    event TEXT DEFAULT 'view',
    ip TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_views_slug ON article_views(slug);
CREATE INDEX IF NOT EXISTS idx_article_views_created ON article_views(created_at DESC);

-- 12. Job Queue Status
CREATE TABLE IF NOT EXISTS jobs (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT CHECK (status IN ('queued', 'researching', 'writing', 'outlining', 'verifying', 'correcting', 'media', 'images', 'storing', 'done', 'error', 'paused')) NOT NULL,
    phase TEXT DEFAULT 'pending',
    error TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 13. System Memories
CREATE TABLE IF NOT EXISTS memories (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at) WHERE expires_at IS NOT NULL;

-- 14. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT DEFAULT '',
    role TEXT DEFAULT 'member',
    subscription_tier TEXT DEFAULT 'free',
    onboarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 15. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    user_id TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

-- 16. Messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT DEFAULT '',
    blocks JSONB,
    tool_calls JSONB,
    tool_call_id TEXT DEFAULT '',
    tool_name TEXT DEFAULT '',
    agent_events JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);

-- 17. Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 18. Additional indexes
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_article_views_slug_count ON article_views(slug);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

-- +goose Down
DROP TABLE IF EXISTS settings, messages, conversations, users, memories, jobs, article_views, maps, graph_edges, scrutiny_assessments, language_flags, evidence_gaps, article_claims, articles, evidence, sources, claims CASCADE;
