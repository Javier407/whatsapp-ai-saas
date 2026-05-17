#!/usr/bin/env bash
# infra/e2e/test_webhook.sh
# Sends synthetic signed webhooks to the gateway and verifies the full pipeline.
# Requires: make dev && make migrate && make seed (to create test-phone-001 tenant).
#
# Usage:
#   APP_SECRET=<secret> WEBHOOK_VERIFY_TOKEN=<token> JWT_TOKEN=<jwt> bash infra/e2e/test_webhook.sh
#   make test-webhook

set -euo pipefail

trap 'rm -f /tmp/waas-webhook-*.tmp' EXIT

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
APP_SECRET="${APP_SECRET:-}"
WEBHOOK_VERIFY_TOKEN="${WEBHOOK_VERIFY_TOKEN:-}"
JWT_TOKEN="${JWT_TOKEN:-}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
TENANT_API_URL="${TENANT_API_URL:-http://localhost:3001}"
PHONE_NUMBER_ID="${PHONE_NUMBER_ID:-test-phone-001}"
WABA_ID="${WABA_ID:-test-waba-001}"
FLOW_TRIGGER_WAIT="${FLOW_TRIGGER_WAIT:-3}"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
if [ -z "$APP_SECRET" ]; then
  echo "ERROR: APP_SECRET env var is required." >&2
  echo "       Set it to match the META_APP_SECRET value in your infra/.env" >&2
  exit 1
fi
if [ -z "$WEBHOOK_VERIFY_TOKEN" ]; then
  echo "ERROR: WEBHOOK_VERIFY_TOKEN env var is required." >&2
  echo "       Set it to match META_VERIFY_TOKEN in your infra/.env" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
PASS=0
FAIL=0
FAILURES=()

GREEN='\033[32m'
RED='\033[31m'
YELLOW='\033[33m'
CYAN='\033[36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() {
  echo -e "  ${GREEN}✓${RESET} $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "  ${RED}✗${RESET} $1"
  [ -n "${2:-}" ] && echo -e "    ${YELLOW}→ ${2}${RESET}"
  FAIL=$((FAIL + 1))
  FAILURES+=("$1")
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "Expected HTTP ${expected}, got ${actual}"
  fi
}

assert_not_empty() {
  local value="$1"
  local label="$2"
  if [ -n "$value" ] && [ "$value" != "null" ] && [ "$value" != "{}" ]; then
    pass "$label"
  else
    fail "$label" "Value was empty or null: '${value}'"
  fi
}

# Build HMAC-SHA256 signature using openssl (works on Linux and macOS).
# Usage: sign_payload "$PAYLOAD" "$SECRET"
sign_payload() {
  local payload="$1"
  local secret="$2"
  echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}'
}

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}=========================================="
echo -e "  WhatsApp AI SaaS — Webhook E2E Tests"
echo -e "==========================================${RESET}"
echo ""
echo -e "  ${CYAN}Gateway URL:${RESET}      ${GATEWAY_URL}"
echo -e "  ${CYAN}Tenant API URL:${RESET}   ${TENANT_API_URL}"
echo -e "  ${CYAN}Phone Number ID:${RESET}  ${PHONE_NUMBER_ID}"
echo ""

# ---------------------------------------------------------------------------
# Test 1: Webhook verification handshake (GET)
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 1: Webhook verification handshake ---${RESET}"

