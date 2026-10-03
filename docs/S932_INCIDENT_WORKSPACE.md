# S932 incident workspace

Implementation of the [latest PRD](S932_AI_Troubleshooting_PRD.md), with the user's **mock first, no real machine** scope. The complete demonstration uses synthetic evidence, simulated communication, illustrative mechanism models and reviewed replay outcomes. It requires no equipment, email account or model key.

## Run the offline mock

```sh
npm ci
uv sync --locked
npm run db:migrate
npm run dev:mock
```

Open `http://127.0.0.1:5173/`. `dev:mock` enables the independent background analysis/handoff workers and disables external model calls. The bundled images need no vision-model download. These shell environment assignments work on macOS/Linux or WSL; on other shells set the four environment variables shown in `package.json` before running `npm run dev`.

`npm run dev` retains explicit collection/analysis controls unless `FLOWPILOT_INCIDENT_AUTO_PROCESS=true`. Saved URLs use `/incidents/INC-...`, with a separate URL for each feature below. `/legacy`, saved `/?case=...` URLs, `/knowledge`, `/prototype` and `/log-preview` remain available for the older workflows. Run migrations after updating; incident, source, original-file, job, communication, gateway and experiment tables are additive.

To demonstrate the file gateway instead of the staged replay, run this after migration, before or while the mock application is running:

```sh
uv run python -m flowpilot.incidents.gateway --mock --once
```

Open the incident URL printed by the command. Repeating the command reuses its incident and evidence. See [gateway contract and fixtures](S932_GATEWAY.md).

## Feature pages

Each incident keeps one shared context while a floating sidebar opens a focused feature page. The sidebar overlays every incident page; use **Expand navigation** to reveal page labels. On narrow screens, the navigation toggle sits at the bottom left. URLs support bookmarks, reload and browser Back/Forward; the original incident URL opens Investigation.

| Page | URL suffix | Contents |
|---|---|---|
| Investigation | `/investigation` | Competing causes, questions, checks and assessment history |
| Evidence | `/evidence` | Good/bad images, source timeline, progressive collection, original files and corrections |
| Simulation | `/simulation` | 3D/2D mechanism explanations, synthetic responses, saved runs and model evaluation |
| Experiments | `/experiments` | Factorial plans, authorization and fixed mock results |
| Handoff | `/handoff` | Editable engineer message, draft history and communication status |
| Knowledge | `/knowledge` | Applicable document revisions, source review and reviewed past incidents |
| Review | `/review` | Closure, learning publication and application activity |

Unsaved form input is retained when switching feature pages within the same incident. Save changes before reloading, closing the tab or leaving the incident. Background job status remains available across pages. Evidence and hypothesis selections carry between Investigation, Evidence and Simulation.

Evidence opens a fullscreen horizontal timeline with synchronized content below. Select a marker, use the previous/next controls or scrub through events; switch to the vertical layout when useful. Playback can advance events automatically and respects reduced-motion preferences. Expand **Compare images**, **Source files** or **Incident details** for the supporting tools and status.

## Demonstration flow

1. **Start S932 replay.** The incident and a useful partial draft are saved immediately. Analysis and handoff jobs run independently in mock mode. PM is unavailable; machine-log collection is initially pending.
2. **Open Evidence and collect next evidence.** Synthetic falling-mass/stable-pressure records and a material change arrive. Inspect good/bad images, original timestamps and event ordering uncertainty.
3. **Open Investigation and compare explanations.** Review restriction, unstable delivery and material-condition hypotheses and their separate pneumatic paths. Answer or confirm discovery questions; Unknown remains valid. A contradictory delivery check redirects the next step. Repeated conflicting checks remain separate observations.
4. **Explore the mechanism.** Select a hypothesis or scrub source events. Investigation shows the timeline beside the mechanism: selecting an event lists the hypotheses that cite it as support or conflict, and choosing one highlights its components. **Compare mechanisms** places two hypotheses side by side with their shared and distinct components. Compare the 3D/2D schematic and run the bounded synthetic model. The fixture and learned surrogate curves, held-out baseline comparison, inputs, versions and limits stay visible. These outputs do not become observed evidence.
5. **Open Handoff.** Edit and save the draft. New generated suggestions preserve human edits. Use the separately labelled mock communication flow to simulate acceptance, failure, uncertain submission, delivery and acknowledgment. No email is sent.
6. **Run a mock experiment when useful.** Propose a finite factorial study using the simulator's dimensionless factors, inspect its planned runs, use the demonstration engineer role to approve, then run the predetermined matrix. Outcomes remain simulated differences or inconclusive findings, not proof of an equipment cause.
7. **Review and export.** Close a supported replay or an inconclusive investigation. Publish or withdraw reviewed experience separately. Download the report. New evidence reopens the incident, preserves prior conclusions and withdraws stale learning.

