# Adaptive intake questions

Context now shows one editable question at a time. Gemini plans the remaining question order and may propose one clarification when new text warrants it. The application owns valid answer values, evidence confirmation, conflict resolution, completion and diagnosis scoring.

## Runtime contract

`POST /api/intake/question-plan` is read-only. It receives a vision assessment ID, confirmed log/Board context, confirmed observations, bounded supplementary text and a state ID. It returns a validated plan, evidence references, optional exact-answer replan triggers, an optional interpretation proposal, mode and elapsed time. The server loads the photo assessment and parses the supplied log itself; raw images and complete raw logs are not sent to Gemini.

The browser allows at most two planning requests per mounted intake session, counting cancellations and timeouts. The first follows symptom confirmation. Ordinary answers advance locally. New text, evidence conflicts, an explicit plan trigger or an edit can use the second request. Unchanged request states are not repeated. Each condition may receive at most one interpretation proposal; the technician chooses whether to adopt it. Model prose never becomes an observation automatically.

Both the browser and server enforce a four-second wall-clock deadline. Gemini's transport requires a minimum 10-second timeout, so the SDK uses 10 seconds with `HttpRetryOptions(attempts=1)` while the surrounding application cancels at four seconds. The transport value does not extend the UI waiting budget. Late responses cannot overwrite edited inputs. Invalid output, unavailable service, missing configuration and timeout switch explicitly to rule guidance.

Final submission still uses `CreateCase.context`. Confirmed answers follow the existing backend evidence validation and scoring path; supplemental user text is retained in notes. No database migration or case mutation occurs during question planning. Draft input remains in component memory, as before; page reload begins a new intake session.

## Validation — 2026-09-19

- Full browser regression after the core change: **58 passed**, including both photo journeys, Learning Database, 3D, conflicts and adaptive intake.
- `npm run check` passed with **217 API tests and 9 parser tests**, including the 12-test planner suite. Type checking, lint, generated-contract checks and the production build passed.
- A final isolated Chrome rehearsal exercised **10 Context journeys** (five incomplete-coverage, five coarse-deposits), including a second request after a note about material change. It did not submit cases or modify daily case data.
- **20 planning requests; 19 live responses; 1 client deadline fallback.** All ten journeys reached an enabled Generate diagnosis button and stayed within the two-request limit.
- Browser-observed Continue-to-next-question waiting: median **2.827 s**, range **2.325–4.330 s**. The maximum includes the four-second fallback plus browser observation/rendering overhead, not an extended request deadline.
- Automated Context interactions took **5.162–7.213 s** per journey. This excludes human reading/typing and final diagnostic generation; it is not a claim that a presenter can complete Context in seven seconds. Keep the manual demo target at 60 seconds and rehearse it with the presenter.
- Earlier exploratory runs exposed the provider timeout minimum and omitted log-confirmation questions. These were corrected with an external deadline and schema constraints requiring every remaining condition. They are not counted as successful rehearsals.

The results are a small sample under the current network/provider conditions, not a latency guarantee. Real online planning is functional, but uninterrupted live success is not guaranteed; keep the explicit rule-guidance path in the demo.

## Reproduce

`UV_CACHE_DIR=.cache/uv uv run python scripts/rehearse-question-planning.py --live`

This opt-in script uses the configured Gemini model/key and runs five initial/new-information pairs for each route. Photo artifacts and timing output go to `.cache/question-plan-rehearsal/`; it never writes cases. It measures server planning time, not browser-visible waiting. Browser contract and interaction tests are in `test/e2e/adaptive-intake.spec.ts`, with invalid-output and SDK/deadline checks in `apps/api/tests/test_question_plan.py`.
