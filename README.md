# FlowPilot

FlowPilot is an evidence-led investigation assistant for industrial fluid-dispensing defects. The hackathon MVP follows an operator-reported flux-spray coverage defect through diagnosis, guided inspection, corrective action, and verified recovery.

Existing epoxy cases are read-only. New investigations use the S-932 / DJ-2200 flux-spray scenario with separate visual and recovery gates. Expert feedback received; revised procedure approval pending.

## Project documents

- [Milestone development log](docs/MILESTONES.md) — M0–M3 progress, developer ownership, session history, validation, and handoffs.
- [Development guide](docs/DEVELOPMENT.md) — setup, commands, API contracts, module boundaries, and verification.
- [Product requirements](docs/PRODUCT_REQUIREMENTS.md) — development baseline, scope, contracts, delivery plan, tests, and video script.
- [Industry event-log ingestion profile](docs/LOG_INGESTION.md) — observed legacy format, parser contract, safe evidence, warnings, and production follow-ups.
- [Critical expert review](docs/EXPERT_REVIEW.md) - decisions, attribution and pending validation.
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
is broken. The main workspace provides the M2 API-backed investigation journey:
synthetic spray-mask measurements, log attachment, adaptive questions, deterministic
ranking, confirmed inspection outcomes, simulated corrective action, verification,
and a persisted summary. Case URLs survive refresh. Run migrations when updating
an existing checkout. `/prototype` provides the version 2 offline storyboard, and
`/log-preview` retains the standalone log viewer. M2 adds reviewed Gemini findings,
audited evidence corrections, and an interactive 3D guide with 2D/text fallback.
Copy `.env.example` to the ignored `.env` and set `GEMINI_API_KEY` for live reasoning;
without a key, the journey uses clearly labelled deterministic findings. See the
[M2 development notes](docs/DEVELOPMENT.md#m2-reasoning-evidence-corrections-and-3d)
for configuration, acceptance checks, and backup recordings.

Run `npm run check` for build, lint, types, contracts, and unit/integration tests.
Run `npx playwright install chromium`, then `npm run test:e2e` for browser checks.
