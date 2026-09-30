> Current workspace: version 3 S932 incident investigation. See the [incident guide](S932_INCIDENT_WORKSPACE.md) and [latest PRD](S932_AI_Troubleshooting_PRD.md). Version 2 guided repair and the historical M0–M2 descriptions below remain applicable to `/legacy` and saved case URLs.

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
| `GET /api/demo/scenario` | Validated version 2.0 sample report, raw sample log, and provenance metadata |
| `POST /api/logs/preview` | `{text, sourceName?, timezoneOffset?}` to parsed events, runs, warnings, statistics, and provisional evidence; no persistence |
| `GET /api/demo/images` | Four generated sample measurements and raster image URLs |
| `GET /api/demo/images/{sample_id}.png` | Deterministic normal, incomplete, coarse, shifted, or overspray PNG |
| `POST /api/investigations` | `{report, sample_id}` creates a measured, persisted demo case |
| `POST /api/demo/reset` | Same request/response as case creation; starts a fresh v2 case and retains every previous investigation |
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
The incomplete sample supports the golden journey. Coarse, shifted and overspray samples also support diagnosis; a normal sample does not establish a defect.

Raster generation uses idealized rectangular spray masks. Measurement thresholds pixel intensity independently of sample ID, measuring coverage, uncovered area, displacement, coarse deposits and overspray. The UI shows the target and permitted boundary. These pixel measurements cannot establish mass or thickness. Visual acceptance must be combined with confirmed recovery checks.

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

Version 1 cases are read-only and are not normalized. Version 2 reads can recover missing compound units from uniquely matching retained log candidates and refresh missing-evidence labels; they never write storage or change scores/history. Only confirmed observations satisfy known-evidence checks.

`fixtures/v2/scoring-rules.json` holds explainable rule weights. The initial golden
ranking matches the M0 fixture, while weight/pattern observations and confirmed outcomes
change actual case scores. M1 findings use cached deterministic templates populated
with current evidence IDs; M2 optionally enriches them with reviewed Gemini output.
Observation selection
alone does not confirm a cause. Both outcomes require explicit confirmation and
record inspection completion; the negative path remains open at air-cap and pressure-supply review.

Migration `0002` adds the `cases` table with a JSON case document and integer
revision, preserving the original `investigation_snapshots` table. The case ID in
`/?case=...` restores the persisted journey. No automatic production reset exists:
**Start another case** creates a separate investigation without deleting history.

M1 reuses the existing design tokens, source viewer, and semantic 2D/text guide.
M2 extends these as documented below. Additional repair workflows and expert
procedure approval remain later work. API outages preserve readable loaded state and link to the labelled offline
M0 prototype; they never silently switch a saved case to fabricated success.

### M0 golden prototype

Open `/prototype` (or **Explore the M0 prototype** from the Report footer) for the
fixture-backed screen wireframes. The standalone Report/log-preview is at `/log-preview`.
The prototype demonstrates five discovery answers, two inspection outcomes, explicit
observation confirmation, simulated corrective action, verification, and a summary.
Answers demonstrate question branching; diagnosis always uses the labelled fixed
declining-flux-coverage golden scenario. Nothing is persisted or sent to a model.

`GET /api/demo/golden-scenario` validates and serves
`fixtures/v2/golden-scenario.json` with no database access. The frontend bundles that
same file as its explicitly labelled offline fallback. `schema_version` and
`fixture_version` are both `2.0`; update authoritative Pydantic models, generated
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

Approved procedures, production reset/replay, authentication, and deployment remain
future implementation. Generated sample
measurement is implemented; arbitrary production-image recognition is not.

Procedure wording still requires domain-expert review. Machine PASS is never product
quality evidence, and the sample lacks pressure, temperature, diameter, and obstruction
telemetry. Refer to the product requirements and ingestion profile before extending behavior.

