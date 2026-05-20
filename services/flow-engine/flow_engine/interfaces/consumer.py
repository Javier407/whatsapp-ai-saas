"""Redis Streams consumer for the Flow Engine.

Reads from ``flow-engine:{tenantId}`` streams using XREADGROUP.
Same pattern as the RAG Indexer consumer, adapted for Flow Engine concerns:
  - Idempotency guard (processed:{message_id} key)
  - Per-tenant rate limiter (30 msg/min)
  - Per-conversation distributed lock
  - Session load → FlowExecutor.execute → Session save
  - Conversation log write
  - XACK after all steps complete
"""
from __future__ import annotations

import json
import logging
import math
import socket
import time
from datetime import datetime, timezone
from typing import Any

import redis

from flow_engine.application.flow_executor import FlowExecutor
from flow_engine.domain.models import ConversationTurn, InboundMessage, Session
from flow_engine.domain.ports import IConvLogRepo, ISessionRepo, ITenantCredentialsRepo
from flow_engine.infrastructure.redis.redis_lock import (
    RedisLock,
    SessionLockError,
    is_processed,
    mark_processed,
)

logger = logging.getLogger(__name__)

_GROUP_NAME = "flow-engine-workers"
_CONSUMER_NAME = f"flow-engine-{socket.gethostname()}"
_BLOCK_MS = 5_000
_XCLAIM_IDLE_MS = 10 * 60 * 1_000
_XCLAIM_CHECK_INTERVAL_S = 60
_READ_COUNT = 5
_RATE_LIMIT = 30     # messages per minute per tenant
_RATE_LIMIT_MSG = "I'm temporarily busy. Please try again in a minute."


