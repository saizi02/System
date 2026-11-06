CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, password_hash text NOT NULL,
  role text NOT NULL CHECK(role IN ('super_admin','business_admin','cashier')),
  business_id uuid, branch_id uuid, disabled boolean NOT NULL DEFAULT false,
  must_change_password boolean NOT NULL DEFAULT false, display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid REFERENCES staff(id) ON DELETE CASCADE, guest_id uuid NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  profile text NOT NULL CHECK(profile IN ('grocery','food','clothing')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  domain text NOT NULL DEFAULT '', currency text NOT NULL DEFAULT 'USD',
  rates jsonb NOT NULL DEFAULT '{"USD":1,"ZIG":1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, category text NOT NULL, price_cents integer NOT NULL CHECK(price_cents>=0),
  barcode text NOT NULL DEFAULT '', image text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  variants jsonb NOT NULL DEFAULT '[{"id":"default","name":"Standard"}]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_business ON products(business_id);
CREATE TABLE IF NOT EXISTS inventory (
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id text NOT NULL, quantity integer NOT NULL DEFAULT 0 CHECK(quantity>=0),
  low_stock integer NOT NULL DEFAULT 5, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id,branch_id,product_id,variant_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id), customer_uid uuid NOT NULL,
  idempotency_key text NOT NULL,
  items jsonb NOT NULL, total_cents integer NOT NULL, currency text NOT NULL,
  rate numeric(18,6) NOT NULL, total_minor integer NOT NULL, method text NOT NULL,
  payment_simulated boolean NOT NULL DEFAULT true, payment_outcome text NOT NULL,
  service_type text, order_note text NOT NULL DEFAULT '',
  status text NOT NULL CHECK(status IN ('pending_cash','paid','failed','cancelled')),
  fulfillment text NOT NULL DEFAULT 'new', source text NOT NULL,
  exit_verified boolean NOT NULL DEFAULT false,
  reprints integer NOT NULL DEFAULT 0, handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_uid,idempotency_key)
);
CREATE INDEX IF NOT EXISTS orders_business_branch ON orders(business_id,branch_id,created_at DESC);
CREATE TABLE IF NOT EXISTS cart_transfers (
  code text PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id), branch_id uuid NOT NULL REFERENCES branches(id),
  owner_uid uuid NOT NULL, items jsonb NOT NULL, consumed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shopping_sessions (
  id text PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id), branch_id uuid NOT NULL REFERENCES branches(id),
  customer_uid uuid NOT NULL, items jsonb NOT NULL DEFAULT '[]', count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'shopping', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id), order_id uuid NOT NULL REFERENCES orders(id),
  type text NOT NULL, detected_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, actor_id uuid, action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