Framework references: [FastAPI application structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/),
[Vite setup](https://vite.dev/guide/), and [uv projects](https://docs.astral.sh/uv/guides/projects/).

### M2 reasoning, evidence corrections, and 3D

Set `GEMINI_API_KEY` in the ignored root `.env`. It is read only by the backend.
`FLOWPILOT_GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`, verified with synthetic
cases during M2 acceptance. The planned 3.8 Flash and an attempted 3.7 Flash returned
provider overload responses during verification; the configured key could list 2.5
Flash but generation returned 404. Model selection remains configurable. Consult the
[Google model catalog](https://ai.google.dev/gemini-api/docs/models) for current availability.
`FLOWPILOT_REASONING_ENABLED=false` forces deterministic fallback.
`FLOWPILOT_REASONING_TIMEOUT_SECONDS` may shorten the 30-second maximum budget.
Never use a `VITE_*` variable for credentials.

`diagnosis/reasoning.py` runs the Fluid Path and Material/Process specialists
concurrently, followed by a diagnostic critic. Each specialist must cover its
assigned hypotheses. Pydantic validates structured JSON; application validation checks
roles, hypothesis coverage, evidence IDs, source references, and conflicting citations.
Only current, non-rejected evidence enters the prompt. Reports, machine values, and
specialist findings are treated as untrusted data. The critic reviews whether findings
are grounded, rather than rejecting a candidate merely because its likelihood falls.
An invalid response, unsupported citation, critic rejection, missing key, provider
failure, or timeout retains the entire deterministic finding set. No partial live
finding set is published. This is an explanatory model layer, not proof of causality.

The SDK uses `response_json_schema` with Pydantic's JSON schema and validates the
returned JSON locally; `response_schema` rejected `additionalProperties` in the live
API. See the [official SDK JSON-schema examples](https://googleapis.github.io/python-genai/).
Scores, recommendations, physical observations, state gates, and confirmations remain
server-owned. Reasoning runs after diagnosis, eligible corrections, and confirmed
inspection outcomes. Network calls occur after the read transaction closes; a final
compare-and-swap update rejects stale revisions. Action requests allow 45 seconds on
the client and prevent duplicate submissions while busy. GET never calls the model.

Prompt `m2.3` supplies the deterministic ranker's `known_gaps`. If any exist, the
critic must include at least one of those gaps in its assessment's missing-evidence
list (case/outer whitespace are normalized for matching). A generic endorsement or
invented-only gap list fails validation and retains the complete cached finding set.
This applies even after a confirmed obstruction: a confirmed cause does not erase
other unknown material conditions. Explicit known-gap reporting enforces FR-011
without trying to infer the meaning of free-form prose.

`Case.reasoning` records mode, model, prompt version, evidence revision, timestamp,
safe fallback reason, and critic review. Old documents default to `reasoning=null`
and cached mode. The existing JSON case table needs no new migration. Reads preserve
reviewed live findings; only cached finding presentation receives legacy normalization.

The new `correct_evidence` action takes `revision`, `evidence_id`, `operation`
(`edit` or `reject`), an optional replacement `value`, a required `reason`, and
`confirmed: true`. Technician reports and discovery answers can be edited. Machine
and image values can only be rejected. Every correction retains the original evidence
as rejected and records its before-value, before-state, reason, replacement, and any
invalidated dependent evidence in the timeline. Editing/rejecting an upstream answer
retires the previous downstream answers and resumes discovery at the correct branch;
old rankings are cleared until that branch is completed and diagnosed again.
Other eligible corrections immediately recompute scores, missing evidence, findings,
and recommendation. Rejecting image evidence also retires its derived spray-defect
contribution and disables inspection based on that image. A pending outcome is cleared.
Either confirmed inspection outcome locks corrections; later corrections need a new case.

The diagnosis ledger filters by source and status, retains rejected evidence, and
allows review of raw machine records after diagnosis. The inspection screen also
offers evidence review before confirmation. The lazy-loaded Three.js viewer builds
named spray-assembly meshes matching shared semantic IDs, with shared camera presets. Play
advances every five seconds and stops at the final step. Manual navigation, camera
interaction, mode changes, and reduced-motion changes pause playback. Reduced motion
uses immediate camera updates and disables autoplay/pulsing. Keyboard-accessible
camera buttons accompany orbit/pan/zoom gestures. 2D mode, WebGL failure/context loss,
missing mappings, and renderer loading failures retain the diagram/text alternatives.
Playback only moves the camera and highlights components; it does not animate an
unapproved removal procedure or record outcomes. Renderer resources are disposed on unmount.

Ranking and specialist evidence links clear both filters, reveal the cited row,
and move keyboard focus to it after rendering. A rejected image now shows an
explicit rejection state with a link to create a new case. It does not claim that
inspection happened. Air-cap/pressure-supply handoff messaging requires
an actual confirmed negative inspection and the air-cap/pressure-supply recommendation.

Verification commands (from the repository root):

```sh
npm run check
npm run test:e2e -- --workers=4
uv run python scripts/check_live_reasoning.py
npm run test:e2e -- --config=playwright.demo.config.ts
npm run test:e2e -- --config=playwright.live.config.ts
node scripts/contract-review.mjs --check
```

The regular backend/browser suites force cached mode and never consume the configured
key. The explicit live command sends only generated synthetic case evidence and checks
initial, positive, and negative reasoning plus forced fallback; it saves safe results
to `artifacts/demo/live-reasoning-check.json` and exits unsuccessfully if live acceptance
fails. `--list-models` lists names available to the configured key without generating text.
The recording configuration uses a fresh migrated database and captures both real API
journeys in **labelled cached mode**, including verification failure/retry and reload,
to `artifacts/demo/recordings/*/video.webm`. These are local backup footage, not a
narrated submission video or proof of live model availability. All `artifacts/demo/`
files are ignored by Git. M3 still owns final rehearsals, expert review, and submission.

`playwright.live.config.ts` is an explicit opt-in integration check, separate from
regular offline tests. It starts a fresh migrated database with live reasoning,
creates synthetic cases through the browser, verifies live critic-reviewed results
and known gaps, confirms each outcome, and compares the saved API document after
browser reloads. The positive branch proceeds through corrective action, measured
verification, and resolution. It fails if the provider falls back; it never treats
cached mode as proof of live acceptance. Safe case attachments and screenshots are
written to `artifacts/demo/live-browser/`. No key enters the browser.

The pending M0 freeze can be reviewed using [the review package](M0_CONTRACT_REVIEW.md).
`node scripts/contract-review.mjs` prepares its exact candidate hashes; `--check`
verifies that the reviewed material has not changed. Neither command grants acceptance.

## Version 2 flux scenario

Run `uv run python scripts/build_flux_fixture.py` to rebuild the shared synthetic storyboard from independent raster measurements and hypothesis-keyed scoring rules. Version 1 fixtures are compatibility history, not active demo content.

The `verify` action accepts `checks`: synthetic profile, setup/calibration results, weight/pressure compliance, limits reference, lanes A/B with all-unit acceptance, subsequent-tray requirements and explicit confirmation. Missing checks cannot pass. Two confirmed calibration failures block retries. `complete_action` records nozzle cleaning or replacement. Scenario/rules versions are 2.0; the observed ingestion format remains v1.

Recovery reload restores the last submitted values and image selection, but clears
confirmation. Each retry requires fresh confirmation. The previous submitted checks
remain visible separately, including when escalation blocks further attempts.
Either confirmed nozzle-inspection outcome completes the nozzle-inspection evidence
requirement; a clear nozzle still leaves upstream fluid-path inspection outstanding.

Untagged/version 1 cases load without normalization or storage writes and reject all actions. Archived dots render directly from stored measurements, avoiding confusion with the new normal spray image. No database reset or migration is needed. Expert feedback received; revised procedure approval and fresh joint contract review remain pending.


## M3 reset, reliability and rehearsal

**Restart demo** calls `POST /api/demo/reset` with the standard synthetic report
and incomplete-coverage image. The response is a new `Case` with a new ID and
revision zero. The UI clears uploads/previews, inspection and recovery state,
confirmations and component-local filters. Existing investigations remain
unchanged and accessible through their URLs. No deletion endpoint or migration
is introduced. A failed reset retains the current view; a failed case action
requires a successful reload before another action can be submitted.

The completed summary shows the recorded inspection, ranked causes and a
keyboard-accessible disclosure containing the retained evidence. Errors receive
focus and retain a reload/retry control. The nozzle inspection heading matches
its nozzle-only observation boundary.

```powershell
$env:PATH = (Join-Path (Get-Location) '.tools\bin') + ';' + $env:PATH
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.cache\uv'
$env:PLAYWRIGHT_CHANNEL = 'chrome' # only when using installed Chrome
npm.cmd run test:e2e -- --config=playwright.rehearsal.config.ts
npm.cmd run test:e2e -- --config=playwright.live.config.ts
```

The rehearsal configuration starts a fresh migrated database and runs serially
with retries disabled. It records two consecutive positive cases using the
visible reset control, verifies preservation of the first case, and separately
covers negative handoff, recovery failure/retry, escalation, interrupted actions
and the offline storyboard. Results, traces, screenshots and videos are under
`artifacts/demo/rehearsals/`; `results.json` contains the structured report and
the `rehearsal-results` attachment records case IDs, timings and reasoning mode.
Browser contexts are fresh per test; the two-case test intentionally shares one
context to test session reset. No developer database is deleted or reused.

The live browser suite uses a 12-second provider budget, requires live critic
acceptance, and records diagnosis/confirmation latency with a 15-second ceiling.
For a manually launched demo, set `FLOWPILOT_REASONING_TIMEOUT_SECONDS=12` before
starting the API if overriding an existing configuration. The API default and
`.env.example` now both use 12 seconds (explicit overrides up to 30 remain supported). Regular browser
and API suites continue to use deterministic/mocked reasoning without provider
calls. A passing cached rehearsal is not evidence of live-provider availability.

Windows may require execution outside a restricted sandbox for Playwright to
terminate its server process tree. Use workspace-local pytest temp/cache paths
when system temp permissions prevent tests. Do not treat a stalled teardown or
missing browser executable as successful suite completion.

See [the submission package](M3_SUBMISSION.md) for the eight-minute narration,
shot list, chapter captions and actual reviewer/upload records still required.

## Diagnostic audit history and completion notes

`Case.diagnostic_history` retains a deep snapshot after each diagnosis, confirmed
inspection and evidence correction. Each snapshot includes its revision, capture
timestamp, trigger, case state, ranking, findings, live/cached metadata and the
evidence as it stood at that revision. Corrections that invalidate discovery save
an empty ranking with an explicit invalidation state; prior results remain intact.
The completed action's timeline entry links to the snapshot with
`diagnostic_revision`. Snapshot timestamps reflect capture after reasoning finishes.
The compare-and-swap write commits the action and snapshot together; a stale or
failed write cannot leave a partial audit record.

Older v2 documents default to an empty history. GET never writes or invents past
results. On their next successful action, the latest available ranking is retained
as `retained_baseline`, with a current capture timestamp and an explicit warning
that earlier results are unavailable. Archived v1 timeline/summary responses retain
their original nested values and remain read-only. No database migration is needed.

The `resolve` action now accepts optional `notes` (at most 2,000 characters), saved
in the completion summary after trimming outer whitespace. The resolution form
labels these as saved on confirmation; unsaved notes are not a persistent draft.
Reset clears the notes field. Existing callers may omit notes.

The summary separates current evidence, earlier recovery attempts and rejected or
superseded evidence. Every displayed observation includes its status, timestamp
and provenance. Earlier recovery results remain in order; only the most recent
recovery-check/result pair appears with current evidence. The diagnostic history
viewer and timeline links remain available after resolution.

Automated workflow recordings prove repeatability, not presentation readiness.
The two full timed presentation rehearsals remain a separate M3 checkpoint.


## Learning Database

Run `npm run db:migrate` after pulling this increment. Migration 0003 adds knowledge storage; existing cases are not rewritten. Open `/knowledge` or the command-bar **Learning Database** link. The existing Gemini configuration also controls draft preparation. Model calls happen outside database locks and never publish content.

See [Database Learning](DATABASE_LEARNING_PLAN.md) for APIs, lifecycle, retrieval rules, review walkthrough and verification. Relevant modules are `flowpilot/knowledge/` and the dedicated LearningDatabase/KnowledgeReview/KnowledgeGraph components. Generate OpenAPI/TypeScript with `npm run contracts:generate` after backend contract changes.

A pending model draft survives interruption. Its inspector offers **Retry interrupted preparation**, or save a manual revision. A failed model call leaves a reviewable evidence template. The app has self-reported reviewer names and no enterprise authorization system.
