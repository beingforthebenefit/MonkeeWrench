#!/usr/bin/env bash
set -euo pipefail

# Secrets nobody should have to make by hand. Given in the environment,
# they're used as they are; otherwise they're made once and kept in
# $BANDSTAND_DATA (a volume in selfhost/compose.yml), so sessions and push
# subscriptions survive a restart or an upgrade. Only on a volume: keys made
# in the container itself would change with every new container.
STATE="${BANDSTAND_DATA:-/data}"
if [[ -z "${NEXTAUTH_SECRET:-}" || -z "${VAPID_PUBLIC_KEY:-}" ]] &&
  grep -qs " $STATE " /proc/mounts && [[ -w "$STATE" ]]; then
  if [[ -z "${NEXTAUTH_SECRET:-}" ]]; then
    [[ -s "$STATE/session-secret" ]] ||
      (umask 077 && node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))' >"$STATE/session-secret")
    NEXTAUTH_SECRET=$(cat "$STATE/session-secret")
    export NEXTAUTH_SECRET
  fi
  if [[ -z "${VAPID_PUBLIC_KEY:-}" ]]; then
    [[ -s "$STATE/push-keys" ]] ||
      (umask 077 && node -e 'const k=require("web-push").generateVAPIDKeys();process.stdout.write(k.publicKey+"\n"+k.privateKey+"\n")' >"$STATE/push-keys")
    VAPID_PUBLIC_KEY=$(sed -n 1p "$STATE/push-keys")
    VAPID_PRIVATE_KEY=$(sed -n 2p "$STATE/push-keys")
    export VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY
  fi
fi

# Fail fast without the session secret (sign-in is email + password)
if [[ -z "${NEXTAUTH_SECRET:-}" ]]; then
  echo "ERROR: NEXTAUTH_SECRET is required (or a writable $STATE to keep one in)." >&2
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
# Apply migrations; handle known out-of-order rename migration if deploy fails
if ! npx prisma migrate deploy; then
  echo "Prisma migrate deploy failed; attempting targeted resolve for known rename migration..."
  npx prisma migrate resolve --applied 20250901175142_add_setlist_order || true
  npx prisma migrate deploy
fi
node prisma/seed.mjs || true

# Start Next in dev or prod mode
if [[ "${APP_ENV:-production}" == "development" ]]; then
  echo "Starting Next in DEV mode (hot reload)"
  exec npm run dev
else
  echo "Starting Next in PROD mode"
  exec npm run start
fi
