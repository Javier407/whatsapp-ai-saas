-- Migration 002: flows and flow_nodes tables
-- =========================================================

-- =========================================================
-- FLOWS
-- =========================================================
CREATE TABLE flows (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  trigger     JSONB       NOT NULL,
  entry_node  TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT false,
  version     INTEGER     NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, version)
);

CREATE INDEX idx_flows_tenant_active
  ON flows (tenant_id)
  WHERE is_active = true;

-- =========================================================
-- FLOW NODES
-- =========================================================
CREATE TABLE flow_nodes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id     UUID        NOT NULL REFERENCES flows (id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  node_key    TEXT        NOT NULL,
  type        TEXT        NOT NULL
              CHECK (type IN (
                'message', 'interactive', 'collect_input',
                'condition', 'rag_lookup', 'llm_generate',
                'api_call', 'end'
              )),
  config      JSONB       NOT NULL,
  transitions JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, node_key)
);

CREATE INDEX idx_flow_nodes_flow ON flow_nodes (flow_id);