CHALLENGE="test-challenge-$(date +%s)"
VERIFY_BODY=$(mktemp /tmp/waas-webhook-XXXXXX.tmp)
VERIFY_HTTP=$(curl -s \
  -o "$VERIFY_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  "${GATEWAY_URL}/webhook?hub.mode=subscribe&hub.verify_token=${WEBHOOK_VERIFY_TOKEN}&hub.challenge=${CHALLENGE}")

assert_equals "200" "$VERIFY_HTTP" "Webhook verification handshake returns 200"

VERIFY_BODY_CONTENT=$(cat "$VERIFY_BODY")
if echo "$VERIFY_BODY_CONTENT" | grep -q "$CHALLENGE"; then
  pass "Handshake response echoes the challenge token"
else
  fail "Handshake response echoes the challenge token" \
       "Response body did not contain '${CHALLENGE}': ${VERIFY_BODY_CONTENT}"
fi
rm -f "$VERIFY_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 2: Valid HMAC signed webhook — keyword trigger
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 2: Valid HMAC signed webhook (keyword: 'hello') ---${RESET}"

TS=$(date +%s)
PAYLOAD=$(cat <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${WABA_ID}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550001234",
          "phone_number_id": "${PHONE_NUMBER_ID}"
        },
        "messages": [{
          "from": "15559876543",
          "id": "wamid.test001-${TS}",
          "timestamp": "${TS}",
          "text": { "body": "hello" },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}
EOF
)

HMAC_SIG="sha256=$(sign_payload "$PAYLOAD" "$APP_SECRET")"

VALID_BODY=$(mktemp /tmp/waas-webhook-XXXXXX.tmp)
VALID_HTTP=$(curl -s \
  -o "$VALID_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  -X POST "${GATEWAY_URL}/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ${HMAC_SIG}" \
  -d "$PAYLOAD")

assert_equals "200" "$VALID_HTTP" "Valid HMAC signed webhook returns 200"
rm -f "$VALID_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 3: Invalid HMAC returns 403
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 3: Invalid HMAC signature returns 403 ---${RESET}"

BAD_BODY=$(mktemp /tmp/waas-webhook-XXXXXX.tmp)
BAD_HTTP=$(curl -s \
  -o "$BAD_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  -X POST "${GATEWAY_URL}/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
  -d "$PAYLOAD")

assert_equals "403" "$BAD_HTTP" "Webhook with invalid HMAC returns 403"
rm -f "$BAD_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 4: Wait for flow execution, verify via dry-run
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 4: Flow execution via dry-run after keyword webhook ---${RESET}"

echo "  Waiting ${FLOW_TRIGGER_WAIT}s for flow-engine to process the webhook..."
sleep "$FLOW_TRIGGER_WAIT"

if [ -z "$JWT_TOKEN" ]; then
  echo -e "  ${YELLOW}JWT_TOKEN not set — skipping dry-run verification.${RESET}"
  echo -e "  ${YELLOW}Run 'make seed' first and capture the JWT from the output.${RESET}"
  echo -e "  ${YELLOW}Then: JWT_TOKEN=<token> make test-webhook${RESET}"
else
  DR_BODY=$(mktemp /tmp/waas-webhook-XXXXXX.tmp)
  DR_HTTP=$(curl -s \
    -o "$DR_BODY" \
    -w "%{http_code}" \
    --max-time 15 \
    -X POST "${TENANT_API_URL}/api/v1/dry-run" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"hello\", \"simulated_wa_id\": \"verify-test-$(date +%s)\"}")

  assert_equals "200" "$DR_HTTP" "Dry-run endpoint returns 200"

  if [ "$DR_HTTP" = "200" ]; then
    DR_REPLY=$(cat "$DR_BODY" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  reply = d.get('data', {}).get('reply') or d.get('data', {}).get('response') or ''
  print(reply)
except Exception:
  print('')
" 2>/dev/null || echo "")
    assert_not_empty "$DR_REPLY" "Dry-run returns a non-empty reply from the flow"
    if [ -n "$DR_REPLY" ] && [ "$DR_REPLY" != "null" ]; then
      echo -e "    ${CYAN}Reply:${RESET} ${DR_REPLY}"
    fi
  fi
  rm -f "$DR_BODY"
fi
echo ""

# ---------------------------------------------------------------------------
# Test 5: Status update event (non-message) is silently ignored
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 5: Status update event is silently ignored ---${RESET}"

TS2=$(date +%s)
STATUS_PAYLOAD=$(cat <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "${WABA_ID}",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550001234",
          "phone_number_id": "${PHONE_NUMBER_ID}"
        },
        "statuses": [{
          "id": "wamid.status-${TS2}",
          "status": "delivered",
          "timestamp": "${TS2}",
          "recipient_id": "15559876543"
        }]
      },
      "field": "messages"
    }]
  }]
}
EOF
)

STATUS_HMAC="sha256=$(sign_payload "$STATUS_PAYLOAD" "$APP_SECRET")"

STATUS_BODY=$(mktemp /tmp/waas-webhook-XXXXXX.tmp)
STATUS_HTTP=$(curl -s \
  -o "$STATUS_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  -X POST "${GATEWAY_URL}/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ${STATUS_HMAC}" \
  -d "$STATUS_PAYLOAD")

assert_equals "200" "$STATUS_HTTP" "Status update webhook returns 200 (silently ignored)"
rm -f "$STATUS_BODY"
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "=========================================="
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}All ${TOTAL} webhook tests passed.${RESET}"
  echo "=========================================="
  echo ""
  exit 0
else
  echo -e "  ${GREEN}${PASS}/${TOTAL} passed${RESET}  ${RED}${FAIL}/${TOTAL} failed${RESET}"
  echo ""
  echo "  Failed tests:"
  for f in "${FAILURES[@]}"; do
    echo -e "    ${RED}✗${RESET} ${f}"
  done
  echo "=========================================="
  echo ""
  exit 1
fi
