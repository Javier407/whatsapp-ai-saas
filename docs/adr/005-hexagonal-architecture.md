# ADR-005: Hexagonal Architecture in All Services

**Status:** Accepted
**Date:** 2026-05-17

## Context

Five services in two languages must remain understandable, testable, and replaceable. The team must be able to swap ChromaDB for Qdrant, Redis for another KV, or OpenAI for Anthropic, without touching business logic.

## Decision

Every service is structured in four layers:
- `domain` — entities, value objects, ports (interfaces)
- `application` — use cases / services
- `infrastructure` — adapters implementing ports
- `interfaces` — HTTP routes, stream consumers, CLI

Dependencies always point inward: `interfaces` depends on `application`, `application` depends on `domain`, `infrastructure` implements `domain` ports. No layer imports from an outer layer.

## Consequences

- Domain is framework-free and testable in isolation with hand-rolled in-memory fakes.
- Adapters are swappable behind ports (e.g., `VectorStoreAdapter` has both ChromaDB and Qdrant implementations planned).
- Slight ceremony cost (more files and directories) — justified by long-term maintainability and portfolio readability.

## Alternatives Rejected

- **Flat MVC:** faster to write, harder to evolve; couples HTTP framework to business logic.
- **Clean Architecture (Uncle Bob full taxonomy):** more layers than needed for service-sized components; use-case input/output port distinction adds ceremony without payoff at this scale.
