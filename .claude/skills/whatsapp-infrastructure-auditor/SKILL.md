---
name: whatsapp-infrastructure-auditor
description: Audit and improve infrastructure for whatsapp-ai-saas. Use when changing or reviewing Dockerfiles, docker-compose, Makefile targets, .env.example, Caddy, Redis/Postgres/ChromaDB/MinIO config, healthchecks, migrations, deploy workflows, production readiness, local dev startup, smoke/e2e infrastructure, secrets, backups, or operational runbooks.
---

# WhatsApp Infrastructure Auditor

Use this skill to verify that local and production infrastructure is reproducible, secure, observable, and honest about readiness.

## Workflow

1. Identify the target: local dev, test/e2e, production deploy, data services, networking, secrets, or operations.
2. Read the infra entrypoint first: `Makefile`, `infra/docker-compose.yml`, `infra/.env.example`, relevant Dockerfiles, and nearest runbook section.
3. Verify commands from the user's path, not from ideal assumptions. If a README says `make dev`, check the target and dependencies.
4. Check that every service has build inputs, runtime env vars, healthcheck behavior, logs, restart policy, and dependency order.
5. Treat missing lockfiles, placeholder deploys, unverified healthchecks, and undocumented secrets as delivery blockers.
6. If infra changes behavior, update docs and verification commands in the same work unit.

## Critical checks

- Docker builds must be reproducible: lockfiles must match package managers and Dockerfile install commands.
- Node.js services must use pnpm only. Flag `npm`, `npx`, `package-lock.json`, or npm cache config as infra drift.
- Compose dependencies must reflect real readiness, not just container startup.
- Secrets must live in `.env`/secret manager, never committed defaults pretending to be production.
- Public ports must be intentional; internal services should stay internal unless needed.
- Production claims require deploy, rollback, backups, monitoring/log access, TLS, secret rotation, and recovery docs.
- Destructive targets like `clean` must be explicit and guarded.
- CI/CD workflows must do real work; TODO echo steps are not deploy automation.

## Finding format

Use:

- `INFRA CRITICAL`: build/start/deploy/data safety path is broken.
- `INFRA WARNING`: risky, flaky, insecure, or undocumented operational behavior.
- `INFRA SUGGESTION`: simplification, naming, or maintainability improvement.

Each finding must include affected file, current behavior, risk, minimal fix, and verification command.

See `references/infrastructure-map.md` for this repo's infra hotspots.
