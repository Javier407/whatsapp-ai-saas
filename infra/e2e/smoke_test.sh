#!/usr/bin/env bash
# infra/e2e/smoke_test.sh
# Smoke test: verifies all services are healthy after `make dev && make migrate`.
# Usage: bash infra/e2e/smoke_test.sh
# Exit 0 if all checks pass, 1 if any fail.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
TENANT_API_URL="${TENANT_API_URL:-http://localhost:3001}"
CHROMA_URL="${CHROMA_URL:-http://localhost:8000}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-whatsapp_saas}"
POSTGRES_USER="${POSTGRES_USER:-app_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
INTERNAL_TOKEN="${INTERNAL_API_TOKEN:-}"
RETRY_ATTEMPTS="${RETRY_ATTEMPTS:-30}"
RETRY_SLEEP="${RETRY_SLEEP:-2}"

# Detect compose container name prefix (project name)
COMPOSE_PROJECT="${COMPOSE_PROJECT:-whatsapp-ai-saas}"
FLOW_ENGINE_CONTAINER="${COMPOSE_PROJECT}-flow-engine-1"
REDIS_CONTAINER="${COMPOSE_PROJECT}-redis-1"

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
PASS=0
FAIL=0
FAILURES=()

trap 'rm -f /tmp/waas-smoke-*.tmp' EXIT

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
GREEN='\033[32m'
RED='\033[31m'
YELLOW='\033[33m'
RESET='\033[0m'

pass() {
  local label="$1"
  echo -e "  ${GREEN}✓${RESET} ${label}"
  PASS=$((PASS + 1))
}

fail() {
  local label="$1"
  local detail="${2:-}"
  echo -e "  ${RED}✗${RESET} ${label}"
  [ -n "$detail" ] && echo -e "    ${YELLOW}→ ${detail}${RESET}"
  FAIL=$((FAIL + 1))
  FAILURES+=("$label")
}

# Poll a URL until it returns 200 or retries exhaust.
# Usage: wait_for_url <label> <url> [retries] [sleep]
wait_for_url() {
  local label="$1"
  local url="$2"
  local retries="${3:-$RETRY_ATTEMPTS}"
  local sleep_s="${4:-$RETRY_SLEEP}"

  echo "  Waiting for ${label} (${url})..."
  local i=0
  while [ "$i" -lt "$retries" ]; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    if [ "$code" = "200" ]; then
      return 0
    fi
    i=$((i + 1))
    sleep "$sleep_s"
  done
  return 1
}

check_http() {
  local label="$1"
  local url="$2"
  local body_file
  body_file=$(mktemp /tmp/waas-smoke-XXXXXX.tmp)
  local code
  code=$(curl -s -o "$body_file" -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    pass "$label"
  else
    fail "$label" "HTTP $code from $url"
  fi
  rm -f "$body_file"
}

# ---------------------------------------------------------------------------
# Pre-flight: wait for services to become healthy
# ---------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  WhatsApp AI SaaS — Smoke Tests"
echo "=========================================="
echo ""
echo "--- Waiting for services ---"

if wait_for_url "gateway /healthz" "${GATEWAY_URL}/healthz"; then
  echo "  Gateway is up."
else
  echo -e "  ${RED}Gateway did not become healthy within timeout.${RESET}"
fi

if wait_for_url "tenant-api /api/v1/health" "${TENANT_API_URL}/api/v1/health"; then
  echo "  Tenant API is up."
else
  echo -e "  ${RED}Tenant API did not become healthy within timeout.${RESET}"
fi

echo ""
echo "--- Running checks ---"

# ---------------------------------------------------------------------------
# Check 1: Gateway /healthz
# ---------------------------------------------------------------------------
check_http "Gateway /healthz returns 200" "${GATEWAY_URL}/healthz"

# ---------------------------------------------------------------------------
# Check 2: Tenant API /api/v1/health
# ---------------------------------------------------------------------------
check_http "Tenant API /api/v1/health returns 200" "${TENANT_API_URL}/api/v1/health"

# ---------------------------------------------------------------------------
# Check 3: Flow engine admin health (via docker exec)
# ---------------------------------------------------------------------------
echo -n "  Checking flow-engine admin /admin/health... "
if docker exec "${FLOW_ENGINE_CONTAINER}" \
    curl -s -f \
    -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
    http://localhost:8001/admin/health > /tmp/waas-smoke-fe.tmp 2>&1; then
  pass "Flow engine /admin/health reachable via docker exec"
else
  fail "Flow engine /admin/health reachable via docker exec" \
       "Container: ${FLOW_ENGINE_CONTAINER} — is the stack running? (make dev)"
fi
rm -f /tmp/waas-smoke-fe.tmp

# ---------------------------------------------------------------------------
# Check 4: PostgreSQL migrations — verify 'tenants' table exists
# ---------------------------------------------------------------------------
echo -n "  Checking PostgreSQL migrations (tenants table)... "
if PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants';" \
    2>/dev/null | grep -q 1; then
  pass "PostgreSQL migrations ran (tenants table exists)"
else
  # Fallback: try via docker exec
  if docker exec "${COMPOSE_PROJECT}-postgres-1" \
      psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
      -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants';" \
      2>/dev/null | grep -q 1; then
    pass "PostgreSQL migrations ran (tenants table exists, via docker exec)"
  else
    fail "PostgreSQL migrations ran (tenants table exists)" \
         "Run 'make migrate' first"
  fi
fi

# ---------------------------------------------------------------------------
# Check 5: Redis responsiveness (PING via docker exec)
# ---------------------------------------------------------------------------
echo -n "  Checking Redis... "
if docker exec "${REDIS_CONTAINER}" \
    redis-cli ping 2>/dev/null | grep -q "PONG"; then
  pass "Redis responds to PING"
else
  fail "Redis responds to PING" "Container: ${REDIS_CONTAINER}"
fi

# ---------------------------------------------------------------------------
# Check 6: ChromaDB /api/v1/heartbeat
# ---------------------------------------------------------------------------
check_http "ChromaDB /api/v1/heartbeat returns 200" "${CHROMA_URL}/api/v1/heartbeat"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=========================================="
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}All ${TOTAL} checks passed.${RESET}"
  echo "=========================================="
  echo ""
  exit 0
else
  echo -e "  ${GREEN}${PASS}/${TOTAL} passed${RESET}  ${RED}${FAIL}/${TOTAL} failed${RESET}"
  echo ""
  echo "  Failed checks:"
  for f in "${FAILURES[@]}"; do
    echo -e "    ${RED}✗${RESET} ${f}"
  done
  echo "=========================================="
  echo ""
  exit 1
fi
