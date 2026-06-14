# Product Vision

> Status: working document. Engineering direction is established and reflected in the
> codebase; the product/commercial direction below is captured here for the first time.
> Items marked **(assumption — validate)** are not yet confirmed by customer evidence.

## One-liner

A self-serve SaaS that turns a small business's WhatsApp number into an AI assistant that
answers customer questions from the business's own knowledge base and guided conversational
flows — with no code.

## Ideal Customer Profile (ICP)

**Small and medium businesses (PyMEs), self-serve.**

- They sign up themselves, connect their WhatsApp Business Account, upload their FAQ / catalog,
  and configure flows — without engineering help or vendor onboarding.
- They pay a recurring subscription.

### Their pain (today)

- Customer questions arrive on WhatsApp at all hours; staff can't keep up.
- Existing tools are either too technical (raw JSON / developer setup) or too shallow
  (keyword bots that can't answer real questions).
- In this product's current state, building a flow still requires pasting JSON — a non-technical
  owner cannot operate it autonomously yet. Closing that gap is the central near-term goal.

## Value proposition

For a non-technical PyME owner, the wedge is the combination of:

1. **Answers from their own documents** — RAG over the tenant's uploaded knowledge base, so the
   bot replies with real business information, not generic chat. *(Implemented.)*
2. **Visual, no-code flows** — drag-and-drop flow builder for guided conversations.
   *(Planned — `visual-flow-builder`.)*
3. **True self-serve** — sign up, connect WhatsApp, and go live without a sales call.
   *(Gap — requires Meta Embedded Signup.)*

**(assumption — validate)** Differentiation vs ManyChat / Wati / 360dialog / Twilio: those lead
with broadcast/marketing or developer APIs; this product leads with *RAG-grounded answers + no-code
flows + simple self-serve pricing*. This positioning needs validation against real prospects.

## Monetization

**Subscription tiers** — grounded in the existing `tenants.plan` enum (`free | pro | enterprise`).

| Tier | Intent (assumption — validate) |
|------|-------------------------------|
| free | Trial / sandbox — limited messages and one flow, to prove value before paying. |
| pro | The default paid PyME plan — usage quotas (messages, KB documents, flows). |
| enterprise | Higher limits + custom terms. |

Open monetization questions to document once decided:

- **(assumption — validate)** Exact price points and what each tier limits (messages? conversations?
  KB size? flows?).
- **WhatsApp conversation cost pass-through.** Meta bills per conversation (CBP). Pricing must cover
  this; decide whether it's absorbed into the tier or billed as usage. This is a hard business
  constraint, not a UI detail.
- Quota enforcement does not exist yet (the `plan` field is stored but not enforced) — it is a
  prerequisite for monetization.

## Trajectory

| Phase | Focus | State |
|-------|-------|-------|
| 1 — MVP | Core engine: webhooks, 8-node flows, RAG+LLM, multi-tenant RLS, dashboard. Single-WABA sandbox. | ✅ Done |
| 2 — Tenant autonomy | Visual flow builder; dashboard test coverage. | 🔵 In progress |
| 3 — Self-serve commercial | Meta Embedded Signup (self-serve onboarding), multi-WABA, billing (Stripe), plan quotas. | 🔴 Next |
| 4 — Growth | Proactive campaigns (templates), BYOK, analytics. | 🔴 Later |
| 5 — Scale | Redis HA, Qdrant for high-volume tenants. | 🔵 Future |

## What the ICP implies for the build (priorities)

Because the customer is a **self-serve PyME**, the highest-leverage work after the visual builder is:

1. **Self-serve onboarding** — Meta Embedded Signup. Without it, "self-serve" is not true and
   every signup needs manual WhatsApp connection. This is the gate to the commercial phase.
2. **Billing + quota enforcement** — turn the `plan` enum into enforced limits + Stripe. No revenue
   without it.
3. **Visual flow builder** — already specced (`visual-flow-builder`); it is what makes a
   non-technical owner self-sufficient.

## Open questions to validate (and then document here)

- Exact pricing and per-tier limits.
- The differentiation wedge, tested against real prospects.
- How WhatsApp's per-conversation cost is reflected in pricing.
- Which verticals (if any) to target first within "PyME" (retail, services, etc.).
