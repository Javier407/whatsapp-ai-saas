---
name: e2e-smoke-validator
description: Run the full E2E smoke suite and interpret results with service-level context. Use after any change that touches inter-service boundaries, infra, or deployment config.
---

# E2E Smoke Validator

Use this skill after changes that could break inter-service communication, infra, or deployment behavior.

## When to Activate

- After touching `docker-compose.yml`, `Makefile`, any `Dockerfile`
- After changing Redis Stream field shapes
- After database migrations
- After changing gateway webhook handling or signature verification
- After any change to `infra/.env.example` or secrets handling
- Before declaring a feature complete

## Workflow

1. Verify the stack is running: `make smoke` (quick health check, no side effects).
2. If smoke passes, run the full suite: `make e2e`.
3. Read the output and classify every failure below.
4. For each failure, identify the responsible service and the likely root cause before suggesting a fix.
5. Do not mark the change complete until the suite passes or failures are explicitly accepted with justification.

## Output Interpretation

### `make smoke` — Health check all 6 services

Checks HTTP `/health` or `/kick/q/health` on each service. If any fail:

| Failure | Likely cause |
|---------|-------------|
| gateway unhealthy | Redis not ready, env vars missing, port conflict |
| tenant-api unhealthy | Postgres not ready, migration not run, JWT_SECRET missing |
| flow-engine unhealthy | Redis not ready, OPENAI_API_KEY missing, ChromaDB unreachable |
| rag-indexer unhealthy | ChromaDB or MinIO not ready |
| postgres unhealthy | Volume permissions, init script failed |
| redis unhealthy | `users.acl` not rendered (missing envsubst on ACL file) |

### `make test-webhook` — Signed webhook simulation

Requires `APP_SECRET` and `WEBHOOK_VERIFY_TOKEN` in env. Failures here mean:
- HMAC signature mismatch: gateway `SignatureVerifier` or env var mismatch
- Payload parsing error: gateway is not handling Meta's real payload shape

### `make test-isolation` — Cross-tenant RLS enforcement

Failures here are **critical**. They mean tenant data is leaking across boundaries:
- Missing `SET LOCAL app.tenant_id` in a transaction
- RLS migration not applied (`infra/migrations/005_enable_rls.sql`)
- `app_user` role has BYPASSRLS (must NOT — only migrator role should)

## Severity Classification

| Level | Meaning |
|-------|---------|
| E2E CRITICAL | Data isolation broken, auth bypass, or service won't start |
| E2E WARNING | Feature broken but no data safety impact |
| E2E INFO | Flaky test, env-specific, or known gap with an open issue |

## Commands Reference

```bash
make smoke           # health-check all 6 services
make e2e             # full suite: smoke + seed + test-webhook + test-isolation
make test-webhook    # signed webhook simulation only
make test-isolation  # cross-tenant RLS check only
make logs            # follow all service logs
make logs SERVICE=gateway   # single service logs
```

## Required Env Vars for Full Suite

`APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `OPENAI_API_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `JWT_SECRET`, `MASTER_KEY`, `INTERNAL_API_TOKEN`

If any are missing, set them in `infra/.env` before running.
