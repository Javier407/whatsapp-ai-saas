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
  # Export key=value lines, skip comments and blanks.
  # The sed strips a UTF-8 BOM if present — Windows editors add one and it
  # breaks both the comment filter and the first sourced line.
  set -o allexport
  # shellcheck source=/dev/null
  source <(sed '1s/^\xEF\xBB\xBF//' "${ENV_FILE}" | grep -v '^\s*#' | grep -v '^\s*$')
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

COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# Prefer host psql; fall back to psql inside the postgres container so the
# script also works on machines without a local PostgreSQL client (Windows).
if command -v psql >/dev/null 2>&1; then
  run_migration() {
    psql \
      --host="${PGHOST}" \
      --port="${PGPORT}" \
      --username="${PGUSER}" \
      --dbname="${PGDATABASE}" \
      --variable=ON_ERROR_STOP=1 \
      --file="$1"
  }
else
  echo "psql not found on host — using psql inside the postgres container"
  run_migration() {
    docker compose -f "${COMPOSE_FILE}" exec -T postgres \
      psql --username="${PGUSER}" --dbname="${PGDATABASE}" \
      --variable=ON_ERROR_STOP=1 < "$1"
  }
fi

for migration in "${MIGRATIONS_DIR}"/*.sql; do
  filename="$(basename "${migration}")"
  echo "--> ${filename}"
  run_migration "${migration}"
  echo "    OK"
done

echo ""
echo "All migrations applied successfully."
