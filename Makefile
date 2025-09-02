# Monkee Wrench — Makefile
# Quick commands for dev/prod, Prisma, logs, DB, lint/tests.

SHELL := /bin/bash

# Compose commands
COMPOSE        ?= docker compose
COMPOSE_DEV    ?= $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD   ?= $(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml

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
	@echo "  prod           Build & run in prod (optimized)"
	@echo "  prod-up        Run in prod without rebuild"
	@echo "  build          Next.js build inside app container"
	@echo "  logs           Tail app+db logs"
	@echo "  app-sh         Shell into app container"
	@echo "  db-sh          Shell into db container"
	@echo "  psql           Open psql to Postgres"
	@echo "  prisma-gen     Prisma generate (in app)"
	@echo "  prisma-deploy  Prisma migrate deploy (prod style)"
	@echo "  prisma-dev     Prisma migrate dev (create new migration)"
	@echo "  seed           Run seed script"
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

.PHONY: prod
prod: ## Build & run production image (prod override)
	$(COMPOSE_PROD) up --build

.PHONY: prod-up
prod-up: ## Run production stack without rebuild (prod override)
	$(COMPOSE_PROD) up

# ------------------------------------------------------------------------------
# Build
# ------------------------------------------------------------------------------

.PHONY: build
build: ## Next.js build inside the app container
	$(COMPOSE_DEV) exec $(APP_SVC) npm run build --silent || true

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

.PHONY: seed
seed:
	$(COMPOSE_DEV) exec $(APP_SVC) node prisma/seed.mjs

# ------------------------------------------------------------------------------
# Lint / Test
# ------------------------------------------------------------------------------

.PHONY: lint
lint:
	$(COMPOSE_DEV) exec $(APP_SVC) npm run lint --silent || true

.PHONEY: lint-fix
lint-fix:
	$(COMPOSE_DEV) exec $(APP_SVC) npm run lint:eslint:fix --silent || true

.PHONEY: format
format:
	$(COMPOSE_DEV) exec $(APP_SVC) npm run format --silent || true

.PHONY: test
test:
	$(COMPOSE_DEV) exec $(APP_SVC) npm test --silent || true

.PHONY: test-watch
test-watch:
	$(COMPOSE_DEV) exec $(APP_SVC) npm run test:watch --silent || true

.PHONY: test-cov
test-cov:
	$(COMPOSE_DEV) exec $(APP_SVC) npm run test:coverage --silent || true

# Strict CI-style targets (no exit swallowing)
.PHONY: format-check
format-check:
	$(COMPOSE_DEV) exec $(APP_SVC) npm run format:check --silent

.PHONY: lint-ci
lint-ci:
	$(COMPOSE_DEV) exec $(APP_SVC) npm run lint --silent

.PHONY: test-ci
test-ci:
	$(COMPOSE_DEV) exec $(APP_SVC) npm test --silent

.PHONY: ci
ci: format-check lint-ci test-ci

# ------------------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------------------

.PHONY: deps
deps: ## Install dependencies inside the app container based on lockfile
	$(COMPOSE_DEV) exec $(APP_SVC) npm ci --no-audit --no-fund

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
