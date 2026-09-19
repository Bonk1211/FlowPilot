# FlowPilot

FlowPilot is an evidence-led investigation assistant for industrial fluid-dispensing defects. The hackathon MVP follows an operator-reported flux-spray coverage defect through diagnosis, guided inspection, corrective action, and verified recovery.

Existing epoxy cases are read-only. New investigations use the S-932 / DJ-2200 flux-spray scenario with separate visual and recovery gates. Expert feedback received; revised procedure approval pending.

The **Learning Database** at `/knowledge` connects saved cases, symptoms, findings and outcomes in an interactive graph. Gemini can prepare experience drafts; technician publication makes them available to future diagnoses, with versioned citations and correction history.

## Project documents

- [Milestone development log](docs/MILESTONES.md) — M0–M3 progress, developer ownership, session history, validation, and handoffs.
- [Database Learning](docs/DATABASE_LEARNING_PLAN.md) — research, reviewed experience lifecycle, graph workspace and demo walkthrough.
- [Development guide](docs/DEVELOPMENT.md) — setup, commands, API contracts, module boundaries, and verification.
- [Product requirements](docs/PRODUCT_REQUIREMENTS.md) — development baseline, scope, contracts, delivery plan, tests, and video script.
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
npm run vision:setup
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:5173. On Windows, use `npm.cmd` if the PowerShell npm launcher
is broken. `vision:setup` downloads and verifies the approximately 45 MB pretrained
backbone once; photo inference runs locally on CPU with no network request. The
main workspace provides photo upload, anomaly heatmaps, log attachment, adaptive
questions, deterministic ranking, confirmed inspection outcomes, corrective action, verification,
and a persisted summary. Case URLs survive refresh. Run migrations when updating
an existing checkout. `/prototype` provides the version 2 offline storyboard, and
`/log-preview` retains the standalone log viewer. `/?samples=raster` retains the
older controlled-raster intake for regression and existing demonstrations. M2 adds reviewed Gemini findings,
audited evidence corrections, and an interactive 3D guide with 2D/text fallback.
Copy `.env.example` to the ignored `.env` and set `GEMINI_API_KEY` for live reasoning;
without a key, the journey uses clearly labelled deterministic findings. See the
[M2 development notes](docs/DEVELOPMENT.md#m2-reasoning-evidence-corrections-and-3d)
for configuration, acceptance checks, and backup recordings.

Run `npm run check` for build, lint, types, contracts, and unit/integration tests.
Run `npx playwright install chromium`, then `npm run test:e2e` for browser checks.

Adaptive Context intake: [implementation and live timing evidence](docs/ADAPTIVE_INTAKE.md), [five-minute demo rehearsal](docs/MANUAL_SYSTEM_TEST_ZH.md).
