---
name: whatsapp-contract-debugger
description: Debug and reconcile WhatsApp AI SaaS service contracts. Use when inspecting or fixing payload mismatches across Meta webhooks, gateway, Redis Streams, flow-engine, rag-indexer, tenant-api queues, JSON schemas, and E2E webhook tests in the whatsapp-ai-saas repo.
---

# WhatsApp Contract Debugger

Use this skill to verify that producers, contracts, consumers, tests, and docs all agree on the same message shapes.

## Workflow

1. Identify the path under review: WhatsApp inbound, Meta send, KB indexing, deletion, dry-run, or tenant connect.
2. Read the producer, declared contract, consumer parser, and nearest E2E/unit test before proposing a fix.
3. Compare these fields explicitly: envelope format, required fields, tenant id, phone number id, WhatsApp sender id, text extraction, access token source, timestamps, idempotency key, retry behavior, and ACK policy.
4. Treat docs and README claims as untrusted until code and tests prove them.
5. If a mismatch exists, choose one canonical contract and update producer, consumer, schema, tests, and README/runbook snippets together.
6. Prefer a small failing contract test before implementation when changing behavior.

## Canonical checks

- Redis Streams must have one agreed shape. Do not let one service publish `data` JSON while another expects flat fields.
- The gateway should not invent business fields without parsing Meta's real payload shape.
- The flow-engine must have a reliable source for the tenant access token before calling Meta Send API.
- Consumer ACK decisions must be intentional: malformed messages can ACK; transient dependency failures should not silently disappear.
- Contract schemas under `infra/contracts/` are authoritative only if tests validate both producer and consumer against them.

## Useful files

See `references/whatsapp-ai-saas-contract-map.md` for the project-specific contract map and known hotspots.
