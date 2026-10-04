# S932 mock evaluation

The benchmark verifies the prototype using authored synthetic data. It does not establish real-machine diagnostic accuracy, approved procedures, semantic traceability, production latency or technician time savings.

## Run the offline benchmark

From the repository root:

```sh
.venv/bin/python scripts/benchmark-incidents.py --samples 20 --output /tmp/s932-mock-evaluation.json
```

Omit `--output` to print JSON to stdout. The sample count accepts 1–1000. Each run creates and migrates a temporary SQLite database, removes it afterward, and restores the process environment. It never writes the configured application database. Background workers and live model processing are disabled for latency measurements.

The report includes:

- Local persisted incident acknowledgement and first-template observation latency: p50, p95, minimum and maximum.
- Duplicate-trigger latency and an assertion that duplicate delivery returns the existing incident.
- Python, OS, architecture, logical CPU count, NumPy version and incident JSON package size.
- Ten fixed, immutable synthetic decision cases with unique `HELDOUT-*` IDs, their authored expected next steps, actual selections, unknown/inconclusive states and source restrictions.
- Reference-ID existence checks. These are structural checks; a reviewer must assess whether each cited source supports the claim.
- The illustrative simulation's training/held-out split, learned-model errors, constant-baseline comparison, declared tolerances and limitations.

Latency measures a local service call through SQLite commit. It excludes browser/HTTP/network overhead, image transfer, machine collection and live LLM drafting. The first template is returned with the acknowledgement, so its observation time is the same bound. Migration/startup time is excluded; the first measured service call is included. Image content is referenced, not included in package-byte counts.

The PRD's proposed p95 targets are 2 seconds for acknowledgement and 15 seconds for an initial draft. Passing this local template measurement does not establish an LLM-draft or production SLA.

## Recorded offline smoke run

Executed on 30 September 2026 with 20 latency samples, Python 3.12.12, macOS 26.5.1 arm64, 10 logical CPUs and NumPy 2.5.3. The complete result is preserved in [S932_MOCK_BENCHMARK.json](S932_MOCK_BENCHMARK.json).

| Measurement | p50 | p95 |
|---|---:|---:|
| Persisted acknowledgement / first-template observation | 3.191 ms | 7.166 ms |
| Duplicate trigger | 1.324 ms | 2.285 ms |

Each replay request contained 2,621 JSON bytes, excluding referenced image bytes. All ten authored workflow expectations matched. Jev and Gemini comparisons were **not run**. These small-sample timings describe this execution only; rerun on the intended deployment hardware.

The decision fixtures cover ambiguous evidence, structured delivery/material/restriction signals, a contradictory result, all-inconclusive checks, an Unknown answer, an inapplicable configuration, conflicting repeated observations and rejection of a result labelled as physical. Every fixture is invented, including negative provenance labels. They are workflow checks, not an independently validated fault dataset.

## Browser timing

