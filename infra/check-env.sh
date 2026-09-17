#!/usr/bin/env bash
# check-env.sh — Validate infra/.env completeness WITHOUT printing any values
# -----------------------------------------------------------------------------
# Usage: bash infra/check-env.sh
#
# Checks that every variable required at service startup is present, non-empty,
# and not a placeholder. Only key names and statuses are printed — never values.
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found. Bootstrap it with: bash infra/gen-env.sh" >&2
  exit 1
fi

REQUIRED=(
  POSTGRES_PASSWORD
  REDIS_GATEWAY_PASSWORD
  REDIS_FLOW_ENGINE_PASSWORD
  REDIS_TENANT_API_PASSWORD
  REDIS_RAG_INDEXER_PASSWORD
  REDIS_DEFAULT_PASSWORD
  MINIO_ROOT_USER
  MINIO_ROOT_PASSWORD
  META_APP_SECRET
  META_VERIFY_TOKEN
  JWT_SECRET
  MASTER_KEY
  INTERNAL_API_TOKEN
  OPENAI_API_KEY
)

fail=0

for key in "${REQUIRED[@]}"; do
  line="$(grep -E "^${key}=" "${ENV_FILE}" | head -1 || true)"
  if [ -z "${line}" ]; then
    echo "MISSING:     ${key}"
    fail=1
    continue
  fi
  value="${line#*=}"
  if [ -z "${value}" ]; then
    echo "EMPTY:       ${key}"
    fail=1
    continue
  fi
  case "${value}" in
    *change_me*|*changeme*|*CHANGE_ME*|sk-change-me|your_*|YOUR_*|"<"*">")
      echo "PLACEHOLDER: ${key}"
      fail=1
      ;;
  esac
done

# tenant-api enforces minimum lengths at startup — catch it here instead
for key in JWT_SECRET MASTER_KEY; do
  line="$(grep -E "^${key}=" "${ENV_FILE}" | head -1 || true)"
  value="${line#*=}"
  if [ -n "${value}" ] && [ "${#value}" -lt 32 ]; then
    echo "TOO SHORT:   ${key} (min 32 chars)"
    fail=1
  fi
done

echo ""
if [ "${fail}" -eq 0 ]; then
  echo "OK: infra/.env has every required variable set."
else
  echo "Fix the entries above in infra/.env, then re-run this check."
  exit 1
fi
