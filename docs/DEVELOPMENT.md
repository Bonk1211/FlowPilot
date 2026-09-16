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
  adapter; `imaging.py` generates and measures controlled rasters; `cases.py` owns
  deterministic case actions, scoring, contracts, and atomic persistence.
  The original snapshot repository remains available alongside M1 case storage.
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
| `GET /api/demo/images` | Four generated sample measurements and raster image URLs |
| `GET /api/demo/images/{sample_id}.png` | Deterministic normal, undersized, oversized, or missing-dot PNG |
| `POST /api/investigations` | `{report, sample_id}` creates a measured, persisted demo case |
| `GET /api/investigations/{id}` | Complete saved case, revision, evidence, answers, rankings, and timeline |
| `POST /api/investigations/{id}/actions` | Revision-checked typed action; returns the complete updated case |

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
The browser API launcher migrates a new database under `.cache/e2e-*` for every
suite; it never uses the developer database. Each test creates its own case and
browser context. These ignored test directories may be removed after testing.
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

### M1 integrated workspace

Open `/` to create a case. Choose a generated sample, write an operator report,
optionally preview and attach a sample/uploaded log, and answer discovery questions.
The undersized sample supports the full diagnosis journey. Other samples demonstrate
measurement only, explicitly without unsupported cause rankings.

Raster generation uses a fixed 12-location layout. Measurement thresholds actual
pixel intensities, finds connected components, matches expected locations, and
reports bounding-box diameter, standard deviation, positional deviation, and filled
area relative to a fitted circle. Missing locations are excluded from geometric
averages and counted independently. Results are pixels, not calibrated physical
units. A verification sample passes only when all 12 dots are present and within
28–32 px. No external image dependency or image upload is needed for this boundary.

Case actions are `attach_log`, `answer`, `diagnose`, `inspect`,
`confirm_observation`, `complete_action`, `verify`, and `resolve`. All require the
current `revision`; the confirmation actions also require `confirmed: true`.
Unknown cases return 404, invalid input 422, stale revisions or invalid transitions
409, and unavailable/unmigrated storage 503. Each mutation updates the case and its
timeline atomically. Repeating a request with its old revision cannot duplicate it.
After an interrupted request, reload the saved case before retrying.

Log attachment reparses the previewed text on the server and retains events,
warnings, units, and provenance in the case's log document. Projected evidence is
provisional; an unknown event timestamp is recorded as `unknown`, never the import
time. The complete parser record retains compound units and context. `Evidence.unit`
accepts a scalar unit string, a per-field unit map, or null. Log projection retains
the original units, and the ledger uses the same formatter as the import preview.

Existing M1 cases are normalized on reads and before actions: missing compound units
are recovered only from a unique retained log candidate matching key, source reference,
and value. Existing units and ambiguous matches are left unchanged. Missing-evidence
labels are refreshed from current observations; verified intermittent recovery is
not listed as missing. Unknown, absent, provisional, or rejected observations do not
satisfy that evidence requirement. GET requests do not write these repairs to storage
or change revisions, scores, confirmations, or history. The next successful action
persists the normalized case atomically; no database migration is required.

`fixtures/v1/scoring-rules.json` holds explainable rule weights. The initial golden
ranking matches the M0 fixture, while intermittent recovery and confirmed outcomes
change actual case scores. Findings use cached deterministic templates populated
with current evidence IDs; they are not live model responses. Observation selection
alone does not confirm a cause. Both outcomes require explicit confirmation and
record inspection completion; the negative path remains open at material review.

Migration `0002` adds the `cases` table with a JSON case document and integer
revision, preserving the original `investigation_snapshots` table. The case ID in
`/?case=...` restores the persisted journey. No automatic production reset exists:
**Start another case** creates a separate investigation without deleting history.

M1 reuses the existing design tokens, source viewer, and semantic 2D/text guide.
Live specialists, 3D rendering/animation, general evidence editing, additional repair
workflows, model fallback orchestration, and expert procedure approval remain later
work. API outages preserve readable loaded state and link to the labelled offline
M0 prototype; they never silently switch a saved case to fabricated success.

### M0 golden prototype

Open `/prototype` (or **Explore the M0 prototype** from the Report footer) for the
fixture-backed screen wireframes. The standalone Report/log-preview is at `/log-preview`.
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
Developer A owns authoritative contracts and execution engines. Both own fixture
changes. M1 now connects intake, question processing, ranking and case APIs at `/`;
M2 adds live reasoning and 3D. The standalone log viewer is read-only.

The guide uses SVG plus text and requires no WebGL or external assets. Unknown node
references keep the instructions visible and report an unavailable diagram highlight.
Camera presets reserve illustrative coordinates for M2; no 3D renderer, animation,
or camera controls are implied. All procedure wording is pending expert review.

The standalone Report screen at `/log-preview` loads a simulated operator report
and previews the sample log without saving a case. The M0 prototype is also read-only;
only the main M1 workspace executes and persists the case workflow.

Live agent execution, approved procedures, 3D, production reset/replay,
authentication, and deployment remain future implementation. Generated sample
measurement is implemented; arbitrary production-image recognition is not.

Procedure wording still requires domain-expert review. Machine PASS is never product
quality evidence, and the sample lacks pressure, temperature, diameter, and obstruction
telemetry. Refer to the product requirements and ingestion profile before extending behavior.

Framework references: [FastAPI application structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/),
[Vite setup](https://vite.dev/guide/), and [uv projects](https://docs.astral.sh/uv/guides/projects/).
