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
- Style: Obey ESLint and Prettier configs. Run `npm run lint` before committing.
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

## Tests: Requirements & Commands

- Write or update tests for all behavior changes. New features need test coverage; bug fixes require regression tests.
- Place tests in `/tests` mirroring the app structure. Use `*.test.ts` or `*.test.tsx`.
- Use Testing Library for React components and Vitest for all tests.
- Commands:

```bash
npm test            # run test suite
npm run test:watch  # watch mode during development
npm run test:coverage  # generate coverage report
```

## Lint, Format, Build

Run these checks locally and in CI. All must pass before merge:

```bash
npm run lint     # ESLint + Prettier check
npm run build    # Next.js build (includes type checks)
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
5. Run `npm run lint`, `npm test`, and `npm run build`. Fix all errors.
6. Use clear, Conventional Commit messages and open a focused PR with rationale and evidence (test results, screenshots).

This document is the single source of truth for AI assistants in this repository. If in doubt, ask for guidance or propose an update here.
