---
name: redis-stream-contract
description: Enforce backward-compatible evolution of Redis Stream schemas. Use when adding, renaming, or removing fields in flow-engine or indexing streams, or when updating infra/contracts/*.schema.json.
---

# Redis Stream Contract

Use this skill whenever a Redis Stream field changes — production consumers can't tolerate silent schema breaks.

## Workflow

1. Identify which stream is changing: `flow-engine:{tenant_id}` or `indexing:{tenant_id}`.
2. Read the authoritative schema: `infra/contracts/flow-engine-message.schema.json` or `infra/contracts/indexing-job.schema.json`.
3. Read the producer (gateway or tenant-api) and consumer (flow-engine or rag-indexer) together before changing anything.
4. Apply the compatibility rule below.
5. Update producer, consumer, schema, and tests in one atomic work unit.
6. Never leave schema and code out of sync — the schema is authoritative only when tests validate both sides.

## Compatibility Rules

**Adding a field:**
- Mark it `optional` in the JSON schema.
- Consumer must tolerate absence (provide a default or skip gracefully).
- Producer may omit it during rollout.
- Only promote to `required` after all consumers are deployed.

**Renaming a field:**
- Treat as: add new field (optional) + deprecate old field.
- Keep the old field for at least one full deploy cycle.
- Consumer reads new field with fallback to old: `new_field ?? old_field`.
- Remove old field only after confirming no consumer depends on it.

**Removing a field:**
- First deprecate: mark `deprecated: true` in the schema comment, keep publishing it.
- Consumer stops reading it.
- Remove from producer only after all consumers are deployed and verified.

**Changing a field type:**
- Treat as removal + addition. Never change type in place.

## Critical Invariants

- Both services must agree on the collection naming scheme: `tenant_{tenant_id.replace('-', '')}`. Any stream field carrying tenant context must use the same normalization.
- `_decode_fields` (bytes → str) must be applied before any field access in both Python consumers. Validate this in every consumer change.
- ACK policy: malformed messages ACK to prevent infinite requeue. Transient dependency failures must NOT ACK — verify this explicitly when changing error handling in consumers.

## Validation Checklist

Before marking a stream contract change complete:
- [ ] JSON schema updated and valid
- [ ] Producer updated
- [ ] Consumer updated (with fallback if field is new/optional)
- [ ] Unit test covers the new shape (both producer serialization and consumer parsing)
- [ ] Integration test or E2E covers the full path if the change is high-risk
- [ ] No other service silently depends on the removed/renamed field

## Useful Files

- `infra/contracts/flow-engine-message.schema.json` — inbound message contract
- `infra/contracts/indexing-job.schema.json` — KB indexing job contract
- `services/gateway/src/` — flow-engine stream producer
- `services/tenant-api/src/infrastructure/redis/RedisIndexingQueue.ts` — indexing stream producer
- `services/flow-engine/flow_engine/interfaces/consumer.py` — flow-engine consumer
- `services/rag-indexer/rag_indexer/consumer.py` — indexing consumer
