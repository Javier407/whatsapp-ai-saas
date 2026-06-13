#!/usr/bin/env bash
# gen-env.sh — Bootstrap infra/.env.example and infra/.env with strong secrets
# -----------------------------------------------------------------------------
# Usage: bash infra/gen-env.sh
#
# 1. Renames infra/env.example → infra/.env.example (canonical committed name)
#    if the dotted file does not exist yet.
# 2. Creates infra/.env from the template, replacing every change_me
#    placeholder with `openssl rand -hex 32`.
# 3. Leaves OPENAI_API_KEY for you to fill in manually.
#
# Refuses to overwrite an existing infra/.env.
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_UNDOTTED="${SCRIPT_DIR}/env.example"
TEMPLATE="${SCRIPT_DIR}/.env.example"
ENV_FILE="${SCRIPT_DIR}/.env"

command -v openssl >/dev/null 2>&1 || {
  echo "ERROR: openssl is required to generate secrets." >&2
  exit 1
}

# Step 1: promote the undotted template to the canonical name
if [ ! -f "${TEMPLATE}" ]; then
  if [ -f "${TEMPLATE_UNDOTTED}" ]; then
    mv "${TEMPLATE_UNDOTTED}" "${TEMPLATE}"
    echo "Renamed env.example → .env.example"
  else
    echo "ERROR: neither ${TEMPLATE} nor ${TEMPLATE_UNDOTTED} found." >&2
    exit 1
  fi
fi

# Step 2: generate .env
if [ -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} already exists — refusing to overwrite." >&2
  echo "       Delete it first if you really want to regenerate secrets." >&2
  exit 1
fi

while IFS= read -r line; do
  case "${line}" in
    *=change_me*|*=sk-change-me*)
      key="${line%%=*}"
      if [ "${key}" = "OPENAI_API_KEY" ]; then
        printf '%s\n' "${line}"
      else
        printf '%s=%s\n' "${key}" "$(openssl rand -hex 32)"
      fi
      ;;
    *)
      printf '%s\n' "${line}"
      ;;
  esac
done < "${TEMPLATE}" > "${ENV_FILE}"

chmod 600 "${ENV_FILE}" 2>/dev/null || true

echo ""
echo "Created ${ENV_FILE} with generated secrets."
echo ""
echo "NEXT STEP (manual): edit infra/.env and set OPENAI_API_KEY to your real key."
