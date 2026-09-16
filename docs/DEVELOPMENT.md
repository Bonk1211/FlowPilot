# Development

## Record milestone progress

Use the [milestone development log](MILESTONES.md) to track M0–M3. Read the current
handoff before starting work, then append a session entry and update its status and
checklist in the same change as the implementation. Include actual validation
results, remaining work, and the next developer's handoff. Preserve previous entries
and distinguish prototype behavior from integrated functionality. GitHub Issues
remain the task tracker; link issues and PRs from the log when available.

## Prerequisites and first run

Use Node.js 22.12+ (22 LTS recommended), npm 10+, Python 3.12, and uv. On Windows,
use `npm.cmd` if a PowerShell npm shim fails. All commands below run at the repository root.

For this workspace's existing local uv installation, add it to the current PowerShell
session before running the commands below (this does not change your system PATH):

```powershell
$env:PATH = (Join-Path (Get-Location) '.tools\bin') + ';' + $env:PATH
```

`.tools` and `.venv` are ignored local setup artifacts. A fresh clone requires uv
on PATH and `uv sync --locked` to create its own environment.

```sh
npm ci
uv sync --locked
npm run db:migrate
npm run dev
```

The web app is at http://127.0.0.1:5173; FastAPI is at http://127.0.0.1:8000
with interactive docs at `/docs`. The Vite proxy forwards `/api` to FastAPI.
Ctrl+C stops both development processes. No model API key or external database is needed.

`npm run dev:api` and `npm run dev:web` also run separately. Run commands from the
root so the default SQLite path is consistent. Copy `.env.example` to `.env` only
to override the backend database URL; for a different location, use an absolute
SQLite URL and create its parent directory first. No frontend secret configuration exists.
Migrations are explicit; health, demo loading, and log preview never create a database.

## Repository layout and ownership

- `apps/web`: React application, local fonts, semantic CSS tokens, and typed API adapter.
- `apps/api/src/flowpilot`: API composition and domain modules. Ingestion is a pure
  adapter; investigations, diagnosis, and procedures define contracts for future work.
  Persistence stores versioned investigation snapshots with caller-owned transactions.
- `apps/api/migrations`: Alembic migrations; no runtime `create_all` or automatic migrations.
- `packages/contracts`: generated OpenAPI and TypeScript declarations; do not hand-edit generated files.
- `fixtures`: versioned scenario and parity cases plus the original log and provenance metadata.
- `src/ingestion` and `test/industryEventLog.test.mjs`: preserved JavaScript reference parser and tests.
- `test/e2e`: browser smoke and recovery checks against the running backend.

Backend work owns Pydantic models, API behavior, parser parity, and persistence.
Frontend work consumes the generated contracts and owns the application experience.
Update contracts and affected fixtures in the same change.

## API and contract workflow

| Method and route | Behavior |
| --- | --- |
| `GET /api/health` | Process liveness; not a database readiness check |
| `GET /api/demo/scenario` | Validated version 1.0 sample report, raw sample log, and provenance metadata |
| `POST /api/logs/preview` | `{text, sourceName?, timezoneOffset?}` to parsed events, runs, warnings, statistics, and provisional evidence; no persistence |

Log preview accepts up to 2,000,000 text characters. Empty text returns an empty
preview. Unknown events remain visible. Invalid requests return FastAPI's 422
validation response. Timezone is optional and must be an explicit signed `HH:MM`
offset when supplied. Missing timezone is never inferred from the machine running the API.

Pydantic models are authoritative. Ingestion intentionally retains the reference
parser's camelCase keys; investigation contracts use the PRD's snake_case keys.
`AgentFinding` and `ProcedureStep` are exported domain schemas without fake API routes.

```sh
npm run contracts:generate
npm run contracts:check
```

Generation reads Pydantic/OpenAPI locally without a running server or database.
The checker compares generated output in memory and fails on drift without rewriting files.
All consumers share the root fixtures. The API reads the original sample log as
bytes decoded as UTF-8 so line endings used in hashing remain intact.

