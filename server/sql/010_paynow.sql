-- Paynow (Zimbabwe) payments: orders can wait for a customer to approve a payment on their phone or on Paynow's page.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_cash','awaiting_payment','paid','failed','cancelled','refunded','voided'));
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS poll_url text,
  ADD COLUMN IF NOT EXISTS browser_url text,
  ADD COLUMN IF NOT EXISTS payment_instructions text,
  ADD COLUMN IF NOT EXISTS payment_phone text,
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_awaiting_payment ON orders(created_at) WHERE status = 'awaiting_payment';
