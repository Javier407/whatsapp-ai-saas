"""FastAPI admin API for the Flow Engine service.

Endpoints:
  POST /admin/flows/{tenant_id}/reload  — invalidate process-local flow cache
  POST /admin/sessions/{tenant_id}/{wa_id}/reset  — delete session + lock
  GET  /admin/health  — dependency health check
  POST /admin/dry-run — execute a flow without sending real messages

All endpoints require X-Internal-Token header (shared secret).
"""
from __future__ import annotations

import logging
from typing import Any

import redis as redis_module
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

app = FastAPI(title="Flow Engine Admin API", docs_url=None, redoc_url=None)

# Populated at startup via lifespan injection from main.py
_state: dict[str, Any] = {}

_INTERNAL_TOKEN_HEADER = "X-Internal-Token"


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


def _require_internal_token(x_internal_token: str = Header(...)) -> None:
    expected = _state.get("internal_token", "")
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post(
    "/admin/flows/{tenant_id}/reload",
    dependencies=[Depends(_require_internal_token)],
)
def reload_flows(tenant_id: str) -> dict[str, str]:
    flow_repo = _state.get("flow_repo")
    if flow_repo is None:
        raise HTTPException(status_code=503, detail="Flow repo not initialized")
    flow_repo.reload_tenant(tenant_id)
    logger.info("Flow cache reloaded via admin", extra={"tenant_id": tenant_id})
    return {"status": "ok", "tenant_id": tenant_id}


@app.post(
    "/admin/sessions/{tenant_id}/{wa_id}/reset",
    dependencies=[Depends(_require_internal_token)],
)
def reset_session(tenant_id: str, wa_id: str) -> dict[str, str]:
    redis_client: redis_module.Redis = _state.get("redis_client")  # type: ignore[assignment]
    if redis_client is None:
        raise HTTPException(status_code=503, detail="Redis not initialized")
    session_key = f"session:{tenant_id}:{wa_id}"
    lock_key = f"lock:flow:{tenant_id}:{wa_id}"
    redis_client.delete(session_key, lock_key)
    logger.info("Session reset via admin", extra={"tenant_id": tenant_id, "wa_id": wa_id})
    return {"status": "ok", "tenant_id": tenant_id, "wa_id": wa_id}


@app.get(
    "/admin/sessions/{tenant_id}/{wa_id}/state",
    dependencies=[Depends(_require_internal_token)],
)
def session_state(tenant_id: str, wa_id: str) -> dict[str, Any]:
    """Return the conversation's current session state (for the agent inbox).

    ``state`` is None when no session exists (e.g. a fresh contact).
    """
    session_repo = _state.get("session_repo")
    if session_repo is None:
        raise HTTPException(status_code=503, detail="Session repo not initialized")
    session = session_repo.load(tenant_id, wa_id)
    return {
        "tenant_id": tenant_id,
        "wa_id": wa_id,
        "state": session.state if session else None,
        "handoff": bool(session and session.state == "HUMAN_HANDOFF"),
    }


@app.get(
    "/admin/health",
    dependencies=[Depends(_require_internal_token)],
)
def health() -> dict[str, Any]:
    redis_ok = _ping_redis()
    postgres_ok = _ping_postgres()
    chromadb_ok = _ping_chromadb()
    return {
        "status": "ok" if all([redis_ok, postgres_ok, chromadb_ok]) else "degraded",
        "redis": redis_ok,
        "postgres": postgres_ok,
        "chromadb": chromadb_ok,
    }


class DryRunRequest(BaseModel):
    tenant_id: str
    message: str
    simulated_wa_id: str = "dry-run-0000000000"


@app.post(
    "/admin/dry-run",
    dependencies=[Depends(_require_internal_token)],
)
def dry_run(body: DryRunRequest) -> dict[str, Any]:
    """Execute a flow with a RecordingMetaSendClient and return the trace."""
    import copy
    from datetime import datetime, timezone

    from flow_engine.domain.models import InboundMessage, Session
    from flow_engine.infrastructure.meta.meta_send_client import RecordingMetaSendClient

    executor = _state.get("executor")
    session_repo = _state.get("session_repo")
    if executor is None or session_repo is None:
        raise HTTPException(status_code=503, detail="Executor not initialized")

    # Shallow-copy the executor so concurrent dry-run requests each get their
    # own _meta_send reference without touching the shared production instance.
    recording_client = RecordingMetaSendClient()
    dry_executor = copy.copy(executor)
    dry_executor._meta_send = recording_client

    # Dry runs must never persist real appointments — record them instead.
    class _RecordingAppointmentRepo:
        def __init__(self) -> None:
            self.created: list[dict[str, Any]] = []

        def create(self, tenant_id, wa_id, customer_name, service, appointment_date) -> None:
            self.created.append(
                {
                    "customer_name": customer_name,
                    "service": service,
                    "appointment_date": appointment_date,
                }
            )

    recording_appointments = _RecordingAppointmentRepo()
    dry_executor._appointment_repo = recording_appointments

    # Dry runs must not pollute the real conversation history either.
    class _NoopConvLog:
        def write(self, turn: Any) -> None:
            pass

    dry_executor._conv_log_repo = _NoopConvLog()

    now = datetime.now(timezone.utc).isoformat()
    session = session_repo.load(body.tenant_id, body.simulated_wa_id)
    if session is None:
        session = Session.new(body.tenant_id, body.simulated_wa_id, now)

    msg = InboundMessage(
        message_id=f"dry-run-{now}",
        tenant_id=body.tenant_id,
        phone_number_id="dry-run",
        wa_id=body.simulated_wa_id,
        text=body.message,
        timestamp=now,
        access_token="dry-run",
    )

    dry_executor.execute(msg, session)

    return {
        "session_state": session.state,
        "current_node": session.current_node,
        "slots": session.slots,
        "sent": recording_client.sent,
        "appointments": recording_appointments.created,
    }


