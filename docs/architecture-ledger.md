# Architecture Ledger

Append-only record of architecture-relevant changes, decisions, verification, and remaining work.

## 2026-05-20 11:54:01 -05:00 - Established pnpm-only Node.js tooling

**Status:** completed

**What was done:** Standardized all Node.js services on pnpm and removed npm/package-lock usage from the active project workflow.

**How it was done:** Updated Makefile commands, Node Dockerfiles, CI workflow, service package metadata, pnpm lockfiles, README/runbook references, and infrastructure skill rules.

**Architecture impact:** Infrastructure and build reproducibility. Node services now use pnpm 10 via Corepack, with per-service `pnpm-lock.yaml` files and explicit pnpm build-script approvals where needed.

**Verification:** Ran `corepack pnpm --dir services/gateway build`, `corepack pnpm --dir services/tenant-api build`, and `corepack pnpm --dir services/dashboard build`; all passed after fixing TypeScript/build issues exposed by the migration.

**Remaining work:** Run full test/lint/e2e suites once broader runtime issues are addressed.

**Relevant files:**
- `package.json` - root pnpm package manager declaration.
- `pnpm-workspace.yaml` - workspace package list.
- `services/*/package.json` - per-service pnpm metadata and build-script approvals.
- `services/*/pnpm-lock.yaml` - reproducible dependency locks.
- `services/*/Dockerfile` - pnpm-based container builds.
- `.github/workflows/ci-node.yml` - pnpm-based Node CI.
- `Makefile` - pnpm local commands.
- `README.md` - documents pnpm as the Node package manager.
- `docs/runbook.md` - uses pnpm for Prisma commands.

## 2026-05-20 11:54:01 -05:00 - Created architecture stewardship workflow

**Status:** completed

**What was done:** Added an `architecture-steward` agent skill to track what changed, how it changed, when it changed, verification status, and remaining work.

**How it was done:** Created a global Codex skill with a required entry template and a project-specific reference pointing to this ledger.

**Architecture impact:** Governance and maintainability. Architecture-relevant changes now have a standard append-only record.

**Verification:** Created the skill files and this initial ledger entry.

**Remaining work:** Use the skill after every non-trivial architecture, infra, contract, security, or documentation change.

**Relevant files:**
- `C:\Users\hp\.codex\skills\architecture-steward\SKILL.md` - agent workflow.
- `C:\Users\hp\.codex\skills\architecture-steward\references\architecture-ledger.md` - ledger guidance.
- `docs/architecture-ledger.md` - project architecture ledger.

## 2026-05-20 12:09:02 -05:00 - Fixed Flow Engine inbound contract and token lookup

**Status:** partial

**What was done:** Reconciled the Flow Engine consumer with the Redis Stream envelope shape and added a controlled tenant access-token lookup path from Postgres.

**How it was done:** Updated the consumer to parse the JSON `data` envelope, extract WhatsApp sender/text/timestamp from `raw`, resolve the encrypted access token from Postgres using tenant and phone number IDs, and decrypt it locally before Meta send calls. Added the missing crypto helper, port, config requirement, and unit tests for message parsing.

**Architecture impact:** Fixed the gateway → Redis → flow-engine contract and removed the assumption that plaintext access tokens travel through the queue.

**Verification:** Added tests, but the Python runtime for executing them is not available in this shell. The change was validated by code inspection and by matching the implementation to the declared Redis contract.

**Remaining work:** Run the Flow Engine Python test suite in a Python-enabled environment and confirm the new Postgres token lookup against the real schema.

**Relevant files:**
- `services/flow-engine/flow_engine/interfaces/consumer.py` - parses JSON envelopes and resolves tokens.
- `services/flow-engine/flow_engine/infrastructure/postgres/postgres_tenant_credentials_repo.py` - loads and decrypts stored WhatsApp tokens.
- `services/flow-engine/flow_engine/infrastructure/crypto.py` - AES-GCM helper.
- `services/flow-engine/flow_engine/domain/ports.py` - tenant credential port.
- `services/flow-engine/flow_engine/config.py` - makes `MASTER_KEY` required.
- `services/flow-engine/flow_engine/main.py` - wires the new repo.
- `services/flow-engine/tests/unit/test_consumer.py` - parser coverage.
- `services/flow-engine/pyproject.toml` - adds `cryptography`.
