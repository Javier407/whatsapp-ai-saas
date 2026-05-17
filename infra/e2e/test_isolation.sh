#!/usr/bin/env bash
# infra/e2e/test_isolation.sh
# Cross-tenant data isolation tests.
# Verifies that Tenant B cannot read or modify Tenant A's data.
#
# Usage: bash infra/e2e/test_isolation.sh
# Requires: make dev && make migrate

set -euo pipefail

trap 'rm -f /tmp/waas-isolation-*.tmp' EXIT

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TENANT_API_URL="${TENANT_API_URL:-http://localhost:3001}"

# Use unique suffixes so repeated runs do not conflict
RUN_ID="$(date +%s)"
TENANT_A_NAME="Isolation Test A ${RUN_ID}"
TENANT_A_EMAIL="tenant-a-${RUN_ID}@isolation-test.example"
TENANT_A_SLUG="tenant-a-${RUN_ID}"

TENANT_B_NAME="Isolation Test B ${RUN_ID}"
TENANT_B_EMAIL="tenant-b-${RUN_ID}@isolation-test.example"
TENANT_B_SLUG="tenant-b-${RUN_ID}"

PASSWORD="IsolationTest123!"

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

assert_http() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  local detail="${4:-}"
  if [ "$actual" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "Expected HTTP ${expected}, got ${actual}${detail:+ — }${detail}"
  fi
}

# Register a tenant and return JWT token via stdout.
# Usage: TOKEN=$(register_tenant "$name" "$email" "$password")
register_tenant() {
  local name="$1"
  local email="$2"
  local password="$3"
  local body_file
  body_file=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
  local http_code
  http_code=$(curl -s \
    -o "$body_file" \
    -w "%{http_code}" \
    --max-time 15 \
    -X POST "${TENANT_API_URL}/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_name\": \"${name}\", \"email\": \"${email}\", \"password\": \"${password}\"}")

  if [ "$http_code" != "201" ]; then
    echo "ERROR: Failed to register tenant '${name}' (HTTP ${http_code}): $(cat "$body_file")" >&2
    rm -f "$body_file"
    return 1
  fi
  cat "$body_file" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['token'])" 2>/dev/null
  rm -f "$body_file"
}

# Create a minimal flow and return its ID via stdout.
# Usage: FLOW_ID=$(create_flow "$JWT" "$flow_name")
create_flow() {
  local jwt="$1"
  local flow_name="$2"
  local body_file
  body_file=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
  local http_code
  http_code=$(curl -s \
    -o "$body_file" \
    -w "%{http_code}" \
    --max-time 15 \
    -X POST "${TENANT_API_URL}/api/v1/flows" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${jwt}" \
    -d "{
      \"name\": \"${flow_name}\",
      \"trigger\": {\"type\": \"keyword_match\", \"keywords\": [\"test-${RUN_ID}\"]},
      \"entry_node\": \"node_start\",
      \"nodes\": [
        {\"node_key\": \"node_start\", \"type\": \"end\", \"config\": {\"content\": \"done\"}, \"transitions\": []}
      ]
    }")

  if [ "$http_code" != "201" ] && [ "$http_code" != "200" ]; then
    echo "ERROR: Failed to create flow '${flow_name}' (HTTP ${http_code}): $(cat "$body_file")" >&2
    rm -f "$body_file"
    return 1
  fi
  cat "$body_file" | python3 -c "
import sys, json
d = json.load(sys.stdin)
fid = d.get('data', {}).get('id') or d.get('data', {}).get('flow_id', '')
print(fid)
" 2>/dev/null
  rm -f "$body_file"
}

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}=========================================="
echo -e "  WhatsApp AI SaaS — Isolation E2E Tests"
echo -e "==========================================${RESET}"
echo ""

# ---------------------------------------------------------------------------
# Setup: register two tenants
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Setup: Registering two isolated tenants ---${RESET}"
echo -e "  ${CYAN}Tenant A:${RESET} ${TENANT_A_EMAIL}"
echo -e "  ${CYAN}Tenant B:${RESET} ${TENANT_B_EMAIL}"
echo ""

log_info() { echo -e "  ${CYAN}→${RESET} $*"; }

