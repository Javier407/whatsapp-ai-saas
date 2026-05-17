#!/usr/bin/env python3
"""
infra/seed/seed.py
Cross-platform alternative to seed.sh — seeds a complete test environment.

Usage:
    python infra/seed/seed.py

Requires:
    pip install httpx
"""

import json
import os
import sys
import tempfile
import time
from pathlib import Path

try:
    import httpx
except ImportError:
    sys.exit("httpx is required: pip install httpx")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TENANT_API_URL = os.environ.get("TENANT_API_URL", "http://localhost:3001")
SEED_TIMEOUT = int(os.environ.get("SEED_TIMEOUT", "60"))

FAQ_CONTENT = [
    {
        "question": "What is your business?",
        "answer": "We are a test business showcasing the WhatsApp AI SaaS platform.",
    },
    {
        "question": "How can I get support?",
        "answer": "You can reach us by sending a message here or via email at support@test-business.com.",
    },
    {
        "question": "What are your business hours?",
        "answer": "We are available Monday to Friday, 9 AM to 6 PM UTC.",
    },
]

GREETING_FLOW = {
    "name": "Greeting Flow",
    "trigger": {
        "type": "keyword_match",
        "keywords": ["hello", "hi", "hola"],
    },
    "entry_node": "node_greet",
    "nodes": [
        {
            "node_key": "node_greet",
            "type": "message",
            "config": {"content": "Hello! I'm the test bot. How can I help you today?"},
            "transitions": [{"condition": {"type": "always"}, "next": "node_end"}],
        },
        {
            "node_key": "node_end",
            "type": "end",
            "config": {"content": "Thanks for testing! Type 'hello' to start again."},
            "transitions": [],
        },
    ],
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BOLD = "\033[1m"
RESET = "\033[0m"


def log_info(msg: str) -> None:
    print(f"  {CYAN}→{RESET} {msg}")


def log_success(msg: str) -> None:
    print(f"  {GREEN}✓{RESET} {msg}")


def log_error(msg: str) -> None:
    print(f"  {RED}✗{RESET} {msg}", file=sys.stderr)


def log_value(key: str, value: str) -> None:
    print(f"    {YELLOW}{key}{RESET}: {value}")


def die(msg: str) -> None:
    log_error(msg)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------
def main() -> None:
    print()
    print(f"{BOLD}==========================================")
    print("  WhatsApp AI SaaS — Dev Seed Script (Python)")
    print(f"=========================================={RESET}")
    print()

    client = httpx.Client(base_url=TENANT_API_URL, timeout=30.0)

    # -----------------------------------------------------------------------
    # Step 1: Register test tenant (or login if already exists)
    # -----------------------------------------------------------------------
    log_info("Step 1: Registering test tenant...")
    jwt_token: str = ""
    tenant_id: str = ""

    resp = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_name": "Test Business",
            "email": "admin@test-business.com",
            "password": "TestPassword123!",
        },
    )

    if resp.status_code == 201:
        data = resp.json()["data"]
        jwt_token = data["token"]
        tenant_id = data["tenant_id"]
        user_id = data["user_id"]
        log_success("Tenant registered")
    else:
        log_info(f"Register returned {resp.status_code} — trying login...")
        resp = client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin@test-business.com",
                "password": "TestPassword123!",
                "tenant_slug": "test-business",
            },
        )
        if resp.status_code != 200:
            die(f"Login failed ({resp.status_code}): {resp.text}")
        data = resp.json()["data"]
        jwt_token = data["token"]
        tenant_id = data["tenant_id"]
        user_id = "(from login)"
        log_success("Logged in to existing tenant")

    log_value("tenant_id", tenant_id)
    log_value("user_id", str(user_id))
    log_value("jwt_token", jwt_token[:40] + "...")
    print()

    auth_headers = {"Authorization": f"Bearer {jwt_token}"}

    # -----------------------------------------------------------------------
    # Step 2: Connect fake WhatsApp account
    # -----------------------------------------------------------------------
    log_info("Step 2: Connecting fake WhatsApp account...")
    resp = client.post(
        "/api/v1/tenant/whatsapp/connect",
        json={
            "waba_id": "test-waba-001",
            "phone_number_id": "test-phone-001",
            "access_token": "test-access-token",
        },
        headers=auth_headers,
    )
    if resp.status_code in (200, 201):
        log_success("WhatsApp account connected")
        log_value("phone_number_id", "test-phone-001")
        log_value("waba_id", "test-waba-001")
    else:
        log_info(f"WhatsApp connect returned {resp.status_code} (may already be connected)")
    print()

    # -----------------------------------------------------------------------
    # Step 3: Create and activate Greeting Flow
    # -----------------------------------------------------------------------
    log_info("Step 3: Creating Greeting Flow...")
    flow_id: str = ""
    resp = client.post("/api/v1/flows", json=GREETING_FLOW, headers=auth_headers)
    if resp.status_code not in (200, 201):
        log_error(f"Flow creation failed ({resp.status_code}): {resp.text}")
    else:
        flow_data = resp.json().get("data", {})
        flow_id = flow_data.get("id") or flow_data.get("flow_id", "")
        log_success("Flow created")
        log_value("flow_id", flow_id)

        log_info("  Activating flow...")
        resp_a = client.post(f"/api/v1/flows/{flow_id}/activate", headers=auth_headers)
        if resp_a.status_code == 200:
            log_success("Flow activated")
        else:
            log_info(f"Flow activate returned {resp_a.status_code}: {resp_a.text}")
    print()

    # -----------------------------------------------------------------------
    # Step 4: Upload sample KB document
    # -----------------------------------------------------------------------
    log_info("Step 4: Uploading FAQ knowledge base document...")
    doc_id: str = ""

    with tempfile.NamedTemporaryFile(
        suffix=".json", mode="w", delete=False, prefix="waas-seed-"
    ) as faq_file:
        json.dump(FAQ_CONTENT, faq_file)
        faq_path = faq_file.name

    try:
        with open(faq_path, "rb") as faq_file_rb:
            resp = client.post(
                "/api/v1/kb/documents",
                headers=auth_headers,
                files={"file": ("faq.json", faq_file_rb, "application/json")},
                data={"name": "FAQ", "source_type": "faq_json"},
            )
    finally:
        Path(faq_path).unlink(missing_ok=True)

    if resp.status_code not in (200, 201):
        log_error(f"KB upload failed ({resp.status_code}): {resp.text}")
    else:
        kb_data = resp.json().get("data", {})
        doc_id = kb_data.get("id") or kb_data.get("document_id", "")
        log_success("KB document uploaded")
        log_value("document_id", doc_id)
    print()

    # -----------------------------------------------------------------------
    # Step 5: Poll for indexing completion
    # -----------------------------------------------------------------------
    if doc_id:
        log_info(f"Step 5: Waiting for document to be indexed (timeout: {SEED_TIMEOUT}s)...")
        start = time.time()
        indexed = False
        while (time.time() - start) < SEED_TIMEOUT:
            resp = client.get("/api/v1/kb/documents", headers=auth_headers)
            if resp.status_code == 200:
                docs = resp.json().get("data", [])
                status = next(
                    (d["status"] for d in docs if d.get("id") == doc_id), "unknown"
                )
                elapsed = int(time.time() - start)
                print(f"    Status: {status} ({elapsed}s elapsed)")
                if status == "indexed":
                    indexed = True
                    break
                elif status == "failed":
                    log_error("Document indexing failed")
                    break
            time.sleep(5)

        if indexed:
            log_success("Document indexed successfully")
        else:
            log_info(
                f"Document not yet indexed after {SEED_TIMEOUT}s "
                "— rag-indexer may still be processing"
            )
        print()

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print(f"{BOLD}==========================================")
    print("  Seed complete — Manual testing info")
    print(f"=========================================={RESET}")
    print()
    print(f"  {CYAN}Tenant ID:{RESET}       {tenant_id}")
    print(f"  {CYAN}Flow ID:{RESET}         {flow_id or 'n/a'}")
    print(f"  {CYAN}KB Document ID:{RESET}  {doc_id or 'n/a'}")
    print()
    print(f"  {CYAN}JWT Token (12h):{RESET}")
    print(f"  {YELLOW}{jwt_token}{RESET}")
    print()
    print("  To test the dry-run endpoint:")
    print(
        f"  {YELLOW}curl -s -X POST {TENANT_API_URL}/api/v1/dry-run \\\n"
        f"    -H 'Authorization: Bearer <TOKEN>' \\\n"
        f"    -H 'Content-Type: application/json' \\\n"
        f"    -d '{{\"message\": \"hello\", \"simulated_wa_id\": \"manual-test-001\"}}'{RESET}"
    )
    print()
    print(f"  To send a signed test webhook:  {YELLOW}make test-webhook{RESET}")
    print()


if __name__ == "__main__":
    main()
