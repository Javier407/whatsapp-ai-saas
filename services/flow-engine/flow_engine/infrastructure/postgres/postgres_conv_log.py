"""Postgres-backed conversation log repository.

Writes inbound and outbound turns to ``conversation_logs``.
Every INSERT runs inside a transaction with SET LOCAL app.tenant_id for RLS.
Message content is NEVER logged — only tenant_id, wa_id, message_id, direction,
node_id, and llm_tokens are written to Postgres.
"""
from __future__ import annotations

import logging

import psycopg2
import psycopg2.extras

from flow_engine.domain.models import ConversationTurn
from flow_engine.domain.ports import IConvLogRepo

logger = logging.getLogger(__name__)


class PostgresConvLogRepo(IConvLogRepo):
    def __init__(self, connection_string: str) -> None:
        self._conn_string = connection_string

    def _connect(self) -> psycopg2.extensions.connection:
        return psycopg2.connect(
            self._conn_string,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )

    def write(self, turn: ConversationTurn) -> None:
        try:
            with self._connect() as conn:
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL app.tenant_id = %s", (turn.tenant_id,))
                    cur.execute(
                        """
                        INSERT INTO conversation_logs
                            (tenant_id, wa_id, flow_id, direction,
                             node_id, llm_tokens, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            turn.tenant_id,
                            turn.wa_id,
                            turn.flow_id,
                            turn.direction,
                            turn.node_id,
                            turn.llm_tokens,
                            turn.created_at,
                        ),
                    )
                conn.commit()
        except Exception:
            # Logging failures must not crash the processing loop
            logger.exception(
                "Failed to write conversation log",
                extra={"tenant_id": turn.tenant_id, "wa_id": turn.wa_id},
            )
