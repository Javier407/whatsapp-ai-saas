-- Migration 001: tenants and users tables
-- =========================================================

-- Enable pgcrypto for gen_random_uuid() and encrypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- TENANTS
-- =========================================================
CREATE TABLE tenants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL UNIQUE,
  waba_id         TEXT,
  phone_number_id TEXT        UNIQUE,
  access_token    TEXT,
  plan            TEXT        NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free', 'pro', 'enterprise')),
  status          TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'offboarded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_phone_number_id
  ON tenants (phone_number_id)
  WHERE phone_number_id IS NOT NULL;

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'admin'
                CHECK (role IN ('owner', 'admin', 'viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users (tenant_id);
