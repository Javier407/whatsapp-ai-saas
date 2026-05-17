"""Unit tests for application/node_executors.py.

Uses RecordingMetaSendClient exclusively — no real Meta API, Redis, or Postgres.
"""
from __future__ import annotations

import pytest

from flow_engine.application.node_executors import (
    ExecutorDeps,
    NodeResult,
    execute_api_call,
    execute_collect_input,
    execute_condition,
    execute_end,
    execute_llm_generate,
    execute_message,
    execute_node,
    execute_rag_lookup,
)
from flow_engine.domain.errors import NodeExecutionError
from flow_engine.domain.models import FlowNode, Session
from flow_engine.domain.ports import ILLMPort, IMetaSendPort, IVectorStore
from flow_engine.infrastructure.meta.meta_send_client import RecordingMetaSendClient


# ---------------------------------------------------------------------------
# Fakes / stubs
# ---------------------------------------------------------------------------


class FakeVectorStore(IVectorStore):
    def __init__(self, results: list[tuple[str, float]] | None = None) -> None:
        self._results = results or []

    def query(self, tenant_id: str, query_text: str, top_k: int = 5) -> list[tuple[str, float]]:
        return self._results[: top_k]


class FakeLLMPort(ILLMPort):
    def __init__(self, reply: str = "LLM reply", tokens: int = 42) -> None:
        self._reply = reply
        self._tokens = tokens
        self.last_max_tokens: int | None = None

    def generate(self, system_prompt, history, user_message, rag_context=None, max_tokens=500):
        self.last_max_tokens = max_tokens
        return self._reply, self._tokens


def _make_session(state: str = "IDLE", slots: dict | None = None) -> Session:
    return Session(
        tenant_id="tenant-abc",
        wa_id="521234567890",
        state=state,  # type: ignore[arg-type]
        flow_id=None,
        current_node=None,
        slots=slots or {},
        history=[],
        retry_count=0,
        started_at="2026-01-01T00:00:00+00:00",
        last_msg_at="2026-01-01T00:00:00+00:00",
    )


def _make_deps(
    recording: RecordingMetaSendClient | None = None,
    vector_store: IVectorStore | None = None,
    llm: ILLMPort | None = None,
) -> ExecutorDeps:
    return ExecutorDeps(
        meta_send=recording or RecordingMetaSendClient(),
        vector_store=vector_store or FakeVectorStore(),
        llm=llm or FakeLLMPort(),
        phone_number_id="phone-001",
        access_token="tok-test",
    )


def _make_node(
    node_id: str = "n1",
    node_type: str = "message",
    config: dict | None = None,
    transitions: list[dict] | None = None,
) -> FlowNode:
    return FlowNode(
        id=node_id,
        node_type=node_type,
        config=config or {},
        transitions=transitions or [],
    )


# ---------------------------------------------------------------------------
# message node
# ---------------------------------------------------------------------------


class TestMessageNode:
    def test_interpolates_slots(self) -> None:
        recording = RecordingMetaSendClient()
        node = _make_node(
            node_type="message",
            config={"content": "Hello {name}!"},
            transitions=[],
        )
        session = _make_session(slots={"name": "Alice"})
        result = execute_message(node, session, "", _make_deps(recording))
        assert result.reply == "Hello Alice!"
        assert recording.sent[0]["text"] == "Hello Alice!"

    def test_partial_slot_fallback(self) -> None:
        """Missing slots should not crash — sends template as-is."""
        recording = RecordingMetaSendClient()
        node = _make_node(node_type="message", config={"content": "Hi {unknown}!"})
        session = _make_session()
        result = execute_message(node, session, "", _make_deps(recording))
        assert result.reply is not None  # still sends

    def test_collect_slot_requires_user_input(self) -> None:
        node = _make_node(
            node_type="message",
            config={"content": "What is your name?", "collect_slot": "name"},
        )
        result = execute_message(node, _make_session(), "", _make_deps())
        assert result.requires_user_input is True
        assert result.next_node is None

    def test_no_collect_slot_advances_to_next(self) -> None:
        node = _make_node(
            node_type="message",
            config={"content": "Hello"},
            transitions=[{"condition": "default", "next_node": "n2"}],
        )
        result = execute_message(node, _make_session(), "", _make_deps())
        assert result.next_node == "n2"
        assert result.requires_user_input is False


# ---------------------------------------------------------------------------
# collect_input node
# ---------------------------------------------------------------------------


