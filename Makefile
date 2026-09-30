.DEFAULT_GOAL := start
.PHONY: start mock dev api web install migrate

start: mock ## start both services in mock mode (default)

mock: migrate ## run frontend + backend with mock background workers
	npm run dev:mock

dev: migrate ## run frontend + backend using configured settings
	npm run dev

api: migrate ## run backend only
	npm run dev:api

web: ## run frontend only
	npm run dev:web

install: ## install JS + Python deps
	npm install
	uv sync

migrate: ## run DB migrations
	npm run db:migrate
