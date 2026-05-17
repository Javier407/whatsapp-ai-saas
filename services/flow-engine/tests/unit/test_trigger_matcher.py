"""Unit tests for application/trigger_matcher.py.

All tests use in-memory Flow objects — no Redis, Postgres, or Meta API.
"""
from __future__ import annotations

import pytest

from flow_engine.application.trigger_matcher import match_trigger
from flow_engine.domain.models import Flow, FlowNode


def _flow(
    flow_id: str,
    trigger: dict,
) -> Flow:
    return Flow(
        id=flow_id,
        tenant_id="t1",
        name=flow_id,
        trigger=trigger,
        entry_node="n1",
        nodes={
            "n1": FlowNode(id="n1", node_type="end", config={}, transitions=[])
        },
        is_active=True,
    )


class TestKeywordMatch:
    def test_single_keyword_matches(self) -> None:
        flow = _flow("f1", {"type": "keyword_match", "keywords": ["precio"]})
        result = match_trigger("Cuanto es el precio?", [flow])
        assert result is not None
        assert result.id == "f1"

    def test_keyword_case_insensitive(self) -> None:
        flow = _flow("f1", {"type": "keyword_match", "keywords": ["PRECIO"]})
        result = match_trigger("quiero el precio", [flow])
        assert result is not None

    def test_keyword_word_boundary(self) -> None:
        """Should NOT match 'precio' inside 'sinprecio'."""
        flow = _flow("f1", {"type": "keyword_match", "keywords": ["precio"]})
        result = match_trigger("sinprecio de lista", [flow])
        assert result is None

    def test_multiple_keywords_any_matches(self) -> None:
        flow = _flow("f1", {"type": "keyword_match", "keywords": ["hello", "hola"]})
        assert match_trigger("hola amigo", [flow]) is not None
        assert match_trigger("hello there", [flow]) is not None

    def test_no_keyword_match_returns_none(self) -> None:
        flow = _flow("f1", {"type": "keyword_match", "keywords": ["precio"]})
        assert match_trigger("quiero saber los horarios", [flow]) is None


class TestRegexMatch:
    def test_regex_matches(self) -> None:
        flow = _flow("f1", {"type": "regex_match", "regex": r"\d{10}"})
        result = match_trigger("mi numero es 5512345678", [flow])
        assert result is not None

    def test_regex_case_insensitive(self) -> None:
        flow = _flow("f1", {"type": "regex_match", "regex": r"order\s+#?\d+"})
        assert match_trigger("I have ORDER #123 question", [flow]) is not None

    def test_regex_no_match(self) -> None:
        flow = _flow("f1", {"type": "regex_match", "regex": r"^\d+$"})
        assert match_trigger("not a number", [flow]) is None


class TestAlwaysTrigger:
    def test_always_matches_any_text(self) -> None:
        flow = _flow("f1", {"type": "always"})
        assert match_trigger("anything", [flow]) is not None

    def test_always_matches_empty_string(self) -> None:
        flow = _flow("f1", {"type": "always"})
        assert match_trigger("", [flow]) is not None


class TestPriorityOrder:
    def test_keyword_beats_regex(self) -> None:
        kw_flow = _flow("keyword", {"type": "keyword_match", "keywords": ["test"]})
        regex_flow = _flow("regex", {"type": "regex_match", "regex": "test"})
        result = match_trigger("test message", [regex_flow, kw_flow])
        assert result is not None
        assert result.id == "keyword"

    def test_regex_beats_always(self) -> None:
        regex_flow = _flow("regex", {"type": "regex_match", "regex": r"\d+"})
        always_flow = _flow("always", {"type": "always"})
        result = match_trigger("call 1234", [always_flow, regex_flow])
        assert result is not None
        assert result.id == "regex"

    def test_keyword_beats_always(self) -> None:
        kw_flow = _flow("keyword", {"type": "keyword_match", "keywords": ["precio"]})
        always_flow = _flow("always", {"type": "always"})
        result = match_trigger("precio del producto", [always_flow, kw_flow])
        assert result is not None
        assert result.id == "keyword"

    def test_no_match_returns_none(self) -> None:
        flow = _flow("f1", {"type": "keyword_match", "keywords": ["xyz"]})
        assert match_trigger("nothing relevant", [flow]) is None

    def test_empty_flows_list(self) -> None:
        assert match_trigger("anything", []) is None
