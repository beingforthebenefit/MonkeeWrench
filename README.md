# Monkee Wrench

[![CI](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml/badge.svg)](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/MonkeeWrench/badges/badges/tests.json)](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/MonkeeWrench/badges/badges/coverage.json)](https://beingforthebenefit.github.io/MonkeeWrench/)

**Bandstand**: a self-hosted hub for bands — chord charts with full version history, setlists, a stage performance mode, rehearsal availability, and song proposals. One install serves several bands; each can have its own name, icon and web address. Built with Next.js, NextAuth, Prisma/Postgres and Vitest. It started as Monkee Wrench, the hub for **Monkee Business** (still its name there), live at <https://members.monkeebusinessband.com>.

## Table of Contents

- [Features](#features)
- [Stack](#stack)
- [AI Agents](#ai-agents)
- [Quick Start (Docker)](#quick-start-docker)
- [Production (Docker)](#production-docker)
- [Importing a band (OnSong, spreadsheets, JSON)](#importing-a-band-onsong-spreadsheets-json)
- [Importing charts from Google Drive](#importing-charts-from-google-drive)
- [Writing charts (ChordPro)](#writing-charts-chordpro)
- [Dev notes](#dev-notes)
- [Make Targets](#make-targets)
- [Environment Variables](#environment-variables)
- [App Model & Flows](#app-model--flows)
- [Running Locally (no Docker)](#running-locally-no-docker)
- [Testing](#testing)
- [Linting & Formatting](#linting--formatting)
- [CI](#ci)
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
- The dev stack is Compose project `monkeewrench-dev`, separate from the live stack (`monkeewrench`), so dev targets (`make test`, `make down`, `make psql`, ...) can never touch production

3. Give yourself an account

- `make app-sh`, then `npx tsx scripts/create-band.ts "Band" you@example.com "Your Name"` (or `npx tsx scripts/import-members.ts <band-slug> data/members.json`)
- `npx tsx scripts/set-password.ts you@example.com` prints a password once; sign in at `/login`

Useful: `make logs`, `make app-sh`, `make db-sh`, `make psql`.

## Production (Docker)

Production runs on the `popos` server from `docker-compose.server.yml`, a standalone stack (project `monkeewrench`, port **7120**) that can run beside the dev stack. Traefik on another host terminates TLS for `members.monkeebusinessband.com` and forwards to it.

1. Create `.env.production` (gitignored; `.dockerignore` keeps every `.env*` out of images) with `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET` and optional `VOTE_THRESHOLD`.
2. Build and start (also the update command):

   ```bash
   make deploy
   # = docker compose -f docker-compose.server.yml --env-file .env.production up -d --build
   ```

   The live stack (project `monkeewrench`, port 7120) and the dev stack (project `monkeewrench-dev`, port 3002) share no containers, volumes, networks or ports, so both can run at once. The dev server polls for file changes and uses about a core and 1 GB of RAM: start it when working on the app and `make down` afterwards.

The entrypoint applies migrations on start. The first band and admin: `npx tsx scripts/create-band.ts "Band Name" you@example.com "Your Name"` inside the app container (the first admin also becomes the install owner), then `npx tsx scripts/set-password.ts you@example.com` prints a password once; everyone else's comes from `/members`, and further bands are started from the app. Serving several web addresses needs `AUTH_TRUST_HOST=true` (sign-in URLs follow the address used) and, for Google sign-in, each address's `/api/auth/callback/google` in the OAuth client. Demo seed data is created only when `APP_ENV=development`. `GET /api/health` is public and queries the database (`{"ok":true,"songs":N}`); the container healthcheck and the server's monitoring use it.

## Importing a band (OnSong, spreadsheets, JSON)

`scripts/import-band.ts` loads a band's songs, charts, personal cues,
setlists (with sets and breaks) and rehearsals from one JSON file; its
header documents the format. Charts can be ChordPro, or OnSong text as it
comes out of an OnSong backup (`OnSong.sqlite3`, table `Song`, column
`content`): the title, artist and `Key:` lines are dropped, each paragraph
becomes a section (named when it says what it is: `Chorus:`, `intro- sax
solo`, `piano solo`), chords above the words are merged in, and a player's
notes on top (`Piano - Light and airy`) become that player's personal cue
instead of part of everyone's chart. Re-running it adds nothing twice.

    npx tsx scripts/import-band.ts band.json   # inside the app container

The band must exist first (menu → All bands). The JSON holds lyrics: keep it
in the gitignored `data/` and delete it afterwards.

## Importing charts from Google Drive

The band's old charts were Google Docs in chords-over-lyrics format (`[Verse 1]` or `INTRO: C F Bb F (x4)` / `#1.` headers, guitar tab). To import them:

1. In Drive, download the `Original Documents` folder (a zip of `.docx`) and the song spreadsheet as `.xlsx`. Unzip into `data/` — **gitignored**, because the charts are copyrighted.
2. `python3 -I scripts/drive-export-to-json.py "data/docs/Original Documents" "data/Monkee Business.xlsx" data/import.json`
3. `make import BAND=<band-slug> FILE=data/import.json AS=you@example.com` (dev). For production, `docker cp` the JSON into `monkeewrench-app` and run `npx tsx scripts/import-songs.ts <band-slug> /tmp/import.json you@example.com` there, then delete it.

Re-running is safe: unchanged charts are skipped, changed Docs become a new version, and a chart edited in the app since the last import is never overwritten (it's reported instead).

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
- `deploy`: build and (re)start the live stack on popos, then wait for `/api/health`
- `build`: Next.js production build in a one-off container (checks it compiles)
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

Workflow: `.github/workflows/ci.yml`.

## Coverage Report

- Latest HTML report: https://beingforthebenefit.github.io/MonkeeWrench/
- Coverage badge source is generated in CI and pushed to the `badges` branch as `badges/coverage.json`.

## File Map

- Docker: `Dockerfile`, `.dockerignore`, `docker-compose.yml` + `docker-compose.dev.yml` (dev), `docker-compose.server.yml` (production)
- Make targets: `Makefile`
- CI: `.github/workflows/ci.yml`
- Prisma: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.mjs`
- Charts: `src/lib/chordpro.ts` (parse/transpose/import), `src/lib/pdf.ts`, `src/lib/chart-diff.ts`, `src/components/chart/ChartBody.tsx`
- Import: `scripts/drive-export-to-json.py`, `scripts/import-songs.ts`
- App: `src/app/(band)/*` (signed-in pages), `src/app/perform/*`, `src/app/api/*`, `src/components/*`, `src/lib/*`, `src/middleware.ts`
- Tests: `tests/*`, `vitest.config.mts`

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). Run it,
change it, host it for your bands. If you offer a modified version to other
people over a network, you must offer them its source too.
