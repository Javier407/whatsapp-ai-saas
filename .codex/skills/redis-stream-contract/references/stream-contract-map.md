# Redis Stream Contract Map

## Streams

| Stream | Producer | Consumer | Schema |
|---|---|---|---|
| `flow-engine:{tenant_id}` | gateway | flow-engine | `infra/contracts/flow-engine-message.schema.json` |
| `indexing:{tenant_id}` | tenant-api | rag-indexer | `infra/contracts/indexing-job.schema.json` |

## Hot files

- `services/gateway/src/infrastructure/redis/RedisMessageQueue.ts` — flow-engine stream producer
- `services/tenant-api/src/infrastructure/redis/RedisIndexingQueue.ts` — indexing stream producer
- `services/flow-engine/flow_engine/interfaces/consumer.py` — flow-engine consumer
- `services/rag-indexer/rag_indexer/consumer.py` — indexing consumer
- `infra/contracts/*.schema.json` — authoritative envelopes

## Compatibility rules (one agreed shape)

- **Add field** → optional in schema; consumer tolerates absence; promote to required only after all consumers ship.
- **Rename field** → add new (optional) + keep old for one deploy cycle; consumer reads `new ?? old`; remove old only after consumers stop reading it.
- **Remove field** → deprecate first (keep publishing), consumer stops reading, then remove from producer.
- **Change type** → treat as remove + add. Never change a field's type in place.

## Invariants

- Collection naming `tenant_{tenant_id.replace('-', '')}` must match across rag-indexer and flow-engine.
- Both Python consumers must `_decode_fields` (bytes → str) before reading fields.
- ACK policy: malformed messages ACK (no infinite requeue); transient dependency failures do NOT ACK.
- `access_token` never travels in the stream — flow-engine resolves and decrypts it from Postgres.

## Output format

- `CRITICAL`: breaks the runtime path or can lose/duplicate messages.
- `WARNING`: risky compatibility gap, missing test, or unclear ACK boundary.
- `SUGGESTION`: schema/docs alignment.

For each finding: producer, consumer, schema, the exact field mismatch, the minimal compatible change, and the test that proves it.
