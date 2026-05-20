# Infrastructure Map

## Primary files

| Area | Files |
|---|---|
| Local orchestration | `Makefile`, `infra/docker-compose.yml` |
| Environment | `infra/.env.example`, `infra/.env` local only |
| Gateway container | `services/gateway/Dockerfile`, `services/gateway/package.json` |
| Tenant API container | `services/tenant-api/Dockerfile`, `services/tenant-api/package.json` |
| Flow engine container | `services/flow-engine/Dockerfile`, `services/flow-engine/pyproject.toml` |
| RAG indexer container | `services/rag-indexer/Dockerfile`, `services/rag-indexer/pyproject.toml` |
| Reverse proxy | `infra/Caddyfile` |
| Database | `infra/migrations/*.sql`, `services/tenant-api/prisma/schema.prisma` |
| Redis | `infra/redis/*`, stream producers/consumers |
| E2E/smoke | `infra/e2e/*`, `e2e/*` if present |
| Deploy | `.github/workflows/*`, `docs/runbook.md` |

## Known repo hotspots

- Node Dockerfiles use `npm ci`; this requires committed `package-lock.json` files.
- Project standard is pnpm-only. Replace old `npm ci`, `npm run`, `npx`, and `package-lock.json` usage with pnpm equivalents.
- README/runbook can claim production readiness while deploy workflow is still a placeholder.
- `deploy.replicas` in Compose is not enough unless the chosen Docker Compose mode actually honors it as expected.
- Caddy config using `localhost` is local-oriented; production domain/TLS behavior must be documented separately.
- Healthchecks must test the real readiness path for dependencies used by app services.
- `.env.example` should be safe for local bootstrapping but must not imply production-safe defaults.

## Minimum verification ladder

1. Static: inspect env var names, Dockerfile package manager commands, port exposure, healthchecks.
2. Build: run the smallest relevant build command.
3. Start: run the narrowest Compose target.
4. Readiness: run healthcheck/smoke command.
5. Behavior: run e2e path if the change touches service wiring.
6. Docs: verify README/runbook command still matches reality.
