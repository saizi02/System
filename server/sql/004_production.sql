-- Production hardening: idle tracking for admin sessions, payment references, sales-report indexes.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;
CREATE INDEX IF NOT EXISTS orders_branch_created ON orders(business_id,branch_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
