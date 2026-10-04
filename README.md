# FlowPilot

FlowPilot is an evidence-led investigation assistant for industrial fluid-dispensing defects. The main workspace now follows the latest S932 PRD: preserve an incident, compare competing causes, select a useful check, and prepare an engineer handoff before the cause is known.

The S932 / DJ-2200 / BFS workflow now runs as a complete mock demonstration: progressive evidence, parallel analysis and handoff, three competing causes, a 3D mechanism view, recorded synthetic model comparisons, mock experiments and communication, report export and reviewed learning. No real machine or provider key is required. [Run the incident demo](docs/S932_INCIDENT_WORKSPACE.md).

Each incident has separate [feature pages](docs/S932_INCIDENT_WORKSPACE.md#feature-pages) for Investigation, Evidence, Simulation, Experiments, Handoff, Knowledge and Review, with shared incident context and bookmarkable URLs.

The investigation includes a [conversation bar and optional ElevenLabs voice input](docs/INVESTIGATION_VOICE.md). Hands-free mode sends speech during pauses, reads agent replies aloud, spotlights the question being discussed, and lets technicians confirm interpreted answers by voice. Manual dictation and typed conversations keep text-only replies.

Existing v1/v2 cases remain available at `/legacy` and their saved `/?case=...` links. Epoxy cases remain read-only. Controlled operating procedures and real-machine validation are still pending.

The **Learning Database** at `/knowledge` connects saved cases, symptoms, findings and outcomes in an interactive graph. Gemini can prepare experience drafts; technician publication makes them available to future diagnoses, with versioned citations and correction history.

## Project documents

- [Latest S932 requirements](docs/S932_AI_Troubleshooting_PRD.md) — current product target and staged prototype/pilot/research scope.
- [Incident workspace guide](docs/S932_INCIDENT_WORKSPACE.md) — implemented behaviour, replay walkthrough, API and limits.
- [S932 implementation audit](docs/S932_IMPLEMENTATION_AUDIT.md) — requirement coverage, verification and live-validation limits.
- [Three-person feature plan](docs/S932_REVAMP_TEAM_PLAN.md) — feature ownership and integration checkpoints.
- [Milestone development log](docs/MILESTONES.md) — M0–M3 progress, developer ownership, session history, validation, and handoffs.
- [Database Learning](docs/DATABASE_LEARNING_PLAN.md) — research, reviewed experience lifecycle, graph workspace and demo walkthrough.
- [Development guide](docs/DEVELOPMENT.md) — setup, commands, API contracts, module boundaries, and verification.
- [Legacy product requirements](docs/PRODUCT_REQUIREMENTS.md) — v1/v2 guided-repair baseline retained for existing cases.
- [Industry event-log ingestion profile](docs/LOG_INGESTION.md) — observed legacy format, parser contract, safe evidence, warnings, and production follow-ups.
- [Critical expert review](docs/EXPERT_REVIEW.md) - decisions, attribution and pending validation.
- [Domain-expert questionnaire](docs/DOMAIN_EXPERT_QUESTIONNAIRE.md) — short review form for validating the process model and troubleshooting procedure.
- [Agent issue-tracker rules](docs/agents/issue-tracker.md)
- [Agent domain-documentation rules](docs/agents/domain.md)

The photo workflow focuses on incomplete coating, coarse deposits, and recovery comparison. Example photos are AI-generated inspection illustrations; the model is a small PatchCore-style prototype, and the 3D guide remains illustrative. Data provenance and limits are documented in [Photo inspection](docs/PHOTO_INSPECTION.md) and the presentation rather than repeated across the main page.

## Run locally

Requires Node.js 22.12+, npm 10+, Python 3.12, and uv. From the repository root:

```sh
npm ci
uv sync --locked
npm run db:migrate
npm run dev:mock
```

With Make installed, use `make install` for dependencies, then `make start` (or just
`make`) to migrate the database and start both services in mock mode. `make dev`
uses configured settings; `make api` and `make web` run services individually.
Press Ctrl+C to stop the running services.

Open http://127.0.0.1:5173. On Windows, use `npm.cmd` if the PowerShell npm launcher
is broken. The mock script uses POSIX environment assignment (macOS/Linux/WSL).
For the optional legacy photo workflow, `npm run vision:setup` downloads the pretrained
backbone once; photo inference runs locally on CPU with no network request. The
legacy workspace at `/legacy` provides photo upload, anomaly heatmaps, log attachment, adaptive
questions, deterministic ranking, confirmed inspection outcomes, corrective action, verification,
and a persisted summary. Case URLs survive refresh. Run migrations when updating
an existing checkout. `/prototype` provides the version 2 offline storyboard, and
`/log-preview` retains the standalone log viewer. `/?samples=raster` retains the
older controlled-raster intake for regression and existing demonstrations. M2 adds reviewed Gemini findings,
audited evidence corrections, and an interactive 3D guide with 2D/text fallback.
The home page presents a scroll-driven Three.js story: the dispensing machine transforms into an evidence timeline, investigation plan and report. Scroll backward to reverse the scene, or use the four chapter links. It uses the existing design system, with reduced-motion support and a fallback when WebGL is unavailable. Open `/incidents` (or choose **Open workspace**) for the incident workspace. `/landing` also opens the landing page. Additive migrations
preserve old case records. The incident replay uses
bundled illustrative images and does not require the vision model download.
Copy `.env.example` to the ignored `.env`, set `GEMINI_API_KEY`, and enable
`FLOWPILOT_REASONING_ENABLED=true` for optional live explanations;
without a key, the journey uses clearly labelled deterministic findings. The optional Jev adapter
uses bounded choices and explicit fallback. `dev:mock` disables all external model calls;
see the [incident guide](docs/S932_INCIDENT_WORKSPACE.md#optional-integrations) to enable providers. See the
[M2 development notes](docs/DEVELOPMENT.md#m2-reasoning-evidence-corrections-and-3d)
for configuration, acceptance checks, and backup recordings.

Run `npm run check` for build, lint, types, contracts, and unit/integration tests.
Run `npx playwright install chromium`, then `npm run test:e2e` for browser checks.
An installed Chrome can also run the suite with `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

Adaptive Context intake: [implementation and live timing evidence](docs/ADAPTIVE_INTAKE.md), [five-minute demo rehearsal](docs/MANUAL_SYSTEM_TEST_ZH.md).