Source files can be uploaded, hash-checked and linked to evidence. Corrections retain the original record. The controlled-source registry preserves exact passages and document revisions; publishing a secondary summary never turns it into an operating procedure. Source conflicts block operational eligibility until reviewed.

## What is implemented

| Area | Behaviour |
|---|---|
| Incident foundation | Stable trigger/tool deduplication, conflicting trigger rejection, versioned snapshots, partial collection, source scope and revision checks |
| Orchestration | Two independently leased SQLite jobs, bounded retries, startup recovery, stale-input rejection, human-draft preservation and job status/retry UI |
| Originals | Bounded raw-byte uploads, SHA-256 verification, original downloads, immutable evidence references, deletion tombstones and configurable original retention |
| Gateway | Read-only normalized JSONL export adapter, pre/post buffer, persisted checkpoints, exact tool/configuration matching, source failures and bundled mock exports |
| Diagnosis | Five discovery fields, three competing mechanisms, evidence-linked rankings, unknown/contradictory/inconclusive branches and bounded next-step choices |
| Providers | Genuine optional Jev adapter; optional typed Gemini explanation and draft generation; explicit fallbacks and an external-data policy |
| Knowledge | Immutable document revisions, exact passages, configuration and authority gates, publication/withdrawal, recorded conflicts and reviewed incident retrieval |
| Visual explanation | Good/bad comparison, event selection/scrubbing, 3D/2D component views, reduced motion, recorded synthetic simulation and held-out surrogate evaluation |
| Experiments | Reviewed, bounded mock factorial plans with controls, repetitions, response definitions, stopping conditions, fixed run matrices and versioned results |
| Communication | Editable draft and history, mock transport, optional configured SMTP approval/send, safe retry boundaries and attributed delivery/ack records |
| Access | Explicit demo roles or configured bearer credentials; separate view/edit/test/send/close/publish/data permissions and configured access audit |
| Review | Supported or inconclusive closure, retained corrections/contradictions, withdrawn stale learning, report export and persistent reload |

The source registry and legacy knowledge graph remain separate. Reviewed historical incidents are context, never automatic proof that the current incident has the same cause.

## Optional integrations

The mock works without these settings. They configure software adapters; they do not establish site approval or real-machine validation.

| Environment variable | Purpose |
|---|---|
| `FLOWPILOT_INCIDENT_AUTO_PROCESS=true` | Start independent analysis and handoff workers |
| `FLOWPILOT_REASONING_ENABLED=true` and `GEMINI_API_KEY` | Enable Gemini prose and draft generation |
| `FLOWPILOT_INCIDENT_JEV_ENABLED=true` and `FLOWPILOT_JEV_API_KEY` | Enable the official Jev typed next-step adapter |
| `FLOWPILOT_JEV_MODEL`, `FLOWPILOT_JEV_MIN_PROBABILITY` | Requested decision model and threshold; default `jev-latest` and `0.75` |
| `FLOWPILOT_INCIDENT_EXTERNAL_DATA_POLICY` | `synthetic_only` by default; `disabled` blocks external processing; `permitted` requires an actual permitted deployment/data policy |
| `FLOWPILOT_INCIDENT_AUTH_MODE=configured` | Ignore demonstration role headers and require configured credentials |
| `FLOWPILOT_INCIDENT_PRINCIPALS` | JSON array of `{subject, token_sha256, permissions}`; store only SHA-256 of a randomly generated token with at least 32 characters |
| `FLOWPILOT_INCIDENT_ARTIFACT_LIMIT_BYTES` | Original-file limit, default 20 MiB |
| `FLOWPILOT_INCIDENT_RETENTION_DAYS` | Original-file retention, default 90 days; provenance tombstones remain |

