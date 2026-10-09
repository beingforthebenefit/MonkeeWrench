# Monkee Wrench — Makefile
# Quick commands for dev, deploy, Prisma, logs, DB, lint/tests.

SHELL := /bin/bash

# Compose commands
COMPOSE        ?= docker compose
COMPOSE_DEV    ?= $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
# One-off container for lint/format/test/build: no ports, no database, removed
# when done, so none of these need the dev stack running
TOOLS          ?= $(COMPOSE_DEV) run --rm --no-deps tools

# Service names (must match docker-compose services, not container_name)
APP_SVC        ?= app
DB_SVC         ?= db

# ------------------------------------------------------------------------------
# Help
# ------------------------------------------------------------------------------

.PHONY: help
help:
	@echo "Targets:"
	@echo "  dev            Build & run in dev (hot-reload)"
	@echo "  dev-d          Build & run dev detached"
	@echo "  dev-up         Run in dev without rebuild"
	@echo "  dev-up-d       Run dev detached without rebuild"
	@echo "  dev-restart    Restart dev containers"
	@echo "  deploy         Build & (re)start the live server stack (popos)"
	@echo "  hosted-deploy  Update & (re)start the hosted service (on its own server)"
	@echo "  build          Next.js production build (one-off container)"
	@echo "  demo           Build the public demo into demo-out/ (one-off container)"
	@echo "  logs           Tail app+db logs"
	@echo "  app-sh         Shell into app container"
	@echo "  db-sh          Shell into db container"
	@echo "  psql           Open psql to Postgres"
	@echo "  prisma-gen     Prisma generate (in app)"
	@echo "  prisma-deploy  Prisma migrate deploy (prod style)"
	@echo "  prisma-dev     Prisma migrate dev (create new migration)"
	@echo "  seed           Run seed script"
	@echo "  import         Import songs from Drive export JSON (FILE=, AS=)"
	@echo "  lint           Lint code"
	@echo "  lint-fix       Lint code and fix issues"
	@echo "  test           Run tests"
	@echo "  test-watch     Run tests in watch mode"
	@echo "  test-cov       Run tests with coverage"
	@echo "  deps           Install node modules inside app container"
	@echo "  down           Stop all containers"
	@echo "  nuke           Stop and remove volumes (DANGER)"
	@echo "  env            Print key env vars from app container"

# ------------------------------------------------------------------------------
# Dev / Prod
# ------------------------------------------------------------------------------

.PHONY: dev
dev:  ## Build & run dev image (hot-reload) with override compose
	$(COMPOSE_DEV) up --build

.PHONY: dev-d
dev-d: ## Build & run dev detached
	$(COMPOSE_DEV) up --build -d

.PHONY: dev-up
dev-up: ## Run dev stack without rebuild
	$(COMPOSE_DEV) up

.PHONY: dev-up-d
dev-up-d: ## Run dev stack detached without rebuild
	$(COMPOSE_DEV) up -d

.PHONY: dev-restart
dev-restart:
	$(COMPOSE_DEV) restart $(APP_SVC)

# The live site (members.monkeebusinessband.com) on popos: Compose project
# "monkeewrench", separate from the dev stack ("monkeewrench-dev").
COMPOSE_SERVER ?= $(COMPOSE) -f docker-compose.server.yml --env-file .env.production

.PHONY: deploy
deploy: ## Build & (re)start production, then wait for it to report healthy
	@test -f .env.production || { echo ".env.production is missing"; exit 1; }
	$(COMPOSE_SERVER) up -d --build
	@echo "Waiting for /api/health..."
	@for i in $$(seq 1 45); do \
	  curl -fsS http://localhost:7120/api/health 2>/dev/null | grep -q '"ok":true' && { curl -fsS http://localhost:7120/api/health; echo; exit 0; }; \
	  sleep 2; \
	done; echo "Not healthy after 90s: docker logs monkeewrench-app"; exit 1

# The hosted service, app.bandstand.info, on its own server (docs/hosting.md).
# Run there, from the repo (or by CI: deploy/ci-deploy.sh). Compose doesn't
# recreate a container when only an inline config changed, so the backup
# container is always recreated; Caddy is told to re-read its Caddyfile.
COMPOSE_HOSTED ?= $(COMPOSE) -f docker-compose.hosted.yml --env-file .env.hosted

.PHONY: hosted-deploy
hosted-deploy: ## Pull, rebuild and restart the hosted service; wait for health
	@test -f .env.hosted || { echo ".env.hosted is missing (copy .env.hosted.example)"; exit 1; }
	git pull --ff-only
	$(COMPOSE_HOSTED) up -d --build
	$(COMPOSE_HOSTED) up -d --force-recreate --no-deps backup
	# Caddy only reads its Caddyfile at start or on reload
	$(COMPOSE_HOSTED) exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
	@echo "Waiting for /api/health..."
	@for i in $$(seq 1 45); do \
	  $(COMPOSE_HOSTED) exec -T app curl -fsS http://localhost:3000/api/health 2>/dev/null | grep -q '"ok":true' && { echo healthy; exit 0; }; \
	  sleep 2; \
	done; echo "Not healthy after 90s: docker logs bandstand-app"; exit 1

.PHONY: hosted-logs
hosted-logs:
	$(COMPOSE_HOSTED) logs -f --tail=100 app caddy

