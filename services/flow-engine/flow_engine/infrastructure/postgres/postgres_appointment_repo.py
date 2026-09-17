"""Postgres-backed appointment repository.

Writes booked appointments and upserts the customer record. Every statement
runs inside a transaction with SET LOCAL app.tenant_id so RLS scopes the rows.
"""
from __future__ import annotations

import logging

import psycopg2
import psycopg2.extras

from flow_engine.domain.ports import IAppointmentRepo

logger = logging.getLogger(__name__)


class PostgresAppointmentRepo(IAppointmentRepo):
    def __init__(self, connection_string: str) -> None:
        self._conn_string = connection_string

    def _connect(self) -> psycopg2.extensions.connection:
        return psycopg2.connect(
            self._conn_string,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )

    def create(
        self,
        tenant_id: str,
        wa_id: str,
        customer_name: str | None,
        service: str | None,
        appointment_date: str | None,
    ) -> None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.tenant_id = %s", (tenant_id,))
                cur.execute(
                    """
                    INSERT INTO appointments
                        (tenant_id, wa_id, customer_name, service,
                         appointment_date, status)
                    VALUES (%s, %s, %s, %s, %s, 'pendiente')
                    """,
                    (tenant_id, wa_id, customer_name, service, appointment_date),
                )
                if customer_name:
                    cur.execute(
                        """
                        INSERT INTO customers (tenant_id, wa_id, name)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (tenant_id, wa_id)
                        DO UPDATE SET name = EXCLUDED.name, updated_at = now()
                        """,
                        (tenant_id, wa_id, customer_name),
                    )
            conn.commit()
