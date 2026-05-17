-- Migration 005: Enable Row Level Security on all tenant-scoped tables
-- =========================================================
-- All policies use current_setting('app.tenant_id', true) which is set
-- per-transaction by tenant-api via SET LOCAL app.tenant_id = <uuid>.
-- The second argument (true) suppresses the error when the GUC is not set,
-- returning NULL instead — this causes the policy to deny access, which is
-- the safe default.
-- =========================================================

-- USERS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- FLOWS
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON flows
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- FLOW NODES
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON flow_nodes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- KNOWLEDGE BASE DOCUMENTS
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON knowledge_base_documents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- CONVERSATION LOGS
ALTER TABLE conversation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversation_logs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- =========================================================
-- NOTE: tenants and worker_heartbeats are NOT tenant-scoped:
--   tenants   — platform-level table; access controlled at application layer
--   worker_heartbeats — internal monitoring; no tenant_id column
-- =========================================================
