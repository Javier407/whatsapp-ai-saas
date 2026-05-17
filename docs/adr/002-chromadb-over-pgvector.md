# ADR-002: ChromaDB over pgvector for MVP

**Status:** Accepted
**Date:** 2026-05-17

## Context

The vector store needs per-tenant isolation, low operational cost, and a clear migration path if a tenant outgrows it.

## Decision

ChromaDB 0.5 as a sidecar HTTP service, with **one collection per tenant** (`kb_{tenant_id_no_hyphens}`).

## Consequences

- Hard namespace isolation — cross-tenant query is architecturally impossible (Chroma does not support cross-collection search).
- Operational footprint: single container, file-backed persistence, no schema migrations.
- Migration path: a per-tenant collection can be exported and re-imported into Qdrant when a tenant exceeds ~500K chunks, without affecting other tenants.
- Tradeoff accepted: ChromaDB is single-process; HA requires a replication strategy at scale (not MVP).

## Alternatives Rejected

- **pgvector:** would share the Postgres connection pool and IO with OLTP traffic; harder to isolate per-tenant resources; recall is acceptable but HNSW parameter tuning is more involved.
- **Qdrant:** better at scale but overkill for MVP; more operational config (collections, shards, replicas).
- **Pinecone / managed:** cost per tenant + external dependency for a portfolio project.
