# Documentation Locations

## Where docs belong

| Change type | Preferred location |
|---|---|
| First-run setup, quick start, repo purpose | `README.md` |
| Local commands, env vars, smoke/e2e flow | `README.md` and `docs/runbook.md` when operational |
| Architecture decision or major tradeoff | `docs/adr/NNN-title.md` |
| Production operations, deploy, rollback, backup, incident response | `docs/runbook.md` |
| Service-to-service payloads and Redis Streams | `infra/contracts/*.schema.json` plus nearby tests |
| API request/response behavior | Route tests plus README/API section if public |
| Database schema or tenant isolation | `infra/migrations/`, Prisma schema comments only when non-obvious, and ADR/runbook if operational |
| Known limitation or stub | README/runbook section with exact status and next step |
| Test strategy or verification command | README testing section or service test file names |

## Minimum useful doc shape

```markdown
## <Feature or behavior>

**Status:** implemented | partial | local-only | stub | planned

**What changed:** <one sentence>

**How to use/verify:**

```bash
<command>
```

**Notes:** <edge cases, limits, or production caveats>
```

## Anti-patterns

- Saying `production-ready` while deploy, backups, monitoring, secrets, or recovery are TODO.
- Duplicating the same instructions in three places without a canonical source.
- Explaining implementation internals that tests or code already make obvious.
- Updating docs without a command, example, or observable expected result.
