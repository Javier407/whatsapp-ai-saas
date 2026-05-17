-- Migration 003: knowledge_base_documents and worker_heartbeats tables
-- =========================================================

-- =========================================================
-- KNOWLEDGE BASE DOCUMENTS
-- =========================================================
CREATE TABLE knowledge_base_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  source_type   TEXT        NOT NULL
                CHECK (source_type IN ('text', 'pdf', 'faq_json', 'markdown')),
  storage_uri   TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'indexing', 'indexed', 'failed')),
  chunk_count   INTEGER,
  error_message TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  indexed_at    TIMESTAMPTZ
);

CREATE INDEX idx_kb_docs_tenant_status
  ON knowledge_base_documents (tenant_id, status);

-- =========================================================
-- WORKER HEARTBEATS
-- =========================================================
CREATE TABLE worker_heartbeats (
  worker_name  TEXT        PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL,
  metadata     JSONB
);
