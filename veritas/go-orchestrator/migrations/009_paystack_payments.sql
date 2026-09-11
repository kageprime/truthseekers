-- Paystack billing (F3): payment intent ledger + tier entitlements.
-- reference is Paystack's idempotency key: UNIQUE doubles as the
-- double-spend/double-webhook guard.
CREATE TABLE IF NOT EXISTS paystack_payments (
    reference TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    tier TEXT NOT NULL,
    amount INT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_paystack_payments_user ON paystack_payments(user_id, created_at DESC);