class TestCollectInputNode:
    def test_first_entry_sends_prompt_and_waits(self) -> None:
        recording = RecordingMetaSendClient()
        node = _make_node(
            node_type="collect_input",
            config={"prompt": "Enter your phone number:", "slot": "phone"},
        )
        result = execute_collect_input(node, _make_session(), "", _make_deps(recording))
        assert result.requires_user_input is True
        assert len(recording.sent) == 1
        assert recording.sent[0]["text"] == "Enter your phone number:"

    def test_stores_user_reply_in_slot(self) -> None:
        node = _make_node(
            node_type="collect_input",
            config={"slot": "phone"},
            transitions=[{"condition": "default", "next_node": "next"}],
        )
        result = execute_collect_input(node, _make_session(), "5512345678", _make_deps())
        assert result.slot_updates == {"phone": "5512345678"}
        assert result.next_node == "next"

    def test_validation_regex_passes(self) -> None:
        node = _make_node(
            node_type="collect_input",
            config={"slot": "phone", "validation": r"\d{10}"},
            transitions=[{"condition": "default", "next_node": "next"}],
        )
        result = execute_collect_input(node, _make_session(), "5512345678", _make_deps())
        assert result.slot_updates == {"phone": "5512345678"}

    def test_validation_regex_fails_increments_retry(self) -> None:
        node = _make_node(
            node_type="collect_input",
            config={"slot": "phone", "validation": r"^\d{10}$"},
        )
        session = _make_session()
        result = execute_collect_input(node, session, "abc", _make_deps())
        assert session.retry_count == 1
        assert result.requires_user_input is True


# ---------------------------------------------------------------------------
# condition node
# ---------------------------------------------------------------------------


class TestConditionNode:
    def test_true_condition_branches(self) -> None:
        node = _make_node(
            node_type="condition",
            config={},
            transitions=[
                {"condition": "slots.age > `18`", "next_node": "adult"},
                {"condition": "default", "next_node": "minor"},
            ],
        )
        session = _make_session(slots={"age": 25})
        result = execute_condition(node, session, "", _make_deps())
        assert result.next_node == "adult"

    def test_default_branch_when_no_condition_matches(self) -> None:
        node = _make_node(
            node_type="condition",
            config={},
            transitions=[
                {"condition": "slots.age > `100`", "next_node": "centenarian"},
                {"condition": "default", "next_node": "normal"},
            ],
        )
        session = _make_session(slots={"age": 25})
        result = execute_condition(node, session, "", _make_deps())
        assert result.next_node == "normal"

    def test_no_transitions_returns_none(self) -> None:
        node = _make_node(node_type="condition", config={}, transitions=[])
        result = execute_condition(node, _make_session(), "", _make_deps())
        assert result.next_node is None


# ---------------------------------------------------------------------------
# api_call node — SSRF guard
# ---------------------------------------------------------------------------


class TestApiCallNode:
    def test_ssrf_rejects_192_168(self) -> None:
        node = _make_node(
            node_type="api_call",
            config={
                "url": "http://192.168.1.1/admin",
                "store_in_slot": "result",
            },
        )
        with pytest.raises(NodeExecutionError) as exc_info:
            execute_api_call(node, _make_session(), "", _make_deps())
        assert "SSRF" in str(exc_info.value)

    def test_ssrf_rejects_localhost(self) -> None:
        node = _make_node(
            node_type="api_call",
            config={"url": "http://localhost:8080/secret", "store_in_slot": "r"},
        )
        with pytest.raises(NodeExecutionError) as exc_info:
            execute_api_call(node, _make_session(), "", _make_deps())
        assert "SSRF" in str(exc_info.value)

    def test_ssrf_rejects_10_dot(self) -> None:
        node = _make_node(
            node_type="api_call",
            config={"url": "http://10.0.0.1/internal", "store_in_slot": "r"},
        )
        with pytest.raises(NodeExecutionError):
            execute_api_call(node, _make_session(), "", _make_deps())


# ---------------------------------------------------------------------------
# llm_generate node — max_tokens hard cap
# ---------------------------------------------------------------------------


class TestLLMGenerateNode:
    def test_hard_cap_at_1000(self) -> None:
        llm = FakeLLMPort()
        node = _make_node(
            node_type="llm_generate",
            config={"system_prompt": "Be helpful", "max_tokens": 5000},
        )
        execute_llm_generate(node, _make_session(), "hello", _make_deps(llm=llm))
        assert llm.last_max_tokens == 1000

    def test_respects_lower_max_tokens(self) -> None:
        llm = FakeLLMPort()
        node = _make_node(
            node_type="llm_generate",
            config={"system_prompt": "Be helpful", "max_tokens": 200},
        )
        execute_llm_generate(node, _make_session(), "hello", _make_deps(llm=llm))
        assert llm.last_max_tokens == 200

    def test_sends_reply_via_meta(self) -> None:
        recording = RecordingMetaSendClient()
        llm = FakeLLMPort(reply="Custom reply")
        node = _make_node(
            node_type="llm_generate",
            config={"system_prompt": "Be helpful"},
        )
        result = execute_llm_generate(node, _make_session(), "hi", _make_deps(recording, llm=llm))
        assert result.reply == "Custom reply"
        assert recording.sent[0]["text"] == "Custom reply"


# ---------------------------------------------------------------------------
# execute_node dispatcher
# ---------------------------------------------------------------------------


def test_unknown_node_type_raises() -> None:
    node = _make_node(node_type="nonexistent")
    with pytest.raises(NodeExecutionError):
        execute_node(node, _make_session(), "", _make_deps())
