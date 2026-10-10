# The hosted service (app.bandstand.info)

Anyone can start a band at `app.bandstand.info/start`. It's free for 30 days,
then $12 a year per band, paid through Polar. A band that stops paying becomes
read-only; nothing is deleted.

It is this same app, run with `BANDSTAND_HOSTED=1` on its own server. A
self-hosted install never sets that, so none of this applies to it.

| Piece     | What                                                         | Costs                                         |
| --------- | ------------------------------------------------------------ | --------------------------------------------- |
| Server    | Hetzner Cloud CX23 (2 vCPU, 4 GB), Germany or Finland        | ≈ €5.49 + €0.50 IPv4 + 20% backups ≈ $8.40/mo |
| HTTPS     | Caddy (in the compose file), Let's Encrypt                   | free                                          |
| Email out | SMTP2GO, free plan (1,000 emails a month)                    | free                                          |
| Email in  | Squarespace email forwarding (hello@, copyright@)            | free                                          |
| Payments  | Polar, merchant of record (sales tax/VAT handled)            | 5% + 50¢ per charge (+1.5% non-US cards)      |
| Backups   | nightly `pg_dump` (14 kept) + Hetzner's daily server backups | included above                                |

Break-even is about 13 paying bands.

## How it works

- **Sign-up** (`/start`) creates the band, sets its `paidUntil` to 30 days from
  now, and makes the person who started it the band's admin. They are never
  made the install's owner. They get an email with a link to choose their
  password; the same link proves the address is theirs.
- **Emailed links** (`src/lib/email-tokens.ts`) cover three cases: the welcome
  after sign-up, an invite (an admin adds someone on Members), and a password
  reset (`/forgot`). Each link works once. Welcome and invite links last 7 days;
  reset links last an hour.
- **Billing** (`src/lib/billing.ts`):
  - On Admin → Subscription, an admin clicks Subscribe and goes to Polar's
    checkout. The checkout carries the band's id.
  - Polar's webhooks then set `paidUntil` to the end of the paid year plus 7
    days of grace while a renewal retries.
  - "Card, receipts and cancelling" opens Polar's customer portal.
- **Read-only** (`src/lib/guard.ts`): once `paidUntil` has passed, every API
  request that would change something gets a 402 with an explanation. Reading,
  performing and PDFs still work, as does renewing. A strip on every page tells
  the band, and points the admin to Renew.
- **Bands that are never billed** have `paidUntil = null`: the owner's own band,
  and any band waived with `scripts/comp-band.ts`.

## Setting it up

Do these in order. Put every secret in Bitwarden as you create it.

### 1. Polar (payments): sandbox first

Polar has a separate sandbox (`sandbox.polar.sh`, test cards, no real money)
and production (`polar.sh`). Set both up the same way. Run on the sandbox until
a test subscription has gone through end to end.

1. Sign up at <https://sandbox.polar.sh>, and create an organization named
   **Bandstand**.
2. **Products → New product**:
   - Name: "Bandstand: one band". Description: "Charts, setlists and rehearsals
     for your whole band, for a year."
   - Pricing: **Recurring, yearly, $12 USD, fixed price**.
   - Save, then copy the product's **ID** (a UUID) → `POLAR_PRODUCT_ID`.
3. **Settings → Developers → New token** (an organization access token):
   - Scopes: `checkouts:write` and `customer_sessions:write`.
   - Copy the token → `POLAR_ACCESS_TOKEN`.
4. **Settings → Webhooks → Add endpoint**:
   - URL: `https://app.bandstand.info/api/billing/webhook`
   - Format: **Raw**
   - Events: `subscription.created`, `subscription.active`,
     `subscription.updated`, `subscription.canceled`,
     `subscription.uncanceled`, `subscription.revoked`,
     `subscription.past_due`.
   - Copy the signing secret (`whsec_…`) → `POLAR_WEBHOOK_SECRET`.
5. **Settings → General**: add the logo (`public/icons/default-512.png`), and
   set the website to `https://bandstand.info`. Polar links the Terms and
   Privacy pages at checkout.
6. Later, on **production** <https://polar.sh>: repeat steps 1–5. Then:
   - **Finance → Payouts**: connect a Stripe account and verify your identity,
     so Polar can pay you.
   - Pay out every few months rather than monthly. Each month with a payout
     costs $2.
   - Polar may review a new organization before its first real payment, and
     will want to see the product page, terms and privacy pages live. They go
     live when the `hosted` branch is merged (step 8).

### 2. Hetzner (the server)

1. Sign up at <https://www.hetzner.com/cloud>. Hetzner may ask for ID
   verification.