## Verification

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs ESLint, Ruff lint/format checks, TypeScript, the original Node tests,
pytest, contract drift detection, and the production web build. The browser suite
starts its own API and web processes on ports 8100 and 5174, leaving normal
development servers on 8000 and 5173 undisturbed. `FLOWPILOT_API_URL` overrides
the Vite development proxy target for this isolated test setup.
CI runs foundation checks on Windows and Linux, plus Chromium tests on Linux.

If browser downloads are unavailable, set `PLAYWRIGHT_CHANNEL=chrome` to use an
installed Chrome in an isolated test profile (PowerShell:
`$env:PLAYWRIGHT_CHANNEL = 'chrome'`). Leave it unset to use Playwright Chromium.

Parser parity invokes Node only in tests. Production FastAPI parsing is Python-only.
Parity covers full outputs, including raw provenance, content hashes, stable IDs,
warnings, source ordering, wrapped records, missing numbers, unknown records,
explicit board correlation, and provisional evidence. Database tests migrate a
temporary SQLite database, round-trip and update a snapshot, and test rollback of the schema.

## Current boundary

### M0 golden prototype

Open `/prototype` (or **Explore the M0 prototype** from the Report footer) for the
fixture-backed screen wireframes. The main Report/log-preview workflow is unchanged.
The prototype demonstrates five discovery answers, two inspection outcomes, explicit
observation confirmation, simulated corrective action, verification, and a summary.
Answers demonstrate question branching; diagnosis always uses the labelled fixed
continuous-undersizing golden scenario. Nothing is persisted or sent to a model.

`GET /api/demo/golden-scenario` validates and serves
`fixtures/v1/golden-scenario.json` with no database access. The frontend bundles that
same file as its explicitly labelled offline fallback. `schema_version` and
`fixture_version` are both `1.0`; update authoritative Pydantic models, generated
contracts, and this fixture together. The fixture contains the evidence pool for all
branches; each snapshot selects its applicable evidence IDs. Negative and positive
observations must never be combined into the displayed case.

The shared contracts cover image overlays/measurements, questions, evidence-linked
score contributions, recommendations, outcomes, snapshots, timelines, verification,
and summary. Score totals equal their contributions; they are illustrative points,
not calibrated probabilities. The embedded log preview is actual parser output.
Synthetic image measurements are precomputed; no image analysis is implemented here.

Developer B owns presentation, `apps/web/src/prototype/model.ts`, and the 2D guide.
Developer A owns the authoritative contracts and their future execution engines.
Both own fixture changes. M1 should connect real intake, question/evidence processing,
ranking and case APIs; M2 should add 3D and real workflow integration. The existing
Report route's inactive later phases remain accurate for that workflow.

The guide uses SVG plus text and requires no WebGL or external assets. Unknown node
references keep the instructions visible and report an unavailable diagram highlight.
Camera presets reserve illustrative coordinates for M2; no 3D renderer, animation,
or camera controls are implied. All procedure wording is pending expert review.

The starter Report screen loads a simulated operator report and previews the sample
log. Later phases are visibly inactive. There is no case creation or evidence
attachment API yet. The snapshot repository is infrastructure, not a complete
case audit model; extend its schema when implementing timeline/history requirements.

Live image analysis, backend question branching, agent execution, deterministic
ranking, persisted workflow gates, approved procedures, 3D, production reset/replay,
authentication, and deployment remain future implementation. The M0 prototype only
previews these experiences. Do not represent them as complete or approved.

Procedure wording still requires domain-expert review. Machine PASS is never product
quality evidence, and the sample lacks pressure, temperature, diameter, and obstruction
telemetry. Refer to the product requirements and ingestion profile before extending behavior.

Framework references: [FastAPI application structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/),
[Vite setup](https://vite.dev/guide/), and [uv projects](https://docs.astral.sh/uv/guides/projects/).
