# Monkee Wrench — AGENTS.md

Authoritative guidelines for AI coding assistants (Copilot, Codex, Claude, etc.) and human contributors. Follow these rules when reading, generating, or modifying code in this repository.

## Project Structure

- `/src`: Application source (Next.js App Router, React, TypeScript)
  - `/app`: Next.js routes, layouts, and API route handlers
  - `/components`: Reusable React components (MUI + Tailwind)
  - `/lib`: Shared utilities (auth, db, events, guards, URL helpers)
- `/prisma`: Prisma schema, migrations, and seed script
- `/tests`: Vitest unit/integration tests (jsdom, Testing Library)
- `/scripts`: Dev/CI helper scripts
- Root configs: `tsconfig.json`, `vitest.config.mts`, ESLint/Prettier, Tailwind, Next config

## Coding Conventions

- Language: TypeScript for all new code. Prefer explicit types at boundaries; rely on inference internally when clear.
- Style: Obey ESLint and Prettier configs. Prefer `make lint` (runs in container) before committing.
- Imports: Use path alias `@` for `src` (see `vitest.config.mts`). Keep import groups ordered: node/third‑party, internal libs, components, local.
- React:
  - Prefer functional components and hooks.
  - Components live in `src/components` and use `PascalCase.tsx` filenames.
  - Match export style of surrounding code (this codebase commonly uses default exports for components).
  - Keep components small and focused; lift complex logic into `src/lib`.
- Next.js (App Router):
  - Route handlers in `src/app/**/route.ts` should return proper `Response` objects and reuse guards in `src/lib/guard.ts` (`requireSession`, `requireAdmin`).
  - Avoid leaking server secrets to the client; keep server logic in route handlers and server components.
- Styling: Tailwind for layout/utility classes; MUI components for structure. Prefer Tailwind first; add custom CSS sparingly.
- Naming:
  - Variables/functions: `camelCase`.
  - Types/interfaces/enums/components: `PascalCase`.
  - Files: components `PascalCase.tsx`; utilities `kebab-case.ts` or `camelCase.ts` following existing patterns.
- Errors & responses: Use appropriate HTTP status codes. For auth/role checks, prefer the shared guards to keep behavior consistent.
- Comments: Explain non‑obvious decisions or complex logic; avoid restating the code.
- Logging: Keep `console.*` out of committed code unless behind a guard or clearly temporary (tests may log when useful).

## Dev Commands: Make vs npm

- Default to Make targets which execute inside the Docker app container.
- Only use `npm` scripts when:
  - You are attached to the app container (e.g., `make app-sh`), or
  - You are explicitly following the "Running Locally (no Docker)" path in `README.md`.
- In documentation and instructions, prefer Make. Mention `npm` only if no Make target exists and include the attach step first (e.g., `make app-sh` then `npm run …`).

## Tests: Requirements & Commands

- Write or update tests for all behavior changes. New features need test coverage; bug fixes require regression tests.
- Place tests in `/tests` mirroring the app structure. Use `*.test.ts` or `*.test.tsx`.
- Use Testing Library for React components and Vitest for all tests.
- Commands:

```bash
make test         # run test suite in container
make test-watch   # run tests in watch mode
make test-cov     # run tests with coverage in container
```

## Lint, Format, Build

Run these checks locally and in CI. All must pass before merge:

```bash
make lint           # ESLint + Prettier check in container
make format-check   # Prettier formatting check in container

# If you need fixes:
make lint-fix
make format

# Build options:
# - Containerized prod build/run:
make prod           # builds image and runs
# - Next.js build inside container:
make build
# - Local (no Docker): see README "Running Locally (no Docker)"
```

## Database & Migrations (Prisma)

- Update `prisma/schema.prisma` for schema changes and generate migrations. Keep migrations atomic and descriptive.
- Update `prisma/seed.mjs` when seed data needs to reflect new schema.
- If ENV vars change, update `.env.example` and reference them safely (never commit real secrets).

## Pull Requests

- Use Conventional Commits in messages (e.g., `feat: ...`, `fix: ...`, `chore: ...`).
- PR description must include:
  - What changed and why
  - Links to related issues
  - Tests added/updated and how to run them
  - Screenshots/GIFs for UI changes
- Keep PRs focused and small; split large work into incremental changes.

## Mandatory Documentation Updates

- Any change to behavior, APIs, commands, or developer workflow must update:
  - Tests in `/tests` to cover the new/changed behavior
  - `README.md` (usage, setup, commands, badges, envs, etc.)
  - This `AGENTS.md` if conventions, structure, or processes change

## Patterns Specific to This Repo

- AuthZ/AuthN: Use `requireSession()` and `requireAdmin()` from `src/lib/guard.ts` in server routes.
- Realtime: Use the SSE event bus in `src/lib/events.ts` for UI updates; clean up listeners to avoid leaks (see `src/app/api/stream/route.ts`).
- URL and validation helpers live in `src/lib/url.ts` and other `lib/*` utilities; prefer these over ad‑hoc parsing.
- Tests are configured with `vitest.config.mts` and alias `@` → `src`.

## How AIs Should Apply Changes

1. Read `AGENTS.md`, `README.md`, and relevant files under `src/` and `tests/`.
2. Make minimal, surgical changes consistent with existing patterns and style.
3. Add/modify tests under `/tests` that mirror the changed code path(s).
4. Update `README.md` and `.env.example` if setup, commands, or envs change.
5. Prefer containerized checks: `make lint` and `make test`. For builds, use `make prod` or `make build` as appropriate. Avoid running raw `npm` on the host unless following the no‑Docker flow.
6. Use clear, Conventional Commit messages and open a focused PR with rationale and evidence (test results, screenshots).

This document is the single source of truth for AI assistants in this repository. If in doubt, ask for guidance or propose an update here.