2. New project **Bandstand** → **Add server**:
   - Location: Falkenstein, Nuremberg or Helsinki.
   - Image: **Ubuntu 24.04**.
   - Type: Shared vCPU, **x86, CX23**. If it's sold out, **CAX11** (Arm) also
     works: the image builds on Arm.
   - Networking: public IPv4 and IPv6.
   - SSH key: paste your `~/.ssh/id_ed25519.pub`.
   - **Backups: on.** That's daily server snapshots, 7 kept, which also carry
     `./backups` off the machine.
   - Firewall: create one allowing inbound **TCP 22, 80, 443** and **UDP 443**.
   - Name: `bandstand-1`.
3. Note the server's IPv4 and IPv6 addresses.

### 3. DNS (Squarespace, where bandstand.info lives)

Squarespace → Domains → bandstand.info → **DNS settings** → add:

| Type | Host  | Data              |
| ---- | ----- | ----------------- |
| A    | `app` | the server's IPv4 |
| AAAA | `app` | the server's IPv6 |

Leave the existing GitHub Pages records alone; the product page and the demo
stay on Pages.

### 4. Email

**Sending (SMTP2GO):**

1. Sign up at <https://www.smtp2go.com> (free plan).
2. **Sending → Verified Senders → Sender Domains → Add** `bandstand.info`.
   SMTP2GO shows three CNAME records. Add them in Squarespace DNS, then click
   **Verify**. That lets mail from `@bandstand.info` pass SPF and DKIM, so it
   doesn't land in spam.
3. **Sending → SMTP Users → Add SMTP User** (e.g. `bandstand-app`). Copy the
   username and password → `SMTP_USER`, `SMTP_PASS`.

**Receiving (Squarespace forwarding):** Squarespace → Domains → bandstand.info
→ **Email → Email forwarding**. Forward `hello@` and `copyright@` to your own
inbox. Both addresses appear on the site and in the emails, so send each one a
test message.

### 5. The server

```bash
ssh root@<server ip>
apt update && apt -y upgrade
apt -y install git make unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades   # security patches, automatic
curl -fsSL https://get.docker.com | sh

# A user to run it as, with your SSH key
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
exit

ssh deploy@<server ip>
git clone https://github.com/beingforthebenefit/Bandstand.git
cd Bandstand
git checkout hosted       # until it's merged (step 8); main after that
cp .env.hosted.example .env.hosted
nano .env.hosted
```

Fill in `.env.hosted`:

- `ACME_EMAIL`: your email (Let's Encrypt's expiry warnings).
- `POSTGRES_PASSWORD`: `openssl rand -hex 24`
- `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- `SMTP_USER`, `SMTP_PASS`: from step 4.
- `POLAR_*`: the **sandbox** values from step 1, with `POLAR_SERVER=sandbox`.
- `VAPID_*` (push notifications): `docker run --rm node:20-alpine npx -y web-push generate-vapid-keys`

Then:

```bash
chmod 600 .env.hosted
make hosted-deploy        # builds, starts, waits for /api/health
curl https://app.bandstand.info/api/health   # {"ok":true,...}
```

Caddy gets the certificate on the first request; DNS from step 3 must already
point at the server.

### 6. You, as the install's owner

Open `https://app.bandstand.info`: a fresh install shows **Set up
Bandstand**. Your band, name, email and password; you're signed straight in.
That first account owns the install: it sees every band under Admin → All
bands and on `/owner`. The band started there is never billed. (From the
command line instead: `scripts/create-band.ts`, then
`scripts/set-password.ts`, inside the app container.)

### 7. Try it end to end (sandbox)

1. In a private window, go to `https://app.bandstand.info/start` and start a
   band with a second email address of yours.
2. The welcome email arrives: set a password and you land in the band. Admin
   shows "Free trial: 30 days left".
3. Members → add yourself under a third address: the invite email arrives.
4. Admin → **Subscribe**. Pay with Polar's test card: `4242 4242 4242 4242`,
   any future date, any CVC. Back on Admin, it shows "Subscribed … Paid until"
   within a minute. If it doesn't, check Polar → Webhooks → deliveries.
5. **Card, receipts and cancelling** → cancel. Admin says "Cancelled: paid
   until …".
6. Optional, to see read-only: on the server, run
   `docker exec bandstand-app npx tsx scripts/comp-band.ts <that band's slug> 2020-01-01`.
   The band goes read-only. Run it again with no date to free it.

### 8. Go live

1. Merge the `hosted` branch into `main`. CI then publishes the pricing section
   and the Terms, Privacy and Copyright pages on bandstand.info.
