# WhatsApp AI SaaS Contract Map

## Inbound WhatsApp path

Expected path:

1. Meta Cloud API sends `entry[].changes[].value` to `gateway`.
2. `gateway` verifies HMAC and verify token.
3. `gateway` resolves tenant by `value.metadata.phone_number_id`.
4. `gateway` publishes to Redis Stream `flow-engine:{tenant_id}`.
5. `flow-engine` parses the stream message, loads session/flow, sends replies through Meta.

Hot files:

- `services/gateway/src/interfaces/http/webhookRoutes.ts`
- `services/gateway/src/application/ProcessWebhookUseCase.ts`
- `services/gateway/src/infrastructure/redis/RedisMessageQueue.ts`
- `infra/contracts/flow-engine-message.schema.json`
- `services/flow-engine/flow_engine/interfaces/consumer.py`
- `services/flow-engine/flow_engine/domain/models.py`
- `services/flow-engine/flow_engine/infrastructure/meta/meta_send_client.py`

Known hotspot:

- If gateway publishes a Redis field named `data` containing JSON, then flow-engine must parse `fields["data"]` before building `InboundMessage`.
- If flow-engine expects flat Redis fields, gateway must publish those exact fields and the schema must match that format.
- `access_token` should not be trusted from webhook input. Prefer loading encrypted tenant token from Postgres and decrypting inside flow-engine, or pass a short-lived internal credential through a controlled service boundary.

## KB indexing path

Expected path:

1. `tenant-api` uploads file to MinIO and creates KB document row.
2. `tenant-api` publishes indexing job to `indexing:{tenant_id}`.
3. `rag-indexer` consumes job, extracts text, chunks, embeds, writes ChromaDB, updates status.

Hot files:

- `services/tenant-api/src/infrastructure/redis/RedisIndexingQueue.ts`
- `infra/contracts/indexing-job.schema.json`
- `services/rag-indexer/rag_indexer/consumer.py`
- `services/rag-indexer/rag_indexer/domain/models.py`
- `services/rag-indexer/rag_indexer/application/index_document.py`

## Review output format

Return findings as:

- `CRITICAL`: breaks the runtime path or can lose data/messages.
- `WARNING`: risky behavior, incomplete tests, unclear retry/security boundary.
- `SUGGESTION`: cleanup or docs alignment.

For each finding include: producer, consumer, expected contract, actual mismatch, minimal fix, and test to prove it.