log_info "Registering Tenant A..."
JWT_A=$(register_tenant "$TENANT_A_NAME" "$TENANT_A_EMAIL" "$PASSWORD") || {
  echo "FATAL: Could not register Tenant A" >&2
  exit 1
}
log_info "Registering Tenant B..."
JWT_B=$(register_tenant "$TENANT_B_NAME" "$TENANT_B_EMAIL" "$PASSWORD") || {
  echo "FATAL: Could not register Tenant B" >&2
  exit 1
}
echo -e "  ${GREEN}✓${RESET} Both tenants registered"
echo ""

# ---------------------------------------------------------------------------
# Create a flow for Tenant A and Tenant B
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Setup: Creating flows for each tenant ---${RESET}"
log_info "Creating flow for Tenant A..."
FLOW_A_ID=$(create_flow "$JWT_A" "Tenant A Flow ${RUN_ID}") || {
  echo "FATAL: Could not create Tenant A flow" >&2
  exit 1
}
log_info "Creating flow for Tenant B..."
FLOW_B_ID=$(create_flow "$JWT_B" "Tenant B Flow ${RUN_ID}") || {
  echo "FATAL: Could not create Tenant B flow" >&2
  exit 1
}
echo -e "  ${GREEN}✓${RESET} Tenant A flow: ${FLOW_A_ID}"
echo -e "  ${GREEN}✓${RESET} Tenant B flow: ${FLOW_B_ID}"
echo ""

# ---------------------------------------------------------------------------
# Setup: Upload KB document for Tenant A
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Setup: Uploading KB document for Tenant A ---${RESET}"
FAQ_FILE=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
echo '[{"question": "test", "answer": "answer for tenant A isolation test"}]' > "$FAQ_FILE"

KB_BODY=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
KB_HTTP=$(curl -s \
  -o "$KB_BODY" \
  -w "%{http_code}" \
  --max-time 15 \
  -X POST "${TENANT_API_URL}/api/v1/kb/documents" \
  -H "Authorization: Bearer ${JWT_A}" \
  -F "name=Tenant A FAQ" \
  -F "source_type=faq_json" \
  -F "file=@${FAQ_FILE};type=application/json")
rm -f "$FAQ_FILE"