Configured permissions are `view`, `edit`, `authorize_test`, `send_email`, `close`, `publish_knowledge` and `manage_data`. The application records the authenticated identity for reviews; a submitted reviewer name cannot impersonate another user. Browser credentials remain in the current tab's session. Deploy behind HTTPS and provision/revoke site credentials through the site's actual identity process before a pilot.

The decision adapter uses the [official TypeSafe API](https://docs.typesafe.ai/api). It sends text/JSON and validates the complete distribution and selected eligible ID. Low-confidence, malformed, failed or timed-out responses retain the recorded deterministic choice. Choice probabilities are not fault probabilities. Gemini citation validation checks references and explicit uncertainty; it does not prove the prose semantically correct.

Real mail additionally requires `FLOWPILOT_INCIDENT_EMAIL_RECIPIENTS` (JSON allowlist), `FLOWPILOT_INCIDENT_SMTP_HOST`, `FLOWPILOT_INCIDENT_SMTP_FROM`, and optional port/username/password. STARTTLS is required by default; implicit TLS uses port 465. Real sending requires configured `send_email` permission and a separately approved current snapshot. SMTP acceptance is not delivery. An uncertain post-submission failure cannot be blindly retried. Mock communications cannot enter the SMTP path.

## APIs and verification

The generated OpenAPI contract is authoritative. Main routes are:

- `/api/incidents` and `/api/incidents/replay`: create/list incidents.
- `/api/incidents/{id}/actions`, `/report.md`, `/experience`: investigate, export and retrieve reviewed context.
- `/api/incidents/{id}/artifacts`: original-file upload/list/download; deletion requires `manage_data`.
- `/api/incidents/{id}/jobs` and `/api/incident-jobs/status`: independent work and retry state.
- `/api/incident-knowledge`: document revisions, passages, conflicts and reviews.
- `/api/incidents/{id}/communications`: approvals, send attempts, receipts and isolated mock events.
- `/api/incidents/{id}/simulation` and `/api/incident-simulation/demo`: recorded synthetic runs and model evaluation.
- `/api/incidents/{id}/experiments`: mock plans, approval, execution and withdrawal.
- `/api/incident-access` and `/audit`: access mode, authenticated permissions and audit history.
- `/api/incident-artifacts/retention?dry_run=true`: inspect expired originals; `dry_run=false` removes bytes and invalidates linked current evidence.

```sh
npm run contracts:generate
npm run check
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=2
PLAYWRIGHT_CHANNEL=chrome npm run test:timing   # optional local browser timing
```

Alternatively install bundled Chromium with `npx playwright install chromium` and omit `PLAYWRIGHT_CHANNEL`. API/browser tests use temporary databases and disable paid providers. See [mock evaluation](S932_MOCK_EVALUATION.md) and [milestones](MILESTONES.md) for measured checks.

## Limits of the mock

The model is a small regression surrogate of declared toy equations trained on synthetic examples, with incident/condition groups held out before fitting. It is not a validated S932 world model. Synthetic scores establish the evaluation workflow, not real spray-physics accuracy, diagnostic usefulness, reduced downtime or the proposed 30% handoff saving.

No controlled manufacturer originals, approved physical DOE, real equipment export mapping or actual engineer responses are supplied. Site qualifications, validated source procedures, real data, calibration and supervised outcome studies remain required before operational use. The prototype cannot command equipment or release production. Original-file retention is implemented; full site record-retention/legal-hold and identity-provider integration require the site's policy.
