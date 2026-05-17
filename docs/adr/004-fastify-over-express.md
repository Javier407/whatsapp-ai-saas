# ADR-004: Fastify over Express for Node.js Services

**Status:** Accepted
**Date:** 2026-05-17

## Context

`gateway` is on Meta's hot path (P95 < 150ms). `tenant-api` needs first-class schema validation for a public REST surface.

## Decision

Fastify 4.x for both Node.js services. JSON Schema for request/response validation. `@fastify/sensible` for HTTP errors. `pino` for structured JSON logs.

## Consequences

- 2–3x raw throughput vs Express; built-in schema compilation makes request validation a near-zero-cost operation.
- Plugin model encloses middleware cleanly (matches hexagonal infrastructure boundary).
- Pino integrates by default — no need for `morgan` + `winston` glue.
- Tradeoff: smaller ecosystem than Express; documented edge cases around plugin encapsulation that the team must understand.

## Alternatives Rejected

- **Express:** slower, no built-in schema, requires assembling 4–5 middleware libraries for the same result.
- **NestJS:** opinionated framework adds learning curve and runtime overhead; conflicts with our own hexagonal layering.
- **Hono:** great DX but smaller ecosystem; less proven for production webhook endpoints.