DOC_A_ID=""
if [ "$KB_HTTP" = "201" ] || [ "$KB_HTTP" = "200" ]; then
  DOC_A_ID=$(cat "$KB_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('data', {}).get('id') or d.get('data', {}).get('document_id', ''))
" 2>/dev/null)
  echo -e "  ${GREEN}✓${RESET} KB document uploaded for Tenant A (ID: ${DOC_A_ID})"
else
  echo -e "  ${YELLOW}⚠${RESET} KB upload returned HTTP ${KB_HTTP} — skipping KB isolation checks"
fi
rm -f "$KB_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 1: Tenant B's flow list is empty (does not contain Tenant A's flows)
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 1: Tenant B list flows — cannot see Tenant A's flows ---${RESET}"

LIST_B_BODY=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
LIST_B_HTTP=$(curl -s \
  -o "$LIST_B_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  "${TENANT_API_URL}/api/v1/flows" \
  -H "Authorization: Bearer ${JWT_B}")

assert_http "200" "$LIST_B_HTTP" "Tenant B GET /flows returns 200"

if [ "$LIST_B_HTTP" = "200" ]; then
  FLOW_A_IN_B=$(cat "$LIST_B_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
flows = d.get('data', [])
flow_ids = [f.get('id', '') for f in flows]
# Check if Tenant A's flow_id appears in Tenant B's list
print('found' if '${FLOW_A_ID}' in flow_ids else 'not_found')
" 2>/dev/null || echo "error")

  if [ "$FLOW_A_IN_B" = "not_found" ]; then
    pass "Tenant B flow list does not contain Tenant A's flow (RLS working)"
  else
    fail "Tenant B flow list does not contain Tenant A's flow (RLS working)" \
         "Tenant A flow ${FLOW_A_ID} was visible to Tenant B — ISOLATION FAILURE"
  fi

  # Verify Tenant B can see their own flow
  FLOW_B_IN_B=$(cat "$LIST_B_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
flows = d.get('data', [])
flow_ids = [f.get('id', '') for f in flows]
print('found' if '${FLOW_B_ID}' in flow_ids else 'not_found')
" 2>/dev/null || echo "error")

  if [ "$FLOW_B_IN_B" = "found" ]; then
    pass "Tenant B can see their own flow (Tenant B flow ${FLOW_B_ID} in list)"
  else
    fail "Tenant B can see their own flow" \
         "Tenant B flow ${FLOW_B_ID} not in Tenant B's list — unexpected"
  fi
fi
rm -f "$LIST_B_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 2: Tenant B cannot access Tenant A's specific flow by ID (expect 404)
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 2: Tenant B cannot access Tenant A's flow by ID ---${RESET}"

FLOW_GET_BODY=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
FLOW_GET_HTTP=$(curl -s \
  -o "$FLOW_GET_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  "${TENANT_API_URL}/api/v1/flows/${FLOW_A_ID}" \
  -H "Authorization: Bearer ${JWT_B}")

assert_http "404" "$FLOW_GET_HTTP" \
  "Tenant B GET /flows/{tenant_a_flow_id} returns 404 (RLS blocks cross-tenant read)"
rm -f "$FLOW_GET_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 3: Tenant B cannot see Tenant A's KB documents
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 3: Tenant B cannot see Tenant A's KB documents ---${RESET}"

KB_LIST_B_BODY=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
KB_LIST_B_HTTP=$(curl -s \
  -o "$KB_LIST_B_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  "${TENANT_API_URL}/api/v1/kb/documents" \
  -H "Authorization: Bearer ${JWT_B}")

assert_http "200" "$KB_LIST_B_HTTP" "Tenant B GET /kb/documents returns 200"

if [ "$KB_LIST_B_HTTP" = "200" ] && [ -n "$DOC_A_ID" ]; then
  DOC_A_IN_B=$(cat "$KB_LIST_B_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
docs = d.get('data', [])
doc_ids = [doc.get('id', '') for doc in docs]
print('found' if '${DOC_A_ID}' in doc_ids else 'not_found')
" 2>/dev/null || echo "error")

  if [ "$DOC_A_IN_B" = "not_found" ]; then
    pass "Tenant B KB document list does not contain Tenant A's document (RLS working)"
  else
    fail "Tenant B KB document list does not contain Tenant A's document (RLS working)" \
         "Tenant A doc ${DOC_A_ID} visible to Tenant B — ISOLATION FAILURE"
  fi
fi
rm -f "$KB_LIST_B_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 4: Unauthenticated request returns 401
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 4: Unauthenticated requests return 401 ---${RESET}"

UNAUTH_FLOWS_BODY=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
UNAUTH_FLOWS_HTTP=$(curl -s \
  -o "$UNAUTH_FLOWS_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  "${TENANT_API_URL}/api/v1/flows")

assert_http "401" "$UNAUTH_FLOWS_HTTP" "GET /flows without auth returns 401"
rm -f "$UNAUTH_FLOWS_BODY"

UNAUTH_KB_BODY=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
UNAUTH_KB_HTTP=$(curl -s \
  -o "$UNAUTH_KB_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  "${TENANT_API_URL}/api/v1/kb/documents")

assert_http "401" "$UNAUTH_KB_HTTP" "GET /kb/documents without auth returns 401"
rm -f "$UNAUTH_KB_BODY"
echo ""

# ---------------------------------------------------------------------------
# Test 5: Tenant A can still access their own resources (sanity check)
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Test 5: Tenant A can still access their own data (sanity) ---${RESET}"

OWN_FLOW_BODY=$(mktemp /tmp/waas-isolation-XXXXXX.tmp)
OWN_FLOW_HTTP=$(curl -s \
  -o "$OWN_FLOW_BODY" \
  -w "%{http_code}" \
  --max-time 10 \
  "${TENANT_API_URL}/api/v1/flows/${FLOW_A_ID}" \
  -H "Authorization: Bearer ${JWT_A}")

assert_http "200" "$OWN_FLOW_HTTP" "Tenant A GET /flows/{own_flow_id} returns 200"
rm -f "$OWN_FLOW_BODY"
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "=========================================="
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}All ${TOTAL} isolation tests passed — cross-tenant RLS is working correctly.${RESET}"
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
  echo ""
  echo -e "  ${RED}WARNING: Isolation failures may indicate RLS misconfiguration.${RESET}"
  echo -e "  ${YELLOW}Check: infra/migrations/005_enable_rls.sql and Prisma RLS middleware.${RESET}"
  echo "=========================================="
  echo ""
  exit 1
fi
