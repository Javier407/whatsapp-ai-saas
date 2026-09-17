-- Migration 006: add meta column to flow_nodes
-- =========================================================
-- `meta` holds UI-only presentation state (node canvas positions) for the
-- visual flow builder. It is intentionally kept separate from `config`, which
-- is the runtime contract validated per node type by the flow-engine.
-- The flow-engine MUST ignore `meta` entirely — it never affects how a message
-- is processed. Mixing presentation into `config` would break the hexagonal
-- boundary (config is domain, position is presentation).
--
-- RLS: flow_nodes already enforces tenant isolation via its tenant_id column
-- and the tenant_isolation policy (migration 005). No new policy is needed.
--
-- Online-safe: additive column, NOT NULL with a constant DEFAULT, so existing
-- rows backfill to '{}' without a full table rewrite on PostgreSQL 11+.
--
-- Rollback: ALTER TABLE flow_nodes DROP COLUMN meta;
-- =========================================================

ALTER TABLE flow_nodes
  ADD COLUMN meta JSONB NOT NULL DEFAULT '{}'::jsonb;
