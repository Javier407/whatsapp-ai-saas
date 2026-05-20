# Architecture Ledger Guide

## Canonical project ledger

Use this repo file for durable architecture stewardship notes:

- `docs/architecture-ledger.md`

If the file does not exist, create it with:

```markdown
# Architecture Ledger

Append-only record of architecture-relevant changes, decisions, verification, and remaining work.

```

## What deserves an entry

- Service contract changes between gateway, Redis Streams, flow-engine, tenant-api, or rag-indexer.
- Infrastructure changes: Dockerfiles, Compose, Makefile, CI, package manager, env vars, deploy, healthchecks.
- Security or multi-tenant boundaries: JWT, RLS, token encryption, tenant isolation, access tokens.
- Data model or migration changes.
- Production-readiness decisions or corrections to false claims.
- Important discoveries from failed builds, tests, or runtime verification.

## Current known architecture facts

- Node.js services are pnpm-only. npm, npx, package-lock.json, and npm cache config are project drift.
- Contract integrity between gateway and flow-engine is a high-risk area.
- Documentation must be updated with behavior, verification, and honest readiness status when architecture changes.

## Good entry style

Prefer:

- Short title.
- Concrete verification command.
- Files with purpose.
- Next action that another agent can execute.

Avoid:

- Long narrative.
- Vague status like "improved architecture".
- Claiming production readiness without proof.
