"""Tests for the Redis Streams consumer helpers."""
from __future__ import annotations

from flow_engine.interfaces.consumer import _parse_message


def test_parse_message_from_json_envelope() -> None:
    msg = _parse_message(
        {
            "data": (
                '{"message_id":"11111111-1111-1111-1111-111111111111",'
                '"received_at":"2026-05-20T16:54:01Z",'
                '"tenant_id":"22222222-2222-2222-2222-222222222222",'
                '"phone_number_id":"33333333-3333-3333-3333-333333333333",'
                '"raw":{"messaging_product":"whatsapp","metadata":{"phone_number_id":"33333333-3333-3333-3333-333333333333"},'
                '"contacts":[{"wa_id":"521234567890"}],'
                '"messages":[{"from":"521234567890","id":"wamid.test","timestamp":"1716224041","type":"text","text":{"body":"hola"}}]}}'
            )
        }
    )

    assert msg.message_id == "11111111-1111-1111-1111-111111111111"
    assert msg.tenant_id == "22222222-2222-2222-2222-222222222222"
    assert msg.phone_number_id == "33333333-3333-3333-3333-333333333333"
    assert msg.wa_id == "521234567890"
    assert msg.text == "hola"
    assert msg.timestamp == "1716224041"


def test_parse_message_legacy_flat_fields() -> None:
    msg = _parse_message(
        {
            "message_id": "m-1",
            "tenant_id": "t-1",
            "phone_number_id": "p-1",
            "wa_id": "521234567890",
            "text": "hello",
            "timestamp": "2026-05-20T16:54:01Z",
        }
    )

    assert msg.message_id == "m-1"
    assert msg.phone_number_id == "p-1"
    assert msg.text == "hello"
