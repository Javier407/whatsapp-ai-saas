# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the WhatsApp AI SaaS Platform. Each ADR documents a significant architectural choice, its context, rationale, and trade-offs.

| # | Title | Status |
|---|---|---|
| [ADR-001](001-redis-streams-over-rabbitmq.md) | Redis Streams over RabbitMQ | Accepted |
| [ADR-002](002-chromadb-over-pgvector.md) | ChromaDB over pgvector for MVP | Accepted |
| [ADR-003](003-langchain-llm-orchestration.md) | LangChain as LLM Orchestration Layer | Accepted |
| [ADR-004](004-fastify-over-express.md) | Fastify over Express for Node.js Services | Accepted |
| [ADR-005](005-hexagonal-architecture.md) | Hexagonal Architecture in All Services | Accepted |
| [ADR-006](006-jwt-hs256-for-mvp-auth.md) | JWT HS256 for MVP Auth | Accepted |
| [ADR-007](007-sentence-transformers-local-embeddings.md) | sentence-transformers Local Embeddings as Default | Accepted |

## Format

Each ADR follows this template:

```
# ADR-NNN: Title

**Status:** Accepted | Superseded | Deprecated
**Date:** YYYY-MM-DD

## Context
Why this decision was needed.

## Decision
What was decided.

## Consequences
What this means going forward (positives and trade-offs).

## Alternatives Rejected
What was considered and why it was not chosen.
```

## Adding a New ADR

Copy the template above, use the next sequential number, and add a row to this index table.
