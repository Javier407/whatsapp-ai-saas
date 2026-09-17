-- Migration 007: appointments + customers tables
-- =========================================================
-- These tables already exist in the pilot database (created manually during
-- dogfooding), so this migration formalizes them idempotently: a fresh
-- database gets the tables, the pilot database is left untouched.

CREATE TABLE IF NOT EXISTS customers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  wa_id      TEXT        NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index (not an inline constraint) so it also lands on the pre-existing
-- pilot table; required by the ON CONFLICT upsert in the appointment repo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_tenant_wa
  ON customers (tenant_id, wa_id);

CREATE TABLE IF NOT EXISTS appointments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  wa_id            TEXT        NOT NULL,
  customer_name    TEXT,
  service          TEXT,
  appointment_date TEXT,
  status           TEXT        NOT NULL DEFAULT 'pendiente',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_time
  ON appointments (tenant_id, created_at DESC);

-- RLS (idempotent): same tenant_isolation policy as the other tenant tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON customers
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON appointments
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;