.PHONY: hosted-psql
hosted-psql:
	$(COMPOSE_HOSTED) exec db psql -U bandstand -d bandstand

# ------------------------------------------------------------------------------
# Build
# ------------------------------------------------------------------------------

.PHONY: build
# Shares .next with the dev server: run `make dev-restart` afterwards if dev is up
build: ## Next.js production build in a one-off container (checks it compiles)
	$(COMPOSE_DEV) run --rm --no-deps -e NODE_ENV=production -e NEXTAUTH_URL=http://localhost:3000 tools npm run build --silent

# The public demo, as CI publishes it: a scratch "demo" database beside the
# dev one, wiped and refilled each time. Preview: python3 -m http.server -d demo-out
.PHONY: demo
demo: ## Build the static public demo into demo-out/
	$(COMPOSE_DEV) up -d $(DB_SVC)
	$(COMPOSE_DEV) exec -T $(DB_SVC) psql -U monkee -d monkee -tc "SELECT 1 FROM pg_database WHERE datname='demo'" | grep -q 1 || \
	  $(COMPOSE_DEV) exec -T $(DB_SVC) createdb -U monkee demo
	$(COMPOSE_DEV) run --rm -e DATABASE_URL='postgresql://monkee:monkee@db:5432/demo?schema=public' tools bash scripts/demo.sh demo-out

# ------------------------------------------------------------------------------
# Logs / Shells
# ------------------------------------------------------------------------------

.PHONY: logs
logs:
	$(COMPOSE_DEV) logs -f

.PHONY: app-sh
app-sh:
	$(COMPOSE_DEV) exec $(APP_SVC) sh

.PHONY: db-sh
db-sh:
	$(COMPOSE_DEV) exec $(DB_SVC) bash -lc "psql --version || true; bash || sh"

.PHONY: psql
psql:
	$(COMPOSE_DEV) exec $(DB_SVC) psql -U monkee -d monkee

# ------------------------------------------------------------------------------
# Prisma / DB
# ------------------------------------------------------------------------------

.PHONY: prisma-gen
prisma-gen:
	$(COMPOSE_DEV) exec $(APP_SVC) sh -lc "npx prisma format && npx prisma generate"

.PHONY: prisma-deploy
prisma-deploy:
	$(COMPOSE_DEV) exec $(APP_SVC) sh -lc "npx prisma migrate deploy"

# Create a new migration interactively; runs inside app container.
# Usage: make prisma-dev NAME=init
.PHONY: prisma-dev
prisma-dev:
	@if [ -z "$(NAME)" ]; then echo "Usage: make prisma-dev NAME=my_migration"; exit 1; fi
	$(COMPOSE_DEV) exec $(APP_SVC) sh -lc 'npx prisma migrate dev --name "$(NAME)"'

# Import songs/charts from a Google Drive export (see scripts/drive-export-to-json.py)
# Usage: make import FILE=data/import.json AS=you@example.com
.PHONY: import
import:
	@if [ -z "$(BAND)" ] || [ -z "$(FILE)" ] || [ -z "$(AS)" ]; then echo "Usage: make import BAND=<band-slug> FILE=data/import.json AS=you@example.com"; exit 1; fi
	$(COMPOSE_DEV) exec $(APP_SVC) npx tsx scripts/import-songs.ts "$(BAND)" "$(FILE)" "$(AS)"

.PHONY: seed
seed:
	$(COMPOSE_DEV) exec $(APP_SVC) node prisma/seed.mjs

# ------------------------------------------------------------------------------
# Lint / Test
# ------------------------------------------------------------------------------

.PHONY: lint
lint:
	$(TOOLS) npm run lint --silent

.PHONY: lint-fix
lint-fix:
	$(TOOLS) npm run lint:eslint:fix --silent || true

.PHONY: format
format:
	$(TOOLS) npm run format --silent || true

.PHONY: test
test:
	$(TOOLS) npm test --silent

.PHONY: test-watch
test-watch:
	$(TOOLS) npm run test:watch --silent || true

.PHONY: test-cov
test-cov:
	$(TOOLS) npm run test:coverage --silent

# Strict CI-style targets (no exit swallowing)
.PHONY: format-check
format-check:
	$(TOOLS) npm run format:check --silent

.PHONY: lint-ci
lint-ci:
	$(TOOLS) npm run lint --silent

.PHONY: test-ci
test-ci:
	$(TOOLS) npm test --silent

.PHONY: typecheck
typecheck: ## TypeScript errors (what `next build` would fail on)
	$(TOOLS) npm run typecheck --silent

.PHONY: ci
ci: format-check lint-ci typecheck test-ci

# ------------------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------------------

.PHONY: deps
deps: ## Reinstall node_modules (shared by the app and tools containers) from the lockfile
	$(TOOLS) npm ci --no-audit --no-fund

# ------------------------------------------------------------------------------
# Teardown / Env
# ------------------------------------------------------------------------------

.PHONY: down
down:
	$(COMPOSE_DEV) down

.PHONY: nuke
nuke: ## Stop and remove containers + volumes (DANGER: wipes DB)
	$(COMPOSE_DEV) down -v

.PHONY: env
env:
	$(COMPOSE_DEV) exec $(APP_SVC) node -p "[
	  'APP_ENV','NODE_ENV','NEXTAUTH_URL','GOOGLE_CLIENT_ID','DATABASE_URL'
	].map(k => k+': '+(process.env[k]||'(unset)')).join('\n')"
