-- S19: persist executor gateway audit trail (was log.Printf only).
CREATE TABLE IF NOT EXISTS executor_audit (
    id SERIAL PRIMARY KEY,
    connector_slug TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    risk TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_executor_audit_user ON executor_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executor_audit_connector ON executor_audit(connector_slug, created_at DESC);
