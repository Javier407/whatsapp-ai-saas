"""Human-handoff detection.

A conversation enters ``HUMAN_HANDOFF`` when the user explicitly asks to talk
to a person. While handed off, the bot stops auto-replying so a human agent can
take over from the dashboard; inbound messages are still logged so the agent
sees the full thread.

Detection is keyword based for now. The phrases cover Spanish (the primary
language of current tenants) and a few English fallbacks. This should become a
per-tenant configurable list once tenant settings grow.
"""
from __future__ import annotations

import re

# Phrases that signal the user wants a human. Matched case-insensitively as
# substrings so multi-word phrases work regardless of surrounding text.
_HANDOFF_PHRASES: tuple[str, ...] = (
    "hablar con alguien",
    "hablar con una persona",
    "hablar con un humano",
    "hablar con un asesor",
    "hablar con un agente",
    "quiero un asesor",
    "necesito un asesor",
    "quiero un humano",
    "persona real",
    "asesor humano",
    "atencion humana",
    "atención humana",
    "talk to a human",
    "talk to a person",
    "speak to an agent",
    "real person",
)

# Single words that, on their own, strongly signal a handoff request.
_HANDOFF_WORDS: tuple[str, ...] = (
    "humano",
    "asesor",
    "agente",
    "operador",
    "representante",
)

# Sent once when a conversation enters handoff. English default to match the
# engine's other built-in copy; override per deployment until per-tenant
# messages exist.
HANDOFF_ACK_MESSAGE = (
    "Got it — I'm connecting you with a team member. "
    "They'll reply right here shortly."
)


def wants_human(text: str) -> bool:
    """True if the message is an explicit request to talk to a person."""
    if not text:
        return False
    lowered = text.lower()

    for phrase in _HANDOFF_PHRASES:
        if phrase in lowered:
            return True

    for word in _HANDOFF_WORDS:
        if re.search(r"\b" + re.escape(word) + r"\b", lowered):
            return True

    return False
