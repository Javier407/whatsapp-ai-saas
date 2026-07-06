-- Migration 008: dedicated RLS-enforced runtime role
-- =========================================================
-- SECURITY FIX. The bootstrap user (POSTGRES_USER=app_user) is a SUPERUSER, and
-- superusers bypass Row Level Security unconditionally — so despite RLS being
-- enabled + forced on every tenant table, connecting as app_user at runtime
-- provided NO tenant isolation.
--
-- This creates `app_rls`: a LOGIN role that is NOSUPERUSER + NOBYPASSRLS, so RLS
-- policies actually apply to it. Runtime services connect as app_rls; migrations
-- keep using app_user (owner/superuser). The role reuses POSTGRES_PASSWORD for
-- now (passed in as :db_password); giving it its own secret is a later hardening.
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    CREATE ROLE app_rls LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

-- Enforce the non-privileged attributes even if the role already existed, and
-- (re)set the password from the psql variable (never hard-coded in the file).
ALTER ROLE app_rls WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
  PASSWORD :'db_password';

-- Runtime privileges: read/write data, no DDL. RLS still scopes every row.
GRANT USAGE ON SCHEMA public TO app_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;

-- Future tables/sequences created by the migrator (app_user) must also be
-- reachable by app_rls without re-granting each time.
ALTER DEFAULT PRIVILEGES FOR ROLE app_user IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;
ALTER DEFAULT PRIVILEGES FOR ROLE app_user IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_rls;
