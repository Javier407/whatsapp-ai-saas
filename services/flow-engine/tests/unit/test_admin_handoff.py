"""Unit tests for the handoff admin endpoints (send / resume)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from flow_engine.domain.models import ConversationTurn, Session
from flow_engine.interfaces import admin_api

_TOKEN = "test-internal-token"
_TENANT = "11111111-1111-1111-1111-111111111111"
_WA = "573044823906"
_AUTH = {"X-Internal-Token": _TOKEN}


class FakeCredsRepo:
    def __init__(self, creds: tuple[str, str] | None = ("phone-1", "tok-1")) -> None:
        self._creds = creds

    def get_access_token(self, tenant_id: str, phone_number_id: str) -> str | None:
        return self._creds[1] if self._creds else None

    def get_credentials(self, tenant_id: str) -> tuple[str, str] | None:
        return self._creds


class FakeMetaSend:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    def send_text(self, phone_number_id, to, text, access_token) -> None:
        self.sent.append({"to": to, "text": text})

    def send_interactive(self, *a, **k) -> None:  # pragma: no cover
        pass


class FakeConvLog:
    def __init__(self) -> None:
        self.logs: list[ConversationTurn] = []

    def write(self, turn: ConversationTurn) -> None:
        self.logs.append(turn)


class FakeSessionRepo:
    def __init__(self, session: Session | None) -> None:
        self._session = session
        self.saved: list[Session] = []

    def load(self, tenant_id: str, wa_id: str) -> Session | None:
        return self._session

    def save(self, session: Session) -> None:
        self.saved.append(session)

    def delete(self, tenant_id: str, wa_id: str) -> None:  # pragma: no cover
        pass


@pytest.fixture
def client() -> TestClient:
    admin_api._state.clear()
    admin_api._state["internal_token"] = _TOKEN
    return TestClient(admin_api.app)


def _handed_off_session() -> Session:
    s = Session.new(_TENANT, _WA, "2026-01-01T00:00:00+00:00")
    s.state = "HUMAN_HANDOFF"
    return s


class TestHandoffSend:
    def test_send_delivers_and_logs_agent_message(self, client: TestClient) -> None:
        meta = FakeMetaSend()
        conv = FakeConvLog()
        admin_api._state["tenant_credentials_repo"] = FakeCredsRepo()
        admin_api._state["meta_send"] = meta
        admin_api._state["conv_log_repo"] = conv

        resp = client.post(
            f"/admin/handoff/{_TENANT}/{_WA}/send",
            headers=_AUTH,
            json={"message": "Hola, soy Javier de WrapHouse"},
        )

        assert resp.status_code == 200
        assert resp.json()["status"] == "sent"
        assert meta.sent == [{"to": _WA, "text": "Hola, soy Javier de WrapHouse"}]
        assert len(conv.logs) == 1
        assert conv.logs[0].direction == "outbound"
        assert conv.logs[0].node_id == "human_agent"

    def test_send_requires_token(self, client: TestClient) -> None:
        resp = client.post(
            f"/admin/handoff/{_TENANT}/{_WA}/send", json={"message": "hi"}
        )
        assert resp.status_code in (401, 422)  # missing header

    def test_send_rejects_empty_message(self, client: TestClient) -> None:
        admin_api._state["tenant_credentials_repo"] = FakeCredsRepo()
        admin_api._state["meta_send"] = FakeMetaSend()
        admin_api._state["conv_log_repo"] = FakeConvLog()
        resp = client.post(
            f"/admin/handoff/{_TENANT}/{_WA}/send", headers=_AUTH, json={"message": "   "}
        )
        assert resp.status_code == 400

    def test_send_404_when_no_credentials(self, client: TestClient) -> None:
        admin_api._state["tenant_credentials_repo"] = FakeCredsRepo(creds=None)
        admin_api._state["meta_send"] = FakeMetaSend()
        admin_api._state["conv_log_repo"] = FakeConvLog()
        resp = client.post(
            f"/admin/handoff/{_TENANT}/{_WA}/send", headers=_AUTH, json={"message": "hi"}
        )
        assert resp.status_code == 404


class TestHandoffResume:
    def test_resume_clears_handoff(self, client: TestClient) -> None:
        session = _handed_off_session()
        repo = FakeSessionRepo(session)
        admin_api._state["session_repo"] = repo

        resp = client.post(f"/admin/handoff/{_TENANT}/{_WA}/resume", headers=_AUTH)

        assert resp.status_code == 200
        assert resp.json()["status"] == "resumed"
        assert repo.saved[0].state == "IDLE"

    def test_resume_no_session(self, client: TestClient) -> None:
        admin_api._state["session_repo"] = FakeSessionRepo(None)
        resp = client.post(f"/admin/handoff/{_TENANT}/{_WA}/resume", headers=_AUTH)
        assert resp.status_code == 200
        assert resp.json()["status"] == "no_session"


class TestSessionState:
    def test_reports_handoff(self, client: TestClient) -> None:
        admin_api._state["session_repo"] = FakeSessionRepo(_handed_off_session())
        resp = client.get(f"/admin/sessions/{_TENANT}/{_WA}/state", headers=_AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["state"] == "HUMAN_HANDOFF"
        assert body["handoff"] is True

    def test_reports_none_when_no_session(self, client: TestClient) -> None:
        admin_api._state["session_repo"] = FakeSessionRepo(None)
        resp = client.get(f"/admin/sessions/{_TENANT}/{_WA}/state", headers=_AUTH)
        assert resp.status_code == 200
        body = resp.json()
        assert body["state"] is None
        assert body["handoff"] is False