class HandoffSendRequest(BaseModel):
    message: str


@app.post(
    "/admin/handoff/{tenant_id}/{wa_id}/send",
    dependencies=[Depends(_require_internal_token)],
)
def handoff_send(tenant_id: str, wa_id: str, body: HandoffSendRequest) -> dict[str, str]:
    """Send an agent's reply to the customer as the business (during handoff)."""
    from datetime import datetime, timezone

    from flow_engine.domain.models import ConversationTurn

    creds_repo = _state.get("tenant_credentials_repo")
    meta_send = _state.get("meta_send")
    conv_log_repo = _state.get("conv_log_repo")
    if creds_repo is None or meta_send is None or conv_log_repo is None:
        raise HTTPException(status_code=503, detail="Handoff dependencies not initialized")

    text = body.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="message must not be empty")

    creds = creds_repo.get_credentials(tenant_id)
    if creds is None:
        raise HTTPException(status_code=404, detail="Tenant has no WhatsApp credentials")
    phone_number_id, access_token = creds

    try:
        meta_send.send_text(
            phone_number_id=phone_number_id,
            to=wa_id,
            text=text,
            access_token=access_token,
        )
    except Exception as exc:
        logger.exception("Agent reply send failed", extra={"tenant_id": tenant_id, "wa_id": wa_id})
        raise HTTPException(status_code=502, detail="Failed to deliver message") from exc

    # Log the agent's reply so it appears in the conversation thread.
    # node_key='human_agent' marks it as a human (not bot) message.
    conv_log_repo.write(
        ConversationTurn(
            tenant_id=tenant_id,
            wa_id=wa_id,
            flow_id=None,
            direction="outbound",
            message_text=text,
            node_id="human_agent",
            llm_tokens=0,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    logger.info("Agent reply sent", extra={"tenant_id": tenant_id, "wa_id": wa_id})
    return {"status": "sent"}


@app.post(
    "/admin/handoff/{tenant_id}/{wa_id}/takeover",
    dependencies=[Depends(_require_internal_token)],
)
def handoff_takeover(tenant_id: str, wa_id: str) -> dict[str, str]:
    """Pause the bot so a human agent owns the conversation from now on."""
    from datetime import datetime, timezone

    from flow_engine.domain.models import Session

    session_repo = _state.get("session_repo")
    if session_repo is None:
        raise HTTPException(status_code=503, detail="Session repo not initialized")

    session = session_repo.load(tenant_id, wa_id)
    if session is None:
        session = Session.new(tenant_id, wa_id, datetime.now(timezone.utc).isoformat())

    session.state = "HUMAN_HANDOFF"
    session.flow_id = None
    session.current_node = None
    session.slots = {}
    session.retry_count = 0
    session_repo.save(session)
    logger.info("Conversation taken over via admin", extra={"tenant_id": tenant_id, "wa_id": wa_id})
    return {"status": "taken_over"}


@app.post(
    "/admin/handoff/{tenant_id}/{wa_id}/resume",
    dependencies=[Depends(_require_internal_token)],
)
def handoff_resume(tenant_id: str, wa_id: str) -> dict[str, str]:
    """Hand the conversation back to the bot (clear HUMAN_HANDOFF)."""
    session_repo = _state.get("session_repo")
    if session_repo is None:
        raise HTTPException(status_code=503, detail="Session repo not initialized")

    session = session_repo.load(tenant_id, wa_id)
    if session is None:
        return {"status": "no_session", "tenant_id": tenant_id, "wa_id": wa_id}

    session.state = "IDLE"
    session.flow_id = None
    session.current_node = None
    session.slots = {}
    session.retry_count = 0
    session_repo.save(session)
    logger.info("Handoff resumed via admin", extra={"tenant_id": tenant_id, "wa_id": wa_id})
    return {"status": "resumed"}


# ---------------------------------------------------------------------------
# Dependency health helpers
# ---------------------------------------------------------------------------


def _ping_redis() -> bool:
    client = _state.get("redis_client")
    if client is None:
        return False
    try:
        return client.ping()
    except Exception:
        return False


def _ping_postgres() -> bool:
    conn_str = _state.get("db_url", "")
    if not conn_str:
        return False
    try:
        import psycopg2
        with psycopg2.connect(conn_str, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False


def _ping_chromadb() -> bool:
    retriever = _state.get("chroma_retriever")
    if retriever is None:
        return False
    try:
        retriever._client.heartbeat()
        return True
    except Exception:
        return False
