#!/usr/bin/env bash
# Build the public demo (bandstand.info/songs and the rest): the real app,
# built with NEXT_PUBLIC_DEMO=1, run against a scratch database seeded with
# the demo band, signed in as its member Sam and saved page by page as
# static files. CI runs this on every push to main and publishes the result
# beside the product page, so the demo always matches the current UI.
#
#   DATABASE_URL=postgresql://…/demo scripts/demo.sh [out dir]   # default demo-out
#   make demo                                                    # the same, in Docker
#
# DATABASE_URL must point at a database this can wipe and refill.
set -euo pipefail
cd "$(dirname "$0")/.."

out=${1:-demo-out}
port=${DEMO_PORT:-3123}
: "${DATABASE_URL:?DATABASE_URL must point at a scratch database}"
export NEXT_PUBLIC_DEMO=1
export NEXTAUTH_URL=http://localhost:$port
export NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")}
# Its own build folder: `next dev` and `make build` share .next
export NEXT_DIST_DIR=.next-demo

npx prisma generate
npx prisma migrate deploy
npx tsx scripts/seed-demo.ts sam@example.com
password=$(npx tsx scripts/set-password.ts sam@example.com | sed 's/^[^:]*: //')

NODE_ENV=production npx next build
NODE_ENV=production npx next start -p "$port" &
server=$!
trap 'kill $server 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -fsS "http://localhost:$port/api/health" >/dev/null 2>&1 && break
  sleep 1
done

rm -rf "$out"
node scripts/demo/capture.mjs "http://localhost:$port" "$out" sam@example.com "$password"
mkdir -p "$out/_next"
cp -r .next-demo/static "$out/_next/static"
cp -r public/. "$out/"
rm -f "$out/sw.js"
cp scripts/demo/demo.js "$out/demo.js"
# Nothing in the capture may point back at the server it came from. (grep
# exits 1 for "none", 2 for a failed search: only 1 is a pass.)
status=0
grep -rlF "localhost:$port" "$out" >/tmp/demo-leaks.txt || status=$?
if [ "$status" -ne 1 ]; then
  echo "Captured files mention localhost:$port (or the check failed, $status):" >&2
  head /tmp/demo-leaks.txt >&2
  exit 1
fi
echo "Demo ready in $out"