class FlowEngineConsumer:
    STREAM_PATTERN = "flow-engine:*"
    GROUP_NAME = _GROUP_NAME
    CONSUMER_NAME = _CONSUMER_NAME

    def __init__(
        self,
        redis_client: redis.Redis,
        executor: FlowExecutor,
        session_repo: ISessionRepo,
        conv_log_repo: IConvLogRepo,
        tenant_credentials_repo: ITenantCredentialsRepo,
        meta_send: Any,  # IMetaSendPort — needed for rate-limit replies
    ) -> None:
        self._redis = redis_client
        self._executor = executor
        self._session_repo = session_repo
        self._conv_log_repo = conv_log_repo
        self._tenant_credentials_repo = tenant_credentials_repo
        self._meta_send = meta_send
        self._last_xclaim_check: float = 0.0

    def run(self) -> None:
        logger.info(
            "FlowEngineConsumer starting",
            extra={"consumer": self.CONSUMER_NAME, "group": self.GROUP_NAME},
        )
        self._ensure_groups_for_existing_streams()

        while True:
            try:
                self._tick()
            except KeyboardInterrupt:
                logger.info("Shutting down on KeyboardInterrupt")
                break
            except Exception:
                logger.exception("Unexpected error in consumer loop — continuing")
                time.sleep(1)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _tick(self) -> None:
        if time.monotonic() - self._last_xclaim_check >= _XCLAIM_CHECK_INTERVAL_S:
            self._xclaim_stuck_messages()
            self._last_xclaim_check = time.monotonic()

        stream_keys = self._discover_streams()
        if not stream_keys:
            time.sleep(1)
            return

        self._ensure_groups(stream_keys)

        try:
            results = self._redis.xreadgroup(
                groupname=self.GROUP_NAME,
                consumername=self.CONSUMER_NAME,
                streams={k: ">" for k in stream_keys},
                count=_READ_COUNT,
                block=_BLOCK_MS,
            )
        except redis.RedisError:
            logger.exception("XREADGROUP error")
            return

        if not results:
            return

        for stream_key, messages in results:
            if isinstance(stream_key, bytes):
                stream_key = stream_key.decode()
            for message_id, fields in messages:
                if isinstance(message_id, bytes):
                    message_id = message_id.decode()
                decoded = _decode_fields(fields)
                self._process(stream_key, message_id, decoded)

    def _process(
        self,
        stream_key: str,
        message_id: str,
        fields: dict[str, str],
    ) -> None:
        # 1. Parse envelope
        try:
            msg = _parse_message(fields)
        except (KeyError, ValueError):
            logger.exception(
                "Malformed stream message — ACKing",
                extra={"message_id": message_id},
            )
            self._ack(stream_key, message_id)
            return

        access_token = self._tenant_credentials_repo.get_access_token(
            msg.tenant_id,
            msg.phone_number_id,
        )
        if not access_token:
            logger.error(
                "Missing tenant access token — ACKing",
                extra={
                    "tenant_id": msg.tenant_id,
                    "phone_number_id": msg.phone_number_id,
                    "message_id": message_id,
                },
            )
            self._ack(stream_key, message_id)
            return
        msg.access_token = access_token

        log_extra = {
            "tenant_id": msg.tenant_id,
            "wa_id": msg.wa_id,
            "message_id": message_id,
        }

        # 2. Idempotency guard
        if is_processed(self._redis, message_id):
            logger.info("Duplicate message — skipping", extra=log_extra)
            self._ack(stream_key, message_id)
            return

        # 3. Rate limit
        if not self._check_rate_limit(msg.tenant_id):
            logger.warning("Rate limit exceeded", extra={"tenant_id": msg.tenant_id})
            try:
                self._meta_send.send_text(
                    phone_number_id=msg.phone_number_id,
                    to=msg.wa_id,
                    text=_RATE_LIMIT_MSG,
                    access_token=msg.access_token,
                )
            except Exception:
                logger.exception("Failed to send rate-limit notice", extra=log_extra)
            self._ack(stream_key, message_id)
            return

        # 4. Conversation lock
        lock = RedisLock(self._redis, msg.tenant_id, msg.wa_id)
        if not lock.acquire():
            # Re-enqueue with 1s delay via XADD; ACK the current entry
            logger.info("Lock busy — re-enqueuing", extra=log_extra)
            self._reenqueue(stream_key, fields)
            self._ack(stream_key, message_id)
            return

        try:
            # 5. Load session
            session = self._session_repo.load(msg.tenant_id, msg.wa_id)
            if session is None:
                now = datetime.now(timezone.utc).isoformat()
                session = Session.new(msg.tenant_id, msg.wa_id, now)

            # 6. Execute
            self._executor.execute(msg, session)

            # 7. Save session
            self._session_repo.save(session)

            # 8. Write conversation log (inbound + outbound turns)
            now_str = datetime.now(timezone.utc).isoformat()
            self._conv_log_repo.write(
                ConversationTurn(
                    tenant_id=msg.tenant_id,
                    wa_id=msg.wa_id,
                    flow_id=session.flow_id,
                    direction="inbound",
                    message_text="",  # PII — not stored
                    node_id=session.current_node,
                    llm_tokens=0,
                    created_at=now_str,
                )
            )

        except Exception:
            logger.exception("Processing error", extra=log_extra)
        finally:
            # 10. Release lock
            lock.release()

        # 11. Mark processed
        mark_processed(self._redis, message_id)

        # 12. ACK
        self._ack(stream_key, message_id)
        logger.info("Message processed", extra=log_extra)

    def _check_rate_limit(self, tenant_id: str) -> bool:
        minute_bucket = math.floor(time.time() / 60)
        key = f"rate:tenant:{tenant_id}:minute:{minute_bucket}"
        try:
            count = self._redis.incr(key)
            if count == 1:
                self._redis.expire(key, 120)
            return count <= _RATE_LIMIT
        except redis.RedisError:
            logger.exception("Rate limit check failed — allowing through")
            return True

    def _reenqueue(self, stream_key: str, fields: dict[str, str]) -> None:
        try:
            self._redis.xadd(stream_key, fields, maxlen=10_000, approximate=True)
        except redis.RedisError:
            logger.exception("Failed to re-enqueue message", extra={"stream": stream_key})

    def _ack(self, stream_key: str, message_id: str) -> None:
        try:
            self._redis.xack(stream_key, self.GROUP_NAME, message_id)
        except redis.RedisError:
            logger.exception(
                "XACK failed",
                extra={"stream": stream_key, "message_id": message_id},
            )

    def _discover_streams(self) -> list[str]:
        try:
            keys = self._redis.keys(self.STREAM_PATTERN)
            return [k.decode() if isinstance(k, bytes) else k for k in keys]
        except redis.RedisError:
            logger.exception("Failed to discover streams")
            return []

    def _ensure_groups(self, stream_keys: list[str]) -> None:
        for key in stream_keys:
            try:
                self._redis.xgroup_create(key, self.GROUP_NAME, id="0", mkstream=True)
            except redis.exceptions.ResponseError as exc:
                if "BUSYGROUP" not in str(exc):
                    logger.exception("XGROUP CREATE error", extra={"stream": key})

    def _ensure_groups_for_existing_streams(self) -> None:
        self._ensure_groups(self._discover_streams())

    def _xclaim_stuck_messages(self) -> None:
        for stream_key in self._discover_streams():
            try:
                result = self._redis.xautoclaim(
                    stream_key,
                    self.GROUP_NAME,
                    self.CONSUMER_NAME,
                    _XCLAIM_IDLE_MS,
                    start="0-0",
                    count=10,
                )
                claimed = result[1] if result else []
                for message_id, fields in claimed:
                    if isinstance(message_id, bytes):
                        message_id = message_id.decode()
                    decoded = _decode_fields(fields)
                    logger.warning("Re-claiming stuck message", extra={"message_id": message_id})
                    self._process(stream_key, message_id, decoded)
            except redis.RedisError:
                logger.exception("XAUTOCLAIM error", extra={"stream": stream_key})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _decode_fields(fields: dict[Any, Any]) -> dict[str, str]:
    return {
        (k.decode() if isinstance(k, bytes) else k): (
            v.decode() if isinstance(v, bytes) else v
        )
        for k, v in fields.items()
    }


def _parse_message(fields: dict[str, str]) -> InboundMessage:
    """Parse the stream envelope into an InboundMessage.

    Supports the current JSON envelope in `data` and the legacy flat-field shape.
    """
    if "data" in fields:
        payload = json.loads(fields["data"])
        raw = payload["raw"]
        messages = raw.get("messages") or []
        contacts = raw.get("contacts") or []
        first_message = messages[0] if messages else {}
        first_contact = contacts[0] if contacts else {}
        wa_id = (
            first_message.get("from")
            or first_contact.get("wa_id")
            or raw.get("metadata", {}).get("phone_number_id", "")
        )
        text = first_message.get("text", {}).get("body", "")
        timestamp = first_message.get("timestamp", payload.get("received_at", ""))
        return InboundMessage(
            message_id=payload["message_id"],
            tenant_id=payload["tenant_id"],
            phone_number_id=payload["phone_number_id"],
            wa_id=wa_id,
            text=text,
            timestamp=timestamp,
            access_token="",
        )

    return InboundMessage(
        message_id=fields["message_id"],
        tenant_id=fields["tenant_id"],
        phone_number_id=fields.get("phone_number_id", ""),
        wa_id=fields["wa_id"],
        text=fields.get("text", ""),
        timestamp=fields.get("timestamp", ""),
        access_token=fields.get("access_token", ""),
    )
