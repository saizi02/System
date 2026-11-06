DO $$
DECLARE role_constraint record;
BEGIN
  FOR role_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'staff'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE staff DROP CONSTRAINT %I', role_constraint.conname);
  END LOOP;
END $$;

ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('super_admin','business_admin','cashier','kitchen','exit_verifier'));
