# ADR-001: Redis Streams over RabbitMQ

**Status:** Accepted
**Date:** 2026-05-17

## Context

The platform needs an async, ordered, multi-consumer message bus between `gateway → flow-engine` and `tenant-api → rag-indexer`. Redis is already required for session storage and tenant routing cache. Adding a second broker (RabbitMQ, NATS, Kafka) would double the operational surface for a solo-builder MVP.

## Decision

Use Redis Streams with consumer groups. One stream per tenant (`flow-engine:{tenant_id}`, `indexing:{tenant_id}`), one consumer group per worker type (`flow-engine-workers`, `rag-indexer-workers`). Streams are capped via `MAXLEN ~` to bound memory.

## Consequences

- Single infra dependency for queue + cache + sessions.
- At-least-once delivery via `XREADGROUP` + `XACK`. Idempotency is enforced in the consumer via `processed:{message_id}` keys (5-minute TTL, SET NX).
- In-flight messages survive process restart because of the consumer-group pending entries list (PEL).
- Risk: if Redis crashes without AOF flush, the last <1s of XADDs may be lost. Mitigated by WhatsApp's 7-day webhook retry — Meta will redeliver.
- Per-tenant streams enable per-tenant lag observability and future per-tenant scaling.

## Alternatives Rejected

- **RabbitMQ:** adds a second daemon, needs separate auth/ACL, no shared infra benefit, overkill for MVP throughput.
- **Kafka:** operationally heavy; partition design needed; no value at MVP scale.
- **In-process queue:** breaks horizontal scaling and crashes lose all in-flight work.
