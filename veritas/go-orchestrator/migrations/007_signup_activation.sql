ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated BOOLEAN NOT NULL DEFAULT FALSE;
-- Pre-activation accounts proved their inbox via OTP: grandfather them in.
UPDATE users SET activated = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
