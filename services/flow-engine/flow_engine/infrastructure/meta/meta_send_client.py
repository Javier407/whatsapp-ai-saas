"""Meta Graph API client for sending WhatsApp messages.

Implements IMetaSendPort for both production and test/dry-run use cases.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from flow_engine.domain.ports import IMetaSendPort

logger = logging.getLogger(__name__)

_WA_TEXT_LIMIT = 4096


class MetaSendClient(IMetaSendPort):
    """Production client — POSTs to the Meta Graph API."""

    BASE_URL = "https://graph.facebook.com/v21.0"

    def send_text(
        self,
        phone_number_id: str,
        to: str,
        text: str,
        access_token: str,
    ) -> None:
        url = f"{self.BASE_URL}/{phone_number_id}/messages"
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"body": text[:_WA_TEXT_LIMIT]},
        }
        resp = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
        resp.raise_for_status()
        logger.debug(
            "Message sent",
            extra={"phone_number_id": phone_number_id, "to": to},
        )

    def send_interactive(
        self,
        phone_number_id: str,
        to: str,
        payload: dict[str, Any],
        access_token: str,
    ) -> None:
        url = f"{self.BASE_URL}/{phone_number_id}/messages"
        envelope: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            **payload,
        }
        resp = httpx.post(
            url,
            json=envelope,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )
        resp.raise_for_status()


class RecordingMetaSendClient(IMetaSendPort):
    """Test / dry-run client — records all outbound messages in memory."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def send_text(
        self,
        phone_number_id: str,
        to: str,
        text: str,
        access_token: str,
    ) -> None:
        self.sent.append({"type": "text", "to": to, "text": text})

    def send_interactive(
        self,
        phone_number_id: str,
        to: str,
        payload: dict[str, Any],
        access_token: str,
    ) -> None:
        self.sent.append({"type": "interactive", "to": to, "payload": payload})
