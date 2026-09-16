# FlowPilot

FlowPilot is an evidence-led investigation assistant for industrial fluid-dispensing defects. The hackathon MVP follows an operator-reported undersized-dot defect through diagnosis, guided inspection, corrective action, and verified recovery.

## Project documents

- [Development guide](docs/DEVELOPMENT.md) — setup, commands, API contracts, module boundaries, and verification.
- [Product requirements](docs/PRODUCT_REQUIREMENTS.md) — development baseline, scope, contracts, delivery plan, tests, and video script.
- [Industry event-log ingestion profile](docs/LOG_INGESTION.md) — observed legacy format, parser contract, safe evidence, warnings, and production follow-ups.
- [Domain-expert questionnaire](docs/DOMAIN_EXPERT_QUESTIONNAIRE.md) — short review form for validating the process model and troubleshooting procedure.
- [Agent issue-tracker rules](docs/agents/issue-tracker.md)
- [Agent domain-documentation rules](docs/agents/domain.md)

The current baseline assumes two developers and three build days. Synthetic images, mocked logs, illustrative 3D content, and AI-generated output must remain visibly labelled in the prototype.

## Run locally

Requires Node.js 22.12+, npm 10+, Python 3.12, and uv. From the repository root:

```sh
npm ci
uv sync --locked
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:5173. On Windows, use `npm.cmd` if the PowerShell npm launcher
is broken. The foundation includes a React Report screen, FastAPI sample-log preview,
generated shared contracts, and SQLite migration/repository infrastructure. Full
diagnosis and the remaining investigation phases are not implemented yet.

Run `npm run check` for build, lint, types, contracts, and unit/integration tests.
Run `npx playwright install chromium`, then `npm run test:e2e` for browser checks.
