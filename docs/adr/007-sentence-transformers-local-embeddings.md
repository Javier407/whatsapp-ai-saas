# ADR-007: sentence-transformers Local Embeddings as Default

**Status:** Accepted
**Date:** 2026-05-17

## Context

Embeddings are called per chunk on indexing and per query on every LLM fallback invocation. OpenAI embeddings cost money and add network latency; local embeddings are free but have lower quality on some domains.

## Decision

Default embedder is `sentence-transformers/all-MiniLM-L6-v2` running on CPU inside `rag-indexer` and `flow-engine`. The `EmbedderPort` interface allows a per-tenant override to OpenAI `text-embedding-3-small` (gated by plan tier).

## Consequences

- Zero marginal cost for embedding during development and for free-tier tenants.
- ~30ms per embedding on CPU; acceptable for MVP throughput.
- Model loaded once per process (~80MB RAM); accounted for in the service footprint table (flow-engine: 600MB, rag-indexer: 800MB).
- Quality is "good enough" for FAQ-style knowledge bases; tenants with technical or multilingual content can upgrade to OpenAI embeddings via plan tier.

## Alternatives Rejected

- **OpenAI by default:** adds an external network call and API cost to every flow execution and every test message during development.
- **Larger local models (bge-large):** 1.3GB RAM per process; does not fit within the MVP service footprint on an 8GB VPS.

## Production Note: Meta Tech Provider Path

For true multi-tenant production deployment (each business client with their own WhatsApp number), Meta requires Tech Provider status. The Embedded Signup endpoint is already stubbed in `tenant-api` at `POST /api/v1/tenant/whatsapp/embedded-signup`. The process:

1. Apply at [developers.facebook.com/docs/whatsapp/embedded-signup](https://developers.facebook.com/docs/whatsapp/embedded-signup).
2. Meta review typically takes 1–4 weeks.
3. Once approved, implement the OAuth exchange in `ConnectWhatsAppUseCase.ts` (currently stubbed).
4. Enable the Embedded Signup UI in the dashboard frontend.

MVP operates with a single sandbox WABA. All tenant isolation is fully implemented at the application layer (PostgreSQL RLS, Redis key namespacing, ChromaDB per-collection), so enabling real multi-tenancy requires only the Embedded Signup endpoint implementation — no architectural changes.
