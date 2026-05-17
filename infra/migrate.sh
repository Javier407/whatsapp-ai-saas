#!/usr/bin/env bash
# migrate.sh — Run all SQL migrations in order via psql
# -------------------------------------------------------
# Usage: bash infra/migrate.sh
#
# Reads connection details from infra/.env (or environment variables).
# Migrations are run in filename order (001_, 002_, ...).
# Safe to re-run: each migration is idempotent (uses IF NOT EXISTS / DO blocks
# where needed), but running twice on the same DB will fail on duplicate
# CREATE statements unless the migration files use IF NOT EXISTS guards.
# -------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"

# Load .env if it exists
if [ -f "${ENV_FILE}" ]; then
  # Export key=value lines, skip comments and blanks
  set -o allexport
  # shellcheck source=/dev/null
  source <(grep -v '^\s*#' "${ENV_FILE}" | grep -v '^\s*$')
  set +o allexport
fi

# Connection parameters (can be overridden by environment)
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-whatsapp_saas}"
PGUSER="${PGUSER:-app_user}"
PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"

export PGPASSWORD

if [ -z "${PGPASSWORD}" ]; then
  echo "ERROR: POSTGRES_PASSWORD is not set. Export it or add it to infra/.env" >&2
  exit 1
fi

echo "Connecting to ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
echo "Running migrations from ${MIGRATIONS_DIR}/"
echo ""

for migration in "${MIGRATIONS_DIR}"/*.sql; do
  filename="$(basename "${migration}")"
  echo "--> ${filename}"
  psql \
    --host="${PGHOST}" \
    --port="${PGPORT}" \
    --username="${PGUSER}" \
    --dbname="${PGDATABASE}" \
    --variable=ON_ERROR_STOP=1 \
    --file="${migration}"
  echo "    OK"
done

echo ""
echo "All migrations applied successfully."
