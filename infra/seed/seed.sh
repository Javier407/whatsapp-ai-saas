#!/usr/bin/env bash
# infra/seed/seed.sh
# Seeds a complete test environment: tenant, WhatsApp connection, flow, and KB doc.
# Usage: bash infra/seed/seed.sh
# Requires the stack to be running (make dev && make migrate).

set -euo pipefail

trap 'rm -f /tmp/waas-seed-*.tmp' EXIT

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TENANT_API_URL="${TENANT_API_URL:-http://localhost:3001}"
TIMEOUT="${SEED_TIMEOUT:-60}"

GREEN='\033[32m'
RED='\033[31m'
YELLOW='\033[33m'
CYAN='\033[36m'
BOLD='\033[1m'
RESET='\033[0m'

log_info()    { echo -e "  ${CYAN}→${RESET} $*"; }
log_success() { echo -e "  ${GREEN}✓${RESET} $*"; }
log_error()   { echo -e "  ${RED}✗${RESET} $*" >&2; }
log_value()   { echo -e "    ${YELLOW}${1}${RESET}: ${2}"; }

die() {
  log_error "$*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_cmd curl
require_cmd jq

echo ""
echo -e "${BOLD}=========================================="
echo -e "  WhatsApp AI SaaS — Dev Seed Script"
echo -e "==========================================${RESET}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Register test tenant
# ---------------------------------------------------------------------------
log_info "Step 1: Registering test tenant..."

REGISTER_BODY=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
REGISTER_HTTP=$(curl -s \
  -o "$REGISTER_BODY" \
  -w "%{http_code}" \
  -X POST "${TENANT_API_URL}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Test Business",
    "email": "admin@test-business.com",
    "password": "TestPassword123!"
  }')

if [ "$REGISTER_HTTP" != "201" ]; then
  REGISTER_ERR=$(cat "$REGISTER_BODY")
  log_error "Register returned HTTP ${REGISTER_HTTP}"
  echo "  Response: ${REGISTER_ERR}"
  # Check if already exists — try login instead
  log_info "  Tenant may already exist, attempting login..."
  LOGIN_BODY=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
  LOGIN_HTTP=$(curl -s \
    -o "$LOGIN_BODY" \
    -w "%{http_code}" \
    -X POST "${TENANT_API_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@test-business.com",
      "password": "TestPassword123!",
      "tenant_slug": "test-business"
    }')
  if [ "$LOGIN_HTTP" != "200" ]; then
    die "Login also failed (HTTP ${LOGIN_HTTP}): $(cat "$LOGIN_BODY")"
  fi
  JWT_TOKEN=$(cat "$LOGIN_BODY" | jq -r '.data.token')
  TENANT_ID=$(cat "$LOGIN_BODY" | jq -r '.data.tenant_id')
  USER_ID="(from login)"
  log_success "Logged in to existing tenant"
else
  JWT_TOKEN=$(cat "$REGISTER_BODY" | jq -r '.data.token')
  TENANT_ID=$(cat "$REGISTER_BODY" | jq -r '.data.tenant_id')
  USER_ID=$(cat "$REGISTER_BODY" | jq -r '.data.user_id')
  log_success "Tenant registered"
fi

log_value "tenant_id" "$TENANT_ID"
log_value "user_id"   "$USER_ID"
log_value "jwt_token" "${JWT_TOKEN:0:40}..."
echo ""

# ---------------------------------------------------------------------------
# Step 2: Connect fake WhatsApp account
# ---------------------------------------------------------------------------
log_info "Step 2: Connecting fake WhatsApp account..."

WA_BODY=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
WA_HTTP=$(curl -s \
  -o "$WA_BODY" \
  -w "%{http_code}" \
  -X POST "${TENANT_API_URL}/api/v1/tenant/whatsapp/connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -d '{
    "waba_id": "test-waba-001",
    "phone_number_id": "test-phone-001",
    "access_token": "test-access-token"
  }')

if [ "$WA_HTTP" = "200" ] || [ "$WA_HTTP" = "201" ]; then
  log_success "WhatsApp account connected"
  log_value "phone_number_id" "test-phone-001"
  log_value "waba_id"         "test-waba-001"
else
  # Non-fatal: may already be connected
  log_info "WhatsApp connect returned HTTP ${WA_HTTP} (may already be connected)"
fi
echo ""

# ---------------------------------------------------------------------------
# Step 3: Create and activate Greeting Flow
# ---------------------------------------------------------------------------
log_info "Step 3: Creating Greeting Flow..."

FLOW_BODY=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
FLOW_HTTP=$(curl -s \
  -o "$FLOW_BODY" \
  -w "%{http_code}" \
  -X POST "${TENANT_API_URL}/api/v1/flows" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -d '{
    "name": "Greeting Flow",
    "trigger": {
      "type": "keyword_match",
      "keywords": ["hello", "hi", "hola"]
    },
    "entry_node": "node_greet",
    "nodes": [
      {
        "node_key": "node_greet",
        "type": "message",
        "config": {
          "content": "Hello! I'\''m the test bot. How can I help you today?"
        },
        "transitions": [
          { "condition": { "type": "always" }, "next": "node_end" }
        ]
      },
      {
        "node_key": "node_end",
        "type": "end",
        "config": {
          "content": "Thanks for testing! Type '\''hello'\'' to start again."
        },
        "transitions": []
      }
    ]
  }')

if [ "$FLOW_HTTP" != "201" ] && [ "$FLOW_HTTP" != "200" ]; then
  log_error "Flow creation failed (HTTP ${FLOW_HTTP}): $(cat "$FLOW_BODY")"
  FLOW_ID=""
else
  FLOW_ID=$(cat "$FLOW_BODY" | jq -r '.data.id // .data.flow_id // empty')
  log_success "Flow created"
  log_value "flow_id" "$FLOW_ID"

  # Activate the flow
  log_info "  Activating flow..."
  ACTIVATE_BODY=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
  ACTIVATE_HTTP=$(curl -s \
    -o "$ACTIVATE_BODY" \
    -w "%{http_code}" \
    -X POST "${TENANT_API_URL}/api/v1/flows/${FLOW_ID}/activate" \
    -H "Authorization: Bearer ${JWT_TOKEN}")
  if [ "$ACTIVATE_HTTP" = "200" ]; then
    log_success "Flow activated"
  else
    log_info "Flow activate returned HTTP ${ACTIVATE_HTTP}: $(cat "$ACTIVATE_BODY")"
  fi
fi
echo ""

# ---------------------------------------------------------------------------
# Step 4: Upload sample KB document
# ---------------------------------------------------------------------------
log_info "Step 4: Uploading FAQ knowledge base document..."

# Write FAQ JSON to temp file
FAQ_FILE=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
cat > "$FAQ_FILE" <<'FAQEOF'
[
  {
    "question": "What is your business?",
    "answer": "We are a test business showcasing the WhatsApp AI SaaS platform."
  },
  {
    "question": "How can I get support?",
    "answer": "You can reach us by sending a message here or via email at support@test-business.com."
  },
  {
    "question": "What are your business hours?",
    "answer": "We are available Monday to Friday, 9 AM to 6 PM UTC."
  }
]
FAQEOF

KB_BODY=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
KB_HTTP=$(curl -s \
  -o "$KB_BODY" \
  -w "%{http_code}" \
  -X POST "${TENANT_API_URL}/api/v1/kb/documents" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -F "name=FAQ" \
  -F "source_type=faq_json" \
  -F "file=@${FAQ_FILE};type=application/json")

if [ "$KB_HTTP" != "201" ] && [ "$KB_HTTP" != "200" ]; then
  log_error "KB upload failed (HTTP ${KB_HTTP}): $(cat "$KB_BODY")"
  DOC_ID=""
else
  DOC_ID=$(cat "$KB_BODY" | jq -r '.data.id // .data.document_id // empty')
  log_success "KB document uploaded"
  log_value "document_id" "$DOC_ID"
fi
echo ""

# ---------------------------------------------------------------------------
# Step 5: Poll for document indexing status
# ---------------------------------------------------------------------------
if [ -n "${DOC_ID:-}" ]; then
  log_info "Step 5: Waiting for document to be indexed (timeout: ${TIMEOUT}s)..."

  ELAPSED=0
  INDEXED=false
  while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    STATUS_BODY=$(mktemp /tmp/waas-seed-XXXXXX.tmp)
    STATUS_HTTP=$(curl -s \
      -o "$STATUS_BODY" \
      -w "%{http_code}" \
      "${TENANT_API_URL}/api/v1/kb/documents" \
      -H "Authorization: Bearer ${JWT_TOKEN}")

    if [ "$STATUS_HTTP" = "200" ]; then
      DOC_STATUS=$(cat "$STATUS_BODY" | jq -r \
        --arg id "$DOC_ID" \
        '.data[] | select(.id == $id) | .status' 2>/dev/null || echo "unknown")
      echo -e "    Status: ${DOC_STATUS} (${ELAPSED}s elapsed)"
      if [ "$DOC_STATUS" = "indexed" ]; then
        INDEXED=true
        break
      elif [ "$DOC_STATUS" = "failed" ]; then
        log_error "Document indexing failed"
        break
      fi
    fi

    sleep 5
    ELAPSED=$((ELAPSED + 5))
    rm -f "$STATUS_BODY"
  done

  if [ "$INDEXED" = true ]; then
    log_success "Document indexed successfully"
  else
    log_info "Document not yet indexed after ${TIMEOUT}s — rag-indexer may still be processing"
  fi
  echo ""
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo -e "${BOLD}=========================================="
echo -e "  Seed complete — Manual testing info"
echo -e "==========================================${RESET}"
echo ""
echo -e "  ${CYAN}Tenant ID:${RESET}       ${TENANT_ID}"
echo -e "  ${CYAN}Flow ID:${RESET}         ${FLOW_ID:-n/a}"
echo -e "  ${CYAN}KB Document ID:${RESET}  ${DOC_ID:-n/a}"
echo ""
echo -e "  ${CYAN}JWT Token (12h):${RESET}"
echo -e "  ${YELLOW}${JWT_TOKEN}${RESET}"
echo ""
echo -e "  To test the dry-run endpoint:"
echo -e "  ${YELLOW}curl -s -X POST ${TENANT_API_URL}/api/v1/dry-run \\"
echo -e "    -H 'Authorization: Bearer <TOKEN>' \\"
echo -e "    -H 'Content-Type: application/json' \\"
echo -e "    -d '{\"message\": \"hello\", \"simulated_wa_id\": \"manual-test-001\"}'${RESET}"
echo ""
echo -e "  To send a signed test webhook:  ${YELLOW}make test-webhook${RESET}"
echo ""
