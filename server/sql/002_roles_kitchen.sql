-- 002: Kitchen role, richer staff records and faster activity-log queries.
-- Replace the original role CHECK constraint (whatever it was named) with one that also allows 'kitchen'.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'staff'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE staff DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('super_admin','business_admin','cashier','kitchen'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE INDEX IF NOT EXISTS staff_business ON staff(business_id);
CREATE INDEX IF NOT EXISTS audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_business_created ON audit_logs(business_id, created_at DESC);
