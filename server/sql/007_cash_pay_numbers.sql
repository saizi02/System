ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pay_number text,
  ADD COLUMN IF NOT EXISTS pay_day date;

CREATE TABLE IF NOT EXISTS cash_pay_number_counters (
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  business_day date NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, branch_id, business_day)
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_branch_day_pay_number
  ON orders(business_id, branch_id, pay_day, pay_number)
  WHERE pay_number IS NOT NULL;
