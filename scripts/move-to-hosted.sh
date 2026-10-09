#!/usr/bin/env bash
# Move the popos install (members.monkeebusinessband.com, satchmo.gtodd.dev)
# onto the hosted service, keeping everything: accounts and passwords, bands,
# songs and every chart version, setlists, cues, rehearsals, photos, push
# subscriptions and sign-ins (the same NEXTAUTH_SECRET, so nobody is signed
# out). Rehearsed on 2026-10-09: every table count and the chart text
# checksum matched. docs/hosting.md, "Moving a self-hosted install".
#
#   scripts/move-to-hosted.sh deploy@204.168.168.2
#
# Run on popos, from the repo. It stops the popos app (so nothing changes
# mid-move) and leaves it stopped, with its database untouched: starting it
# again (docker start monkeewrench-app) is the way back. It REPLACES the
# hosted database, so run it before anyone else signs up there.
set -euo pipefail
cd "$(dirname "$0")/.."

server=${1:?usage: move-to-hosted.sh deploy@<server>}
ssh_() { ssh -o BatchMode=yes "$server" "$@"; }

echo "== 1. Settings shared with popos -> .env.hosted (sign-ins, push, Google)"
test -f .env.production && test -f .env.hosted
python3 - <<'EOF'
import re
keys = ['NEXTAUTH_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY',
        'VAPID_SUBJECT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
prod = dict(re.findall(r'^([A-Z_]+)=(.*)$', open('.env.production').read(), re.M))
lines = open('.env.hosted').read().splitlines()
seen = set()
for i, l in enumerate(lines):
    k = l.split('=', 1)[0]
    if k in keys and prod.get(k):
        lines[i] = f'{k}={prod[k]}'
        seen.add(k)
for k in keys:
    if k not in seen and prod.get(k):
        lines.append(f'{k}={prod[k]}')
open('.env.hosted', 'w').write('\n'.join(lines) + '\n')
print('   copied:', ', '.join(k for k in keys if prod.get(k)))
EOF
chmod 600 .env.hosted
scp -q .env.hosted "$server:Bandstand/.env.hosted"

echo "== 2. Update the hosted server (code and settings)"
ssh_ 'cd Bandstand && chmod 600 .env.hosted && make hosted-deploy'

echo "== 3. Stop the popos app (its database stays up, untouched)"
docker stop monkeewrench-app >/dev/null

dump=$(mktemp --suffix=.dump)
trap 'shred -u "$dump" 2>/dev/null || rm -f "$dump"' EXIT
echo "== 4. Dump popos, restore on the hosted server"
docker exec monkeewrench-db pg_dump -U monkee -d monkee -Fc --no-owner --no-privileges >"$dump"
scp -q "$dump" "$server:move.dump"
ssh_ 'set -e
  docker stop bandstand-app >/dev/null
  docker exec bandstand-db psql -q -U bandstand -d bandstand -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>&1 | grep -v "^NOTICE\|^DETAIL\|^drop cascades" || true
  docker exec -i bandstand-db pg_restore --no-owner --role=bandstand -U bandstand -d bandstand < move.dump
  shred -u move.dump
  docker start bandstand-app >/dev/null
  for i in $(seq 1 60); do
    [ "$(docker inspect -f "{{.State.Health.Status}}" bandstand-app)" = healthy ] && break
    sleep 3
  done
  docker inspect -f "   app: {{.State.Health.Status}}" bandstand-app'

echo "== 5. Compare"
sql=$(mktemp --suffix=.sql)
cat >"$sql" <<'SQL'
select 'bands', count(*) from "Band" union all
select 'users', count(*) from "User" union all
select 'memberships', count(*) from "Membership" union all
select 'songs', count(*) from "Song" union all
select 'chart versions', count(*) from "ChartVersion" union all
select 'setlists', count(*) from "Setlist" union all
select 'setlist items', count(*) from "SetlistItem" union all
select 'cues', count(*) from "Cue" union all
select 'rehearsals', count(*) from "Rehearsal" union all
select 'days off', count(*) from "Unavailability" union all
select 'proposals', count(*) from "Proposal" union all
select 'photos', count(*) from "Avatar" union all
select 'push devices', count(*) from "PushSubscription" union all
select 'activity', count(*) from "Activity";
select 'chart text', md5(string_agg(source, '' order by id)) from "ChartVersion";
SQL
here=$(docker exec -i monkeewrench-db psql -U monkee -d monkee -tA -F' ' <"$sql")
there=$(ssh_ 'docker exec -i bandstand-db psql -U bandstand -d bandstand -tA -F" "' <"$sql")
rm -f "$sql"
paste -d'|' <(echo "$here") <(echo "$there") | sed 's/^/   /; s/|/   |   /'
if [ -n "$here" ] && [ "$here" = "$there" ]; then
  echo "== Moved. Everything matches."
  echo "   Next: point the bands' DNS at the server (docs/hosting.md)."
else
  echo "== MISMATCH: leave DNS alone. Back to popos: docker start monkeewrench-app" >&2
  exit 1
fi
