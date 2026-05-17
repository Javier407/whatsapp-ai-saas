# ADR-006: JWT HS256 for MVP Auth

**Status:** Accepted
**Date:** 2026-05-17

## Context

Single-tenant-aware monolith-of-services with one auth issuer (`tenant-api`). No external identity providers in MVP.

## Decision

JWT signed with HS256, single secret (`JWT_SECRET` env var, min 32 characters), 12-hour expiry, claims `{ sub, tid, role, iat, exp }`. Validated by Fastify middleware in `tenant-api`. Flow Engine admin endpoints use a separate static `X-Internal-Token` plus private network boundary (no JWT).

## Consequences

- Zero key-distribution complexity; one secret in env.
- 12h expiry forces dashboard re-login daily — acceptable for MVP, not for long-lived production sessions.
- Migration path to RS256 (asymmetric, key rotation) is straightforward: replace verify function, distribute public key to other services.
- Tradeoff: shared secret means any service holding it can mint tokens. Only `tenant-api` holds `JWT_SECRET` in MVP.

## Alternatives Rejected

- **RS256 from day one:** key management overhead unjustified for a single issuer.
- **Session cookies:** would require sticky sessions or a shared session store; unnecessary complexity.
- **OAuth/SSO:** out of scope for MVP.