The service benchmark above excludes the browser. A separate Playwright run measures the replay flow a technician sees under `dev:mock` settings (background jobs on, external reasoning and Jev off):

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:timing
TIMING_ITERATIONS=30 PLAYWRIGHT_CHANNEL=chrome npm run test:timing
```

Each value runs from the triggering click to the first visible DOM state showing the result, timed inside the page so Playwright's retry polling does not round it. Analysis waits for that click's own saved status, not an earlier background result. One warm-up run is excluded. Output goes to `artifacts/demo/timing/` (ignored by Git).

Executed on 3 October 2026 with 30 iterations on an Apple M5, macOS 26.6.2, Chrome via Playwright 1.63.0, Vite 8.3.0 dev server and a local FastAPI/SQLite API. The complete result is preserved in [S932_BROWSER_TIMING.json](S932_BROWSER_TIMING.json).

| Measurement | p50 | p95 | Maximum |
|---|---:|---:|---:|
| Start replay → incident workspace visible (acknowledgement) | 48.3 ms | 63.1 ms | 66.1 ms |
| Open Handoff → saved draft visible | 18.2 ms | 25.3 ms | 31.5 ms |
| Analyze → investigation result saved and visible | 32.7 ms | 49.3 ms | 49.4 ms |

The replay creation response already contains the saved template draft, so the draft exists at acknowledgement; the second row only measures opening the Handoff page. These numbers are a single local run on loopback with synthetic data. They exclude real network latency, equipment collection, image transfer and LLM drafting. Meeting the PRD's proposed 2-second acknowledgement target here does not establish a production result.

This run also exposed a demo-mode race. A background analysis or draft job could save a new incident revision between the page's 2-second job polls, so an immediate "Collect next evidence" or "Analyze" click failed with "Incident changed". Replay collection, analysis and draft refresh now apply to the current revision when only background-job revisions intervened. Every other action, and any human change in between, still requires reloading.

## Optional provider comparison

The default report marks Jev and LLM results `not_run`; it never substitutes fabricated provider answers or accuracy figures. An explicit command can permit real, potentially billable **shadow** requests:

```sh
.venv/bin/python scripts/benchmark-incidents.py --samples 20 --providers jev llm --output /tmp/s932-provider-evaluation.json
```

This requires the corresponding configured key (`FLOWPILOT_JEV_API_KEY` or `GEMINI_API_KEY`), an external-data policy that allows the fixture, and enabled live reasoning for Gemini. Credentials never appear in the report. `--providers` opts Jev into this benchmark only; it does not change persistent application configuration.

Both comparisons receive the same eligible next-step catalogue used by the application. Jev uses the real bounded adapter with its configured threshold. The LLM comparator returns a validated choice and evidence references and does not modify application incidents. Source/review gates with a single eligible option need no provider call and are recorded separately. Provider failures, missing keys and policy blocks remain explicit. The negative-provenance fixture is blocked by `synthetic_only` policy even though the benchmark author invented its contents.

Per-case agreement means agreement with an authored workflow expectation. It is not proof that a model diagnosed a machine correctly, and it should not be described as general model superiority.

## Illustrative learned subsystem

`s932-illustrative-surrogate-2` fits separate second-degree polynomial regressions to a disclosed synthetic response generator. The generator depicts increasing restriction, oscillating delivery and increasing material resistance. Its coefficients, scalar coverage response and dimensionless ratios are illustrative assumptions. Version 2 keeps the same equations, fit and errors as version 1 and adds illustrative channels (supply pressure, feed flow, open path, flow resistance, valve duty, spray width) derived from those equations to drive the 3D view. None of them is a sensor reading; valve actuation is not modelled. The benchmark JSON records the version that was current when it was run.

Training uses 120 synthetic incidents / 1,560 sequence points. Evaluation uses 27 other incidents / 351 points; complete operating-condition pairs and severity levels are held out before fitting. A test changes held-out targets and verifies fitted coefficients remain identical. All data still comes from the same toy generator; this is not evidence of transfer to real equipment.

| Held-out error | Learned surrogate | Constant training-mean baseline | Declared synthetic MAE tolerance |
|---|---:|---:|---:|
| Relative mass MAE | 0.00795 | 0.16069 | 0.08 |
| Coverage-fraction MAE | 0.01156 | 0.07424 | 0.06 |

The report also includes maximum errors and per-scenario errors. A synthetic pass requires both MAE limits and improvement over the constant baseline. Every simulation remains `simulated`, `synthetic_only` and `approved_for_diagnosis: false`, regardless of its synthetic score.

## Verification

```sh
.venv/bin/pytest apps/api/tests/test_incident_benchmark.py apps/api/tests/test_incident_simulation.py apps/api/tests/test_incident_decision.py
```

Default benchmark tests forbid HTTP calls and place a sentinel at the configured database path to verify it remains unchanged. Adapter tests use HTTP mocks to verify response validation and fallback behaviour; those mocks are not reported as model-quality measurements. Semantic source support and the PRD's proposed 30% handoff-time improvement require separate human-reviewed evaluations.
