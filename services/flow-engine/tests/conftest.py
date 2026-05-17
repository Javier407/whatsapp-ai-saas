"""Shared pytest fixtures for Flow Engine tests."""
from __future__ import annotations

import pytest

from flow_engine.domain.models import Flow, FlowNode, Session


def _make_flow(
    flow_id: str = "flow-1",
    tenant_id: str = "tenant-abc",
    trigger_type: str = "keyword_match",
    keywords: list[str] | None = None,
    regex: str | None = None,
    entry_node: str = "node-start",
    nodes: dict | None = None,
) -> Flow:
    trigger: dict = {"type": trigger_type}
    if keywords:
        trigger["keywords"] = keywords
    if regex:
        trigger["regex"] = regex

    if nodes is None:
        end_node = FlowNode(
            id="node-end",
            node_type="end",
            config={"content": "Goodbye!"},
            transitions=[],
        )
        start_node = FlowNode(
            id="node-start",
            node_type="message",
            config={"content": "Hello!"},
            transitions=[{"condition": "default", "next_node": "node-end"}],
        )
        nodes = {"node-start": start_node, "node-end": end_node}

    return Flow(
        id=flow_id,
        tenant_id=tenant_id,
        name="Test Flow",
        trigger=trigger,
        entry_node=entry_node,
        nodes=nodes,
        is_active=True,
    )


def _make_session(
    tenant_id: str = "tenant-abc",
    wa_id: str = "521234567890",
    state: str = "IDLE",
) -> Session:
    return Session(
        tenant_id=tenant_id,
        wa_id=wa_id,
        state=state,  # type: ignore[arg-type]
        flow_id=None,
        current_node=None,
        slots={},
        history=[],
        retry_count=0,
        started_at="2026-01-01T00:00:00+00:00",
        last_msg_at="2026-01-01T00:00:00+00:00",
    )


@pytest.fixture
def sample_flow() -> Flow:
    return _make_flow()


@pytest.fixture
def idle_session() -> Session:
    return _make_session()
