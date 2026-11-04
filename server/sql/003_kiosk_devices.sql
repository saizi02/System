-- 003: registered kiosk devices (tablets / POS terminals running the dedicated kiosk app).
CREATE TABLE IF NOT EXISTS kiosk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  pairing_hash text,                       -- sha256 of the one-time pairing code (never stored in clear)
  pairing_expires timestamptz,
  token_hash text UNIQUE,                  -- sha256 of the device token held by the paired tablet
  paired_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,   -- false = maintenance mode: the kiosk shows "out of service"
  state text NOT NULL DEFAULT 'offline',   -- idle | shopping | checkout (reported by the device)
  last_seen timestamptz,
  user_agent text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);
CREATE INDEX IF NOT EXISTS kiosk_business ON kiosk_devices(business_id);
-- Orders remember which kiosk they came from, so the Cashier knows where a waiting cash customer is standing.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kiosk_device_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kiosk_name text;
