# Monkee Wrench

[![CI](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml/badge.svg)](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/MonkeeWrench/badges/badges/tests.json)](https://github.com/beingforthebenefit/MonkeeWrench/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/beingforthebenefit/MonkeeWrench/badges/badges/coverage.json)](https://beingforthebenefit.github.io/MonkeeWrench/)

Song request, voting, and setlist management for a band. Built with Next.js, NextAuth (Google), Prisma/Postgres, and Vitest — containerized for easy local dev and prod.

## Table of Contents

- [Features](#features)
- [Stack](#stack)
- [AI Agents](#ai-agents)
- [Quick Start (Docker)](#quick-start-docker)
- [Production (Docker)](#production-docker)
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

- Proposals: authenticated users propose songs with optional Chart/Lyrics/YouTube links
- Voting: members vote; items auto‑promote to Setlist when threshold is met
- Setlist: approved songs, drag‑and‑drop reorder (admin‑only)
- Admin: manage allowlist + threshold; quick‑add approved songs; basic user management
- Realtime: server‑sent events push updates to the UI
- Auth: Google sign‑in via NextAuth with admin/user allowlists
- Public mode: guests can browse the dashboard, pending requests, and setlist (read‑only); proposing and voting require sign‑in
- CI: lint + tests + coverage on GitHub Actions with artifact uploads

## Stack

- Web: Next.js 14 (App Router), React 18, TypeScript, MUI, Tailwind
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

- `make prod` builds and runs the production image
- `make prod-up` runs without rebuilding

Entrypoint runs Prisma migrations and seeds default data if the DB is empty.

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

- Proposals (Pending) -> Votes -> auto‑promote to Approved Setlist when votes ≥ threshold
- Admins can quick‑add songs directly to the Setlist and reorder it
- Basic per‑user proposal rate limit: 10 per hour
- Server‑sent events notify clients about proposal changes and setlist reorder

Key models: see `prisma/schema.prisma`. Seed data: `prisma/seed.mjs`.

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

- Docker: `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`
- Make targets: `Makefile`
- CI: `.github/workflows/ci.yml`
- Prisma: `prisma/schema.prisma`, `prisma/seed.mjs`
- App: `src/app/*`, `src/components/*`, `src/lib/*`
- Tests: `tests/*`, `vitest.config.mts`

## License

See `LICENSE`.
