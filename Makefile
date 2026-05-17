COMPOSE = docker compose -f infra/docker-compose.yml
ENV_FILE = infra/.env
ENV_EXAMPLE = infra/.env.example

.PHONY: dev down migrate logs ps clean build infra-up app-up wait-infra seed test lint psql redis-cli e2e-up e2e-down test-webhook smoke test-isolation e2e

##
## Core targets
##

dev: ## Copy .env.example if needed, then start the full stack
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "No infra/.env found — copying from .env.example"; \
		cp $(ENV_EXAMPLE) $(ENV_FILE); \
		echo "Edit infra/.env with your secrets before continuing."; \
		exit 1; \
	fi
	$(COMPOSE) up -d

down: ## Stop all containers
	$(COMPOSE) down

migrate: ## Run SQL migrations via psql
	@bash infra/migrate.sh

logs: ## Follow logs for all services (SERVICE=<name> to filter)
	$(COMPOSE) logs -f $(SERVICE)

ps: ## Show container status
	$(COMPOSE) ps

clean: ## Stop containers and delete all data volumes (destructive)
	@read -p "Delete all data? This cannot be undone. [y/N] " confirm; \
	[ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "Aborted." && exit 1)
	$(COMPOSE) down -v

##
## Build
##

build: ## Build all service images
	$(COMPOSE) build

##
## Selective bring-up
##

infra-up: ## Start infrastructure only (postgres, redis, chromadb, minio, caddy)
	$(COMPOSE) up -d postgres redis chromadb minio caddy

app-up: ## Start application services (gateway, tenant-api, flow-engine, rag-indexer)
	$(COMPOSE) up -d gateway tenant-api flow-engine rag-indexer

wait-infra: ## Wait until postgres and redis are healthy
	@echo "Waiting for postgres..."
	@until $(COMPOSE) exec -T postgres pg_isready -U app_user -d whatsapp_saas 2>/dev/null; do \
		sleep 2; \
	done
	@echo "Waiting for redis..."
	@until $(COMPOSE) exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do \
		sleep 2; \
	done
	@echo "Infrastructure is healthy."

##
## Database
##

seed: ## Seed test tenant, flow, and knowledge base document
	@bash infra/seed/seed.sh

psql: ## Open an interactive psql session
	$(COMPOSE) exec postgres psql -U app_user -d whatsapp_saas

##
## Redis
##

redis-cli: ## Open redis-cli
	$(COMPOSE) exec redis redis-cli

##
## Testing
##

test: ## Run all unit tests for all services
	@echo "--- gateway ---"
	cd services/gateway && npm test
	@echo "--- tenant-api ---"
	cd services/tenant-api && npm test
	@echo "--- flow-engine ---"
	cd services/flow-engine && python -m pytest tests/unit
	@echo "--- rag-indexer ---"
	cd services/rag-indexer && python -m pytest tests/unit

lint: ## Lint all services
	cd services/gateway && npm run lint
	cd services/tenant-api && npm run lint
	cd services/flow-engine && python -m ruff check .
	cd services/rag-indexer && python -m ruff check .

##
## E2E
##

e2e-up: ## Start the full stack plus mock-meta for E2E tests
	$(COMPOSE) --profile e2e up -d

e2e-down: ## Tear down the E2E stack
	$(COMPOSE) --profile e2e down -v

##
## E2E / Integration tests
##

smoke: ## Run smoke tests (requires make dev + make migrate first)
	@bash infra/e2e/smoke_test.sh

test-webhook: ## Send synthetic signed webhooks and verify the full pipeline
	@bash infra/e2e/test_webhook.sh

test-isolation: ## Verify cross-tenant data isolation (RLS)
	@bash infra/e2e/test_isolation.sh

e2e: smoke seed test-webhook test-isolation ## Run full E2E suite
	@echo "✓ All E2E tests passed"

##
## Help
##

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
