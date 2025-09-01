#!/usr/bin/env bash
set -euo pipefail

# Fail fast if Google creds missing
if [[ -z "${GOOGLE_CLIENT_ID:-}" || -z "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  echo "ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required." >&2
  exit 1
fi

# Strip query part for tools that don't like it (optional, still useful)
CLEAN_URL="${DATABASE_URL%%\?*}"

# Wait for Postgres using psql (handles URI correctly)
until PGCONNECT_TIMEOUT=3 psql "$CLEAN_URL" -c 'select 1' >/dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 1
done

# In development, ensure dependencies and Prisma Client are up-to-date
if [[ "${APP_ENV:-production}" == "development" ]]; then
  if [[ ! -d node_modules || ! -f node_modules/.bin/next ]]; then
    echo "Installing dev dependencies (npm ci)"
    npm ci --no-audit --no-fund
  fi
  echo "Generating Prisma Client"
  npx prisma generate
fi

# Migrate & seed
npx prisma migrate deploy
node prisma/seed.mjs || true

# Start Next in dev or prod mode
if [[ "${APP_ENV:-production}" == "development" ]]; then
  echo "Starting Next in DEV mode (hot reload)"
  exec npm run dev
else
  echo "Starting Next in PROD mode"
  exec npm run start
fi
