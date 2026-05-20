---
name: architecture-steward
description: Track architecture, decisions, completed work, implementation approach, pending work, and timestamps for whatsapp-ai-saas. Use after architecture changes, infrastructure changes, contract fixes, documentation updates, feature work, bug fixes, or planning sessions where Codex must explain what was done, how it was done, when it was done, and what remains.
---

# Architecture Steward

Use this skill to keep an architectural ledger for the project.

## Rules

1. After any non-trivial change, produce an architecture stewardship note.
2. Include exact date and time with timezone. Use the local project timezone when available; this project uses America/Bogota (-05:00).
3. Separate facts from interpretation. Say what changed, where, how it was verified, and what remains.
4. Track architecture impact, not just changed files.
5. Do not claim work is complete unless verification passed or the limitation is explicitly documented.
6. Keep entries concise and append-only. New work gets a new dated entry; do not rewrite history unless correcting a false statement.
7. If implementation changed setup, contracts, runtime behavior, security, deployment, or operations, mention the documentation impact.

## Required entry shape

```markdown
## YYYY-MM-DD HH:mm:ss -05:00 - <short title>

**Status:** completed | partial | blocked | decision | discovery

**What was done:** <one or two sentences>

**How it was done:** <key implementation steps, not noisy details>

**Architecture impact:** <service boundaries, contracts, infra, data, security, or none>

**Verification:** <commands run and result, or why not run>

**Remaining work:** <next action, or none>

**Relevant files:**
- `path` - <why it matters>
```

## Output behavior

When asked for status, summarize latest entries first:

- What changed
- Why it matters architecturally
- What is still risky
- Next recommended action

See `references/architecture-ledger.md` for the project-specific ledger location and initial known entries.
