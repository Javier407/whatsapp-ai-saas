---
name: project-documentation-standards
description: Enforce documentation best practices for whatsapp-ai-saas. Use when creating, changing, or reviewing README files, runbooks, ADRs, API docs, contract docs, PR notes, implementation notes, or any code change that affects behavior, architecture, setup, testing, deployment, or operations.
---

# Project Documentation Standards

Use this skill to keep documentation useful, short, and verifiable.

## Rules

1. Document behavior, decisions, contracts, and verification. Do not document obvious code mechanics.
2. Lead with the answer: what changed, why it matters, and how to verify it.
3. Keep docs close to the thing they explain: README for entry points, runbook for operations, ADR for architectural decisions, contract docs for service boundaries, tests for executable examples.
4. Treat stale docs as bugs. If code changes behavior, update the matching doc in the same work unit.
5. Prefer checklists, tables, examples, and commands over long prose.
6. Mark scope clearly: implemented, not implemented, local-only, production-ready, stub, or future work.
7. Never claim production readiness unless build, deploy, security, observability, backup, and recovery paths are documented and verified.

## Required doc impact check

For every non-trivial change, answer:

- Does this change setup, env vars, commands, deploy, or testing?
- Does this change an API, Redis Stream, DB schema, payload, auth, or tenant boundary?
- Does this change operational behavior, retries, rate limits, logging, or failures?
- Does this change user-facing flows or expected product behavior?

If yes, update docs or explicitly state why no doc change is needed.

## Output format for reviews

Use:

- `DOC REQUIRED`: missing or stale docs block safe delivery.
- `DOC WARNING`: docs exist but are incomplete or hard to verify.
- `DOC SUGGESTION`: readability or discoverability improvement.

Each finding must name the affected file, missing reader action, and minimal doc fix.

See `references/doc-locations.md` for where each kind of documentation belongs.
