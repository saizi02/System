-- Smart inventory: an automatic stock movement log and optional expiry dates.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date date;

CREATE TABLE IF NOT EXISTS stock_movements (
  id bigserial PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  variant_id text NOT NULL,
  delta integer NOT NULL,
  quantity_after integer NOT NULL,
  reason text NOT NULL,
  ref text NOT NULL DEFAULT '',
  actor_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_branch ON stock_movements(business_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_item ON stock_movements(product_id, variant_id, created_at DESC);

-- Every change to inventory.quantity is logged here, so no code path can forget to record it.
-- The application tags the reason, reference and actor with set_config() inside its transaction.
CREATE OR REPLACE FUNCTION log_stock_movement() RETURNS trigger AS $$
DECLARE
  d integer;
  r text;
  a uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN d := NEW.quantity; ELSE d := NEW.quantity - OLD.quantity; END IF;
  IF d = 0 THEN RETURN NEW; END IF;
  r := NULLIF(current_setting('app.stock_reason', true), '');
  IF r IS NULL THEN r := CASE WHEN TG_OP = 'INSERT' THEN 'opening' ELSE 'adjustment' END; END IF;
  BEGIN
    a := NULLIF(current_setting('app.stock_actor', true), '')::uuid;
  EXCEPTION WHEN others THEN
    a := NULL;
  END;
  INSERT INTO stock_movements(business_id, branch_id, product_id, variant_id, delta, quantity_after, reason, ref, actor_id)
  VALUES (NEW.business_id, NEW.branch_id, NEW.product_id, NEW.variant_id, d, NEW.quantity, r,
          COALESCE(NULLIF(current_setting('app.stock_ref', true), ''), ''), a);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_movement_log ON inventory;
CREATE TRIGGER inventory_movement_log
  AFTER INSERT OR UPDATE OF quantity ON inventory
  FOR EACH ROW EXECUTE FUNCTION log_stock_movement();
