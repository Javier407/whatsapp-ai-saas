"""Match an incoming message against the active flows for a tenant.

Priority order:
  1. keyword_match — any keyword appears in message (case-insensitive, word boundary)
  2. regex_match   — re.search with IGNORECASE
  3. always        — catch-all; lowest priority

Returns the first matching Flow, or None if nothing matches.
"""
from __future__ import annotations

import re

from flow_engine.domain.models import Flow


def match_trigger(message_text: str, flows: list[Flow]) -> Flow | None:
    """Return the first matching flow in priority order, or None."""
    keyword_matches: list[Flow] = []
    regex_matches: list[Flow] = []
    always_matches: list[Flow] = []

    for flow in flows:
        trigger = flow.trigger
        trigger_type = trigger.get("type", "")

        if trigger_type == "keyword_match":
            keywords: list[str] = trigger.get("keywords", [])
            if _keyword_match(message_text, keywords):
                keyword_matches.append(flow)

        elif trigger_type == "regex_match":
            pattern: str = trigger.get("regex", "")
            if pattern and re.search(pattern, message_text, re.IGNORECASE):
                regex_matches.append(flow)

        elif trigger_type == "always":
            always_matches.append(flow)

    # Return first in priority order
    if keyword_matches:
        return keyword_matches[0]
    if regex_matches:
        return regex_matches[0]
    if always_matches:
        return always_matches[0]
    return None


def _keyword_match(text: str, keywords: list[str]) -> bool:
    """True if any keyword appears in text with word-boundary matching."""
    text_lower = text.lower()
    for kw in keywords:
        # Use word boundary only if keyword is alphanumeric at edges
        pattern = r"\b" + re.escape(kw.lower()) + r"\b"
        if re.search(pattern, text_lower):
            return True
    return False
