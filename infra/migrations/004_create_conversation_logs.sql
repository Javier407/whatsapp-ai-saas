-- Migration 004: conversation_logs table
-- =========================================================

CREATE TABLE conversation_logs (
  id           BIGSERIAL   PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  wa_id        TEXT        NOT NULL,
  direction    TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT        NOT NULL,
  content      JSONB       NOT NULL,
  flow_id      UUID        REFERENCES flows (id) ON DELETE SET NULL,
  node_key     TEXT,
  llm_tokens   INTEGER,
  latency_ms   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_logs_tenant_wa_time
  ON conversation_logs (tenant_id, wa_id, created_at DESC);

CREATE INDEX idx_conv_logs_tenant_time
  ON conversation_logs (tenant_id, created_at DESC);
