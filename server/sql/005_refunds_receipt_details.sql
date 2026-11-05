ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_footer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate >= 0 AND vat_rate <= 100);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS adjustment_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adjusted_by uuid,
  ADD COLUMN IF NOT EXISTS adjusted_at timestamptz;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_cash','paid','failed','cancelled','refunded','voided'));
