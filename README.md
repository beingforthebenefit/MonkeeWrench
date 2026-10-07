# Monkee Wrench

[![CI](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml/badge.svg)](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/MonkeeWrench/badges/badges/tests.json)](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/MonkeeWrench/badges/badges/coverage.json)](https://beingforthebenefit.github.io/MonkeeWrench/)

The band hub for **Monkee Business**: chord charts with full version history, setlists, a stage performance mode, rehearsal availability, and song proposals. Built with Next.js, NextAuth (Google), Prisma/Postgres and Vitest; live at <https://members.monkeebusinessband.com>.

## Table of Contents

- [Features](#features)
- [Stack](#stack)
- [AI Agents](#ai-agents)
- [Quick Start (Docker)](#quick-start-docker)
- [Production (Docker)](#production-docker)
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
- **Setlists**: drag (or up/down) to reorder, a key and a note per song (e.g. vocal assignments).
- **Performance mode** (`/perform/:id`): black, chart-only, fitted to the screen; long songs page instead of shrinking. Next/previous by edge tap, swipe, or a Bluetooth page-turn pedal (arrow/page keys). Keeps the screen awake; the whole set loads up front.
- **Rehearsals**: everyone marks the days they can't make (Free / PM out / Out); best dates for the next two weeks; schedule a rehearsal. People who haven't answered are named and never counted as free.
- **Recent changes** (`/activity`): who changed what, everywhere.
- **Proposals and voting**: a proposal that reaches the vote threshold joins the book as a song to learn.
- **Auth**: Google sign-in via NextAuth with admin/user allowlists. Everything except sign-in requires an account (charts are copyrighted).
- Phone and iPad layouts throughout ("Music Stand" design: dark, chords in amber).

## Stack

- Web: Next.js 14 (App Router), React 18, TypeScript, Tailwind v4 (MUI remains on the older admin/proposal pages)
- Charts: own ChordPro parser/transposer (`src/lib/chordpro.ts`), PDFs with `pdfkit`, diffs with `diff`
- Auth: NextAuth with Google provider
- Data: Prisma ORM, PostgreSQL 16
- Realtime: EventEmitter + SSE
- Tooling: ESLint, Prettier, Vitest (jsdom), Testing Library
- Containers: Dockerfile + Compose (dev + prod)

## AI Agents

- See `AGENTS.md` for authoritative guidelines for AI assistants (Copilot, Codex, Claude, etc.) and contributors.
- Follow repo conventions for structure, coding style, and tests as defined there.
- When making changes, always update tests in `tests/` to reflect behavior and update this `README.md` if commands, setup, or user‑facing behavior change.
- For convenience, `COPILOT.md`, `CODEX.md`, and `CLAUDE.md` are symlinks to `AGENTS.md`. Additionally, `.github/copilot-instructions.md` points to `AGENTS.md` for GitHub Copilot Chat.

## Quick Start (Docker)

1. Copy env and configure values

- `cp .env.example .env`
- Required: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google Cloud OAuth2)
- Strongly recommended: set yourself as an admin so your first login works:
  - `ADMIN_ALLOWLIST=you@example.com`
- Optionally allow non‑admin users: `USER_ALLOWLIST=user1@example.com,user2@…`
- `NEXTAUTH_SECRET` should be a random string (e.g. `openssl rand -base64 32`)

2. Start the dev stack

- `make dev` (hot‑reload) or `make dev-d` (detached)
- App: http://localhost:3002 (mapped from container 3000)
- Postgres data persists in the `pgdata` volume

3. Sign in with Google

- Configure your Google OAuth2 app to allow the redirect URL:
  - http://localhost:3002/api/auth/callback/google
  - Set “Authorized JavaScript origin” to http://localhost:3002

Useful: `make logs`, `make app-sh`, `make db-sh`, `make psql`.

## Production (Docker)

Production runs on the `popos` server from `docker-compose.server.yml`, a standalone stack (project `monkeewrench`, port **7120**) that can run beside the dev stack. Traefik on another host terminates TLS for `members.monkeebusinessband.com` and forwards to it.

1. Create `.env.production` (gitignored; `.dockerignore` keeps every `.env*` out of images) with `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWLIST` and optional `USER_ALLOWLIST`, `VOTE_THRESHOLD`.
2. Google OAuth client: redirect URI `https://members.monkeebusinessband.com/api/auth/callback/google`.
3. Build and start (also the update command):

   ```bash
   docker compose -f docker-compose.server.yml --env-file .env.production up -d --build
   ```

The entrypoint applies migrations on start. Demo seed data is created only when `APP_ENV=development`. `GET /api/health` is public and queries the database (`{"ok":true,"songs":N}`); the container healthcheck and the server's monitoring use it.

## Importing charts from Google Drive

The band's old charts were Google Docs in chords-over-lyrics format (`[Verse 1]` or `INTRO: C F Bb F (x4)` / `#1.` headers, guitar tab). To import them:

1. In Drive, download the `Original Documents` folder (a zip of `.docx`) and the song spreadsheet as `.xlsx`. Unzip into `data/` — **gitignored**, because the charts are copyrighted.
2. `python3 -I scripts/drive-export-to-json.py "data/docs/Original Documents" "data/Monkee Business.xlsx" data/import.json`
3. `make import FILE=data/import.json AS=you@example.com` (dev). For production, `docker cp` the JSON into `monkeewrench-app` and run `npx tsx scripts/import-songs.ts /tmp/import.json you@example.com` there, then delete it.

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
- `prod`/`prod-up`: run production stack
- `build`: Next.js build inside the app container
- `logs`: tail logs for app + db
- `app-sh`/`db-sh`/`psql`: shells and psql into the DB
- `prisma-gen`: prisma format + generate (inside app)
- `prisma-deploy`: migrate deploy (prod‑style)
- `prisma-dev NAME=…`: create a new migration interactively
- `seed`: run `prisma/seed.mjs`
- `lint`/`lint-fix`/`format`/`format-check`: code quality
- `test`/`test-watch`/`test-cov`: run tests (watch/coverage) in the app container
- `down`/`nuke`: stop; stop + remove volumes (danger: wipes DB)

See the full list in `Makefile`.

## Environment Variables

Defined in `.env.example` and used by Compose and the app:

- `DATABASE_URL`: e.g. `postgresql://monkee:monkee@db:5432/monkee?schema=public`
- `NEXTAUTH_URL`: e.g. `http://localhost:3002`
- `NEXTAUTH_SECRET`: random string
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: OAuth2 client creds
- `ADMIN_ALLOWLIST`: comma‑separated emails that become admins on first sign‑in
- `USER_ALLOWLIST`: comma‑separated emails allowed to sign in (non‑admin)
- `VOTE_THRESHOLD`: number of votes to auto‑approve (default 2)

Tip: on first run, ensure your email is in `ADMIN_ALLOWLIST` so you can sign in and access `/admin`.

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

- Preferred (inside container via Make): `make test`, `make test-watch`, or `make test-cov`
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

See `LICENSE`.
