# E2E Smoke Map

## Commands

| Command | What it does |
|---|---|
| `make smoke` | Health-check all 6 services (gateway, tenant-api, flow-engine, postgres, redis, chromadb) |
| `make e2e` | Full suite: smoke + seed + test-webhook + test-isolation |
| `make test-webhook` | Signed webhook simulation (needs `APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`) |
| `make test-isolation` | Cross-tenant RLS enforcement |
| `make logs SERVICE=<name>` | Follow a single service's logs |

## Failure → likely cause

| Failure | Responsible service / cause |
|---|---|
| gateway unhealthy | Redis not ready, env vars missing, port conflict |
| tenant-api unhealthy | Postgres not ready, migration not run, `JWT_SECRET` missing |
| flow-engine unhealthy | Redis/ChromaDB unreachable, `OPENAI_API_KEY` missing |
| rag-indexer unhealthy | ChromaDB or MinIO not ready |
| redis unhealthy | `users.acl` not rendered (missing `envsubst` on the ACL file) |
| test-webhook fails | HMAC mismatch (SignatureVerifier / env) or Meta payload parsing |
| test-isolation fails | **CRITICAL** — missing `SET LOCAL app.tenant_id`, RLS migration not applied, or `app_user` has BYPASSRLS |

## Severity

- `E2E CRITICAL`: data isolation broken, auth bypass, or a service won't start.
- `E2E WARNING`: feature broken, no data-safety impact.
- `E2E INFO`: flaky/env-specific or a known gap with an open issue.

## Required env for the full suite

`APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `OPENAI_API_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `JWT_SECRET`, `MASTER_KEY`, `INTERNAL_API_TOKEN`.