2. On the server: `git checkout main`. Switch `.env.hosted` to the
   **production** Polar values and empty `POLAR_SERVER`. Then run
   `make hosted-deploy`.
3. Register a DMCA agent at <https://dmca.copyright.gov> ($6, renewed every 3
   years), with `copyright@bandstand.info`. This is what protects a host from
   liability for what users upload. The directory is public, so use a business
   address or PO box rather than your home.
4. Add an Uptime Kuma monitor (on the macmini): HTTP(s) keyword,
   `https://app.bandstand.info/api/health`, keyword `"ok":true`.

## Deploys

Automatic. When CI's tests pass on a push to `main`, CI builds and
publishes the image (`ghcr.io/beingforthebenefit/bandstand:sha-<commit>`),
then the `deploy-hosted` job connects to the server and it updates itself.
That's `make hosted-deploy`: pull the code, pull that commit's image (or
build one, if there's none: a branch CI doesn't publish, or GitHub down),
restart, keep the three newest images for going back, wait for
`/api/health`. Going back a version by hand: `BANDSTAND_TAG=sha-<older>
docker compose -f docker-compose.hosted.yml --env-file .env.hosted up -d
app`. It only
deploys the branch the server runs (`git -C ~/Bandstand branch` there); a
push to any other branch is a no-op. A failed deploy fails the CI run, and
GitHub emails you.

What makes it safe:

- **The key.** CI uses its own SSH key (GitHub secret `DEPLOY_SSH_KEY`).
  `~/.ssh/authorized_keys` on the server restricts it to
  `command="/home/deploy/ci-deploy",restrict`. With that key, the server runs
  `~/ci-deploy` and nothing else: no shell, no tunnels. Tested: a command, a
  shell and a tunnel were all refused.
- **The script.** `~/ci-deploy` is a copy of `deploy/ci-deploy.sh`, outside
  the repo, so a commit can't change what the key may run. After editing
  `deploy/ci-deploy.sh`, copy it over yourself:
  `scp deploy/ci-deploy.sh deploy@204.168.168.2:ci-deploy`.
- **The server.** Its host key is pinned (`DEPLOY_KNOWN_HOSTS`), so CI talks
  to this server and no other.

To revoke: delete the `github-deploy@bandstand` line from
`~/.ssh/authorized_keys` on the server. To replace the key: make a new one
and store it with
`gh secret set DEPLOY_SSH_KEY < key`, then put its `.pub` on that line.

## The owner page

`/owner` (Owner, in the account menu), for the install's owner only:

- **Numbers:** bands by standing, yearly revenue before and after Polar
  against the running costs (`src/lib/owner-stats.ts` holds the costs and
  fee figures), trial conversion, churn, renewals due, bands active in the
  last 30 days, and sign-ups a week.
- **Bands:** rename, make free or set a paid-until date, delete (type the
  name).
- **People:** find, correct name or email, email a password link, delete,
  and add someone to any band.
- **Test emails:** one of each email, to the owner only.

It shows names and counts, never a band's charts. Polar remains the record
of actual money; the page links to it. History (what Polar reported, when)
accumulates in `BillingEvent` from the webhooks.

## Running it

- **Update:** automatic on every push that passes CI (see Deploys). By hand:
  `make hosted-deploy` on the server.
- **Logs:** `make hosted-logs`. **Database:** `make hosted-psql`.
- **Waive a band:** `docker exec bandstand-app npx tsx scripts/comp-band.ts <slug>`
  makes it free for good; add a date (`YYYY-MM-DD`) to make it free until then.
- **Backups:** `./backups/bandstand-YYYY-MM-DD.dump`, written nightly at 03:30
  UTC, 14 kept. Hetzner's daily snapshots copy them off the machine. To
  restore:

  ```bash
  docker exec -i bandstand-db pg_restore --clean --if-exists -U bandstand -d bandstand < backups/bandstand-YYYY-MM-DD.dump
  ```

- **Refunds** are issued in Polar (Orders → refund). The webhook then updates
  the band.

## Gotchas

- Compose doesn't recreate a container when only an inline `configs:` changes,
  so a plain `up -d` keeps the old backup script. `make hosted-deploy` always
  recreates the backup container.
- Nothing from the repo is mounted into a container. The Caddyfile is built
  into Caddy's image instead. `git pull` replaces files, and a branch switch
  can replace whole folders; a bind mount then keeps showing the old, deleted
  copy. On 2026-10-09 a mounted Caddyfile, then a mounted folder, both went
  stale that way.
- The app keeps live updates and the push-notification queue in memory: run
  exactly one app container.
- Polar may deliver webhooks late or out of order. `applySubscription` only
  ever records the subscription's current state, so a repeat or late delivery
  does no harm.
