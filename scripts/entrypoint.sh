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

# Migrate & seed
npx prisma migrate deploy
node prisma/seed.mjs || true

# Start Next.js
npm run start
