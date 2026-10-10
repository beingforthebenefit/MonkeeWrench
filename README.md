# Bandstand

[![CI](https://github.com/beingforthebenefit/Bandstand/actions/workflows/ci.yml/badge.svg)](https://github.com/beingforthebenefit/Bandstand/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/Bandstand/badges/badges/tests.json)](https://github.com/beingforthebenefit/Bandstand/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/Bandstand/badges/badges/coverage.json)](https://bandstand.info/coverage/)

**Bandstand**: a self-hosted hub for bands — chord charts with full version history, setlists, a stage performance mode, rehearsal availability, and song proposals. One install serves several bands; each can have its own name, icon and web address. Built with Next.js, NextAuth, Prisma/Postgres and Vitest. Run it yourself from one Docker image, or use the hosted service at <https://app.bandstand.info>.

Product page: <https://bandstand.info> (from `site/`; its screenshots come from `scripts/site-shots.mjs`). Live demo: <https://bandstand.info/songs>. CI publishes both with each push to `main`; see [Public demo](#public-demo).

## Table of Contents

- [Features](#features)
- [Stack](#stack)
- [AI Agents](#ai-agents)
- [Quick Start (Docker)](#quick-start-docker)
- [Self-hosting (Docker)](#self-hosting-docker)
- [Importing and exporting](#importing-and-exporting)
- [Writing charts (ChordPro)](#writing-charts-chordpro)
- [Dev notes](#dev-notes)
- [Make Targets](#make-targets)
- [Environment Variables](#environment-variables)
- [App Model & Flows](#app-model--flows)
- [Running Locally (no Docker)](#running-locally-no-docker)
- [Testing](#testing)
- [Linting & Formatting](#linting--formatting)
- [CI](#ci)
- [Hosted service](#hosted-service)
- [Public demo](#public-demo)
- [Coverage Report](#coverage-report)
- [File Map](#file-map)
- [License](#license)

## Features

- **Charts**: every song's chart is ChordPro text, rendered as chords over lyrics. Transpose and text size are remembered per device. Every section is always written out in full — no "same as verse 1".
- **History**: every save is a new version with author, date and an optional note; a musician-readable diff between versions; a PDF of any version; admins can restore (which saves a new version, so nothing is lost). Two people saving at once can't overwrite each other: the second save is refused with a 409.
- **PDFs**: generated on request — one song in any key, or a whole setlist in order with each song's set key and note. Letter or A4. The footer stamps the version and editor, so an old printout is obvious.
- **Setlists**: drag (or up/down) to reorder, a key and a note per song (e.g. vocal assignments). Admins can delete a setlist from its edit page.
- **Performance mode** (`/perform/:id`): chart-only, two layouts with a toggle in the header (remembered per device). **Pages** (default on iPad/desktop): fitted to the screen in columns; long songs page instead of shrinking. **Scroll** (default on phones): one tall single column, never multiple columns, so you never scroll back up mid-song. Next/previous by edge tap, swipe, or a Bluetooth page-turn pedal (arrow/page keys): pedals turn the page or scroll a screenful first, then change song. A section heading always stays with its first line. Keeps the screen awake; the whole set loads up front.
- **Rehearsals**: everyone marks the days they can't make (Free / PM out / Out); best dates for the next two weeks; schedule a rehearsal. People who haven't answered are named and never counted as free.
- **Recent changes** (`/activity`): who changed what, everywhere.
- **Proposals and voting**: a proposal that reaches the vote threshold joins the book as a song to learn.
- **Bands**: one install, several bands. People only see the bands they're in; someone in one band never notices the others, someone in several picks one (remembered per device) and switches from the menu. Being an admin is per band. Each band sets its name, app name (header and home-screen title), icon, group-chat link, time zone and, for a tribute band, who it covers (Admin page). A web address can belong to a band: its sign-in page, title, favicon and home-screen icon are that band's. The install owner starts bands and assigns addresses (menu → All bands). A link to a chart in another of your bands switches band on the way.
- **Across bands**: days off are shared by all your bands by default, or kept per band (Account → Across your bands; switching back merges them, strongest mark wins). A rehearsal or gig with one band marks you busy in your others ("busy with another band" — they don't learn which), unless you turn that off. Your calendar feed has every band's rehearsals.
- **Auth**: email + password (not everyone in the band has Google). An admin adds members and generates each password on **Band members** (`/members`); it is shown once, with a ready-to-send message. Resetting or changing a password signs that person out everywhere. Repeated failures are throttled. Everything except sign-in requires an account (charts are copyrighted).
- Phone and iPad layouts throughout ("Music Stand" design: chords in amber). Light, dark or auto (match device) appearance from the sun/moon icon at the top right; one tap cycles them, remembered per device.
- **Profile photos**: add one under the account menu → Photo & password (tap the picture). Admins can set anyone's by tapping their picture on Band members. The phone crops and shrinks it to a 256px square before upload; it is stored in the database (`Avatar` table), so it is backed up with everything else. Shown in the header, Band members, the rehearsal grid, proposals (proposer and voters) and Recent changes; people without one get their initial.
- Installable: "Add to Home Screen" uses the band's monkey icon (`src/app/apple-icon.png`, `public/icons/*`, `src/app/manifest.ts`).

## Stack

- Web: Next.js 14 (App Router), React 18, TypeScript, Tailwind v4 (MUI remains on the older admin/proposal pages)
- Charts: own ChordPro parser/transposer (`src/lib/chordpro.ts`), PDFs with `pdfkit`, diffs with `diff`
- Auth: NextAuth credentials provider (JWT sessions with a per-user version), scrypt password hashes
- Data: Prisma ORM, PostgreSQL 16
- Realtime: EventEmitter + SSE
- Tooling: ESLint, Prettier, Vitest (jsdom), Testing Library
- Containers: Dockerfile + Compose (dev stack, live server stack)

## AI Agents

- See `AGENTS.md` for authoritative guidelines for AI assistants (Copilot, Codex, Claude, etc.) and contributors.
- Follow repo conventions for structure, coding style, and tests as defined there.
- When making changes, always update tests in `tests/` to reflect behavior and update this `README.md` if commands, setup, or user‑facing behavior change.
- For convenience, `COPILOT.md`, `CODEX.md`, and `CLAUDE.md` are symlinks to `AGENTS.md`. Additionally, `.github/copilot-instructions.md` points to `AGENTS.md` for GitHub Copilot Chat.

## Quick Start (Docker)

1. Copy env and configure values

- `cp .env.example .env`
- `NEXTAUTH_SECRET` should be a random string (e.g. `openssl rand -base64 32`)

2. Start the dev stack

- `make dev` (hot‑reload) or `make dev-d` (detached)
- App: http://localhost:3002 (mapped from container 3000)
- Postgres data persists in the `pgdata` volume
- The dev stack is its own Compose project, so dev targets (`make test`, `make down`, `make psql`, ...) can never touch a production stack on the same machine

3. Give yourself an account

- An empty database opens on the setup page. The dev seed adds a demo band, so with it: `make app-sh`, then `npx tsx scripts/create-band.ts "Band" you@example.com "Your Name"` (or `npx tsx scripts/import-members.ts <band-slug> data/members.json`)
- `npx tsx scripts/set-password.ts you@example.com` prints a password once; sign in at `/login`

Useful: `make logs`, `make app-sh`, `make db-sh`, `make psql`.

## Self-hosting (Docker)

The image is `ghcr.io/beingforthebenefit/bandstand` (x86 and ARM, so a Raspberry Pi or an Apple Silicon Mac works too), published by CI with every push to `main` as `latest` and `sha-<commit>`. `selfhost/compose.yml` runs the whole install: Postgres, the app, a nightly database dump and, optionally, HTTPS.

```bash
mkdir bandstand && cd bandstand
curl -fsSLO https://raw.githubusercontent.com/beingforthebenefit/Bandstand/main/selfhost/compose.yml
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
docker compose up -d
```

Open <http://localhost:3000> (or the machine's address). A fresh install shows **Set up Bandstand**: your band's name, your name, email and a password. That account runs the install (the owner page, more bands); everyone else is added from **Band members**.

- **The address people use**: `APP_URL=https://band.example.com` in `.env` (sign-in, calendar feeds and emails use it). Port: `PORT=3000`.
- **HTTPS on your own domain**: point its DNS at the machine, open ports 80 and 443, set `DOMAIN=band.example.com` and `APP_URL=https://band.example.com`, then `docker compose --profile https up -d`. Caddy gets and renews the certificate.
- **Email** (invites, password resets): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Without it, admins make passwords on Band members and send them themselves.
- **Secrets**: the session secret and push-notification keys are made on first start and kept in the `appdata` volume. Set `NEXTAUTH_SECRET` / `VAPID_*` only to use your own.
- **Upgrading**: `docker compose pull && docker compose up -d`; migrations run on start. Pin a version with `BANDSTAND_VERSION=sha-<commit>`.
- **Backups**: a `pg_dump` every night at 03:30 UTC into `./backups`, two weeks kept. Restore one with `docker compose exec -T db pg_restore -U bandstand -d bandstand --clean < backups/<file>`.
- `GET /api/health` is public and queries the database (`{"ok":true,"songs":N,"version":"<commit>"}`); the container healthcheck uses it.

Serving several web addresses needs `AUTH_TRUST_HOST=true` (set in the compose file: sign-in URLs follow the address used) and, for Google sign-in, each address's `/api/auth/callback/google` in the OAuth client. To build from source instead, `docker build .` (the `Dockerfile`'s final stage is the published image; `base` is the dev stack's).

## Importing and exporting

**Import** (menu → Import songs, admins) brings a band's songs and setlists in from:

- **OnSong**: its `.backup` file. The page lists the sets (newest first), the books and every song; choosing a set chooses its songs, and the set comes in as a setlist with its keys. Chords on their own line are merged into the words, each paragraph becomes a section (named when it says what it is: `Chorus:`, `intro- sax solo`), and a player's notes on top (`Piano - Light and airy`) become that player's personal cue instead of part of everyone's chart.
- **Google Docs**: Drive's Download of the charts or their folder (Word files, zipped). Chords-over-lyrics with `[Verse 1]` or `INTRO: C F Bb F (x4)` / `#1.` headers and guitar tab are understood; the file's name is the title.
- **ChordPro, OnSong and text files**, singly or zipped.
- **A spreadsheet** as CSV: a Song/Title column, optionally Artist, Singer, Length, YouTube, Notes, Status. These come in without charts.
- **A pasted setlist**: one song a line, `Set 1` / `Encore` / `Break 15`, a key in brackets.
- **A Bandstand export** from any install.

Files are read in the browser (`src/lib/import/`; SQLite via sql.js, served by the app); only the chosen songs are sent, a hundred at a time, to `POST /api/import`. An import only adds: a song whose title the band already has is left alone, cues and setlists aren't added twice, so importing again (or after a batch failed) is safe. The format is `src/lib/band-import-schema.ts`; the work is `importBand()` in `src/lib/band-import.ts`.

**Export** (Admin → Download everything, `GET /api/export`) is the same format: every song with its current chart, every setlist and rehearsal, and the exporting person's own cues. It imports into any Bandstand, hosted or self-hosted.

From the command line, `npx tsx scripts/import-band.ts band.json` (inside the app container) imports a file in that format plus `"band": "<slug>"` and `"as": "<member email>"`. `scripts/drive-export-to-json.py` and `scripts/import-songs.ts` keep a band's charts in step with a Drive folder of Docs and its spreadsheet: unchanged charts are skipped, changed Docs become a new version, and a chart edited in the app since is never overwritten. Exports hold lyrics: keep them in the gitignored `data/` and delete them afterwards.

## Writing charts (ChordPro)

```
{title: Daydream Believer}
{start_of_verse: Verse 1}
Oh, I could [G]hide 'neath the [Am]wings
{end_of_verse}
{start_of_chorus: Chorus (x2)}
...
{end_of_chorus}
{chorus}                      <- repeats the last chorus, written out in full
{start_of_tab} ... {end_of_tab}  <- tablature, shown verbatim
```

The editor also converts pasted chords-above-lyrics text with one button.

## Dev notes

- **New Tailwind classes missing in dev?** In the Docker dev container, Tailwind does not see files added after the server started (the bind mount hides the change from its scanner), so classes used only in a new file are not generated. `make dev-restart` fixes it. Production builds are unaffected.
- Files created by commands run inside the container (e.g. a new migration) are owned by root on the host: `docker exec mw_app chown -R $(id -u):$(id -g) /app/prisma`.

## Make Targets

- `dev`/`dev-d`/`dev-up`/`dev-up-d`: run dev stack with/without rebuild, fg/bg
- `deploy`: build and (re)start a from-source stack (`docker-compose.server.yml`, `.env.production`), then wait for `/api/health`
- `build`: Next.js production build in a one-off container (checks it compiles)
- `demo`: build the static public demo into `demo-out/` (see [Public demo](#public-demo))
- `hosted-deploy`/`hosted-logs`/`hosted-psql`: the hosted service, on its own server (see [docs/hosting.md](docs/hosting.md))
- `logs`: tail logs for app + db
- `app-sh`/`db-sh`/`psql`: shells and psql into the DB
- `prisma-gen`: prisma format + generate (inside app)
- `prisma-deploy`: migrate deploy (prod‑style)
- `prisma-dev NAME=…`: create a new migration interactively
- `seed`: run `prisma/seed.mjs`
- `lint`/`lint-fix`/`format`/`format-check`: code quality
- `lint`, `format*`, `test*`, `build`, `deps` run in a one-off `tools` container (no ports, no database, removed afterwards), so they don't need the dev stack running
- `test`/`test-watch`/`test-cov`: run tests (watch/coverage) in the app container
- `down`/`nuke`: stop; stop + remove volumes (danger: wipes DB)

See the full list in `Makefile`.

## Environment Variables

Defined in `.env.example` and used by Compose and the app:

- `DATABASE_URL`: e.g. `postgresql://monkee:monkee@db:5432/monkee?schema=public`
- `NEXTAUTH_URL`: e.g. `http://localhost:3002`
- `NEXTAUTH_SECRET`: random string (signs session tokens)
- `VOTE_THRESHOLD`: number of votes to approve a proposal (default 2)
- `POSTGRES_PASSWORD`: production only (`.env.production`)

Members and admins live in the database (`/members`), not in env vars.

## App Model & Flows

- **Song** → many **ChartVersion**s (append-only; the newest is the chart). Saving sends the version you started from; if someone saved since, it is refused (409) rather than overwriting.
- **Setlist** → ordered **SetlistItem**s, each with an optional key and note.
- **Unavailability**: one row per person per day they can't make (no row = free); `User.availabilityUpdatedAt` tells "hasn't answered" from "always free". **Rehearsal**: a scheduled date.
- **Activity**: a human-readable line for every change, shown on `/activity` and in song history.
- Proposals (Pending) → Votes → at the threshold the proposal is Approved and becomes a Song to learn.
- Per-user proposal rate limit: 10 per hour. Server-sent events notify clients about proposal changes.

Key models: `prisma/schema.prisma`. Seed data (dev only): `prisma/seed.mjs`.

## Running Locally (no Docker)

- Prereqs: Node 20, Postgres 16
- Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres
- Install deps: `npm ci`
- Init DB: `npx prisma migrate dev` (then optionally `node prisma/seed.mjs`)
- Dev server: `npm run dev` (http://localhost:3000 by default)

## Testing

- Preferred (inside container via Make): `make test`, `make test-watch`, or `make test-cov`. They run in a one-off container; the dev stack doesn't need to be running.
- Test env: Vitest with jsdom and Testing Library (see `vitest.config.mts` and `tests/setup.ts`)

In CI, coverage HTML is uploaded as an artifact.

## Linting & Formatting

- Preferred (inside container via Make): `make lint` and `make format-check`
- To auto-fix issues: `make lint-fix` and `make format`

## CI

GitHub Actions workflow runs on every push/PR:

- Node 20, `npm ci`, lint, tests with coverage, publish a summary
- Coverage HTML uploaded as artifact for the run
- On `main`, after the tests: builds the Docker image natively for x86 and ARM and publishes it to `ghcr.io/beingforthebenefit/bandstand` as `latest` and `sha-<commit>` (`image` and `image-tag` jobs)
- On `main` and `hosted`, after the tests (and the image): deploys the hosted service, which pulls that image (`deploy-hosted` job; it deploys only the branch the server runs, see [docs/hosting.md](docs/hosting.md))
- On `main` and every morning: builds the public demo (`demo` job), then publishes GitHub Pages (`pages` job): the product page, the demo and the coverage report, at bandstand.info

Workflow: `.github/workflows/ci.yml`.

## Hosted service

<https://app.bandstand.info>: anyone can start a band. It's free for 30 days,
then $12 a year per band, paid through Polar. This is the same app with
`BANDSTAND_HOSTED=1`, running on its own server
(`docker-compose.hosted.yml`, `make hosted-deploy`). That switch adds:

- **Sign-up** at `/start`.
- **Email links** to choose a password: the welcome, invites from Members, and
  `/forgot`. These need SMTP, and work on any install that sets `SMTP_HOST`.
- **Billing and read-only:** a 30-day trial, then billing. A band that stops
  paying becomes read-only, and nothing is deleted.

Setup, accounts and running it: [docs/hosting.md](docs/hosting.md).
Self-hosted installs leave all of this off.

## Public demo

<https://bandstand.info/songs> is the real app, frozen: CI builds it with
`NEXT_PUBLIC_DEMO=1`, runs it against a scratch database seeded with the demo
band (`scripts/seed-demo.ts`, public-domain songs only), signs in as its
member Sam and saves every page as static HTML, with the PDFs it links to
(`scripts/demo.sh`, `scripts/demo/capture.mjs`). It shares the site with the
product page, so its pages sit at the root (`/songs`, `/setlists`, …).

Because it is rebuilt on every push to `main`, it always shows the current
UI; nothing needs updating by hand. It is also rebuilt every morning (CI's
`schedule`), since its dates (the next rehearsal, the gig) are relative to
the day it's built. In the demo build:

- Every page loads `scripts/demo/demo.js` first: any change the app tries to
  save gets a refusal and a "nothing you change is saved" notice.
- A strip on each page says it's a made-up band, with links to the tour and
  back to the product page.
- The tour opens on a visitor's first visit; their browser remembers once
  they finish or skip it (the account can't save it).
- No service worker, and the pages ask search engines not to index them.

What a static copy can't do: anything that saves; the History page shows the
latest version whatever version you pick, and PDFs come in the chart's own
key and paper size whatever the options.

Preview it locally: `make demo` (uses a scratch `demo` database beside the
dev one), then `python3 -m http.server -d demo-out` and open `/songs`. To see
it with the product page, copy `site/` into a folder together with
`demo-out/`.

## Coverage Report

- Latest HTML report: https://bandstand.info/coverage/
- Coverage badge source is generated in CI and pushed to the `badges` branch as `badges/coverage.json`.

## File Map

- Docker: `Dockerfile`, `.dockerignore`, `docker-compose.yml` + `docker-compose.dev.yml` (dev), `docker-compose.server.yml` (production)
- Make targets: `Makefile`
- CI: `.github/workflows/ci.yml`
- Prisma: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.mjs`
- Charts: `src/lib/chordpro.ts` (parse/transpose/import), `src/lib/pdf.ts`, `src/lib/chart-diff.ts`, `src/components/chart/ChartBody.tsx`
- Import and export: `src/lib/import/` (reading files, in the browser), `src/lib/band-import{,-schema}.ts`, `src/lib/band-export.ts`, `src/components/import/Importer.tsx`, `scripts/import-band.ts`, `scripts/drive-export-to-json.py`, `scripts/import-songs.ts`
- Self-hosting: `Dockerfile`, `selfhost/compose.yml`, `scripts/entrypoint.sh`, `/setup` (`src/app/setup`, `src/app/api/setup`)
- Product page and demo: `site/`, `scripts/demo.sh`, `scripts/demo/`, `src/lib/demo.ts`
- Hosted service: `docker-compose.hosted.yml`, `deploy/Caddyfile`, `src/lib/{hosted,billing,mail,email-tokens}.ts`, `scripts/comp-band.ts`, `docs/hosting.md`
- App: `src/app/(band)/*` (signed-in pages), `src/app/perform/*`, `src/app/api/*`, `src/components/*`, `src/lib/*`, `src/middleware.ts`
- Tests: `tests/*`, `vitest.config.mts`

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). Run it,
change it, host it for your bands. If you offer a modified version to other
people over a network, you must offer them its source too.
