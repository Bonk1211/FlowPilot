# S932 implementation audit — mock-first scope

**Date:** 30 September 2026. **Scope:** [latest PRD](S932_AI_Troubleshooting_PRD.md), with the user's instruction to mock the workflow because no real machine is available.

The application implements an incident investigation using synthetic/replayed evidence, independent analysis and handoff jobs, three competing mechanisms, reviewed learning, simulated communication and bounded mock experiments. This document maps implementation and regression coverage. It is not a certification of production readiness or a claim that every possible input has been validated.

**Reading the evidence:** linked test files contain automated checks, not proof of model accuracy or real equipment behaviour. API/provider tests use isolated data and fake transports. Browser coverage is in [incidents.spec.ts][browser-tests]. Measured local benchmark results and their exclusions are documented separately in [S932_MOCK_EVALUATION.md](S932_MOCK_EVALUATION.md).

## Run the complete mock

```sh
npm run db:migrate
npm run dev:mock
```

Open the app, start an S932 replay and collect the next evidence. Alternatively, run `uv run python -m flowpilot.incidents.gateway --mock --once` to import the bundled normalized export. The gateway queues independent analysis and handoff work; the mock app's workers consume it. No machine, email account or model key is required. See [workspace instructions](S932_INCIDENT_WORKSPACE.md) and [gateway contract](S932_GATEWAY.md).

## Functional requirements

| ID | Implemented behaviour | Code and regression evidence | Boundary / remaining validation |
|---|---|---|---|
| FR-01 — Triggers | Manual/import/replay creation records origin, time, tool/configuration and stable identity. Duplicate trigger delivery reuses the incident; changed content under the same trigger is rejected. | [Incident core][core], [gateway][gateway]; [incident tests][core-tests], [gateway tests][gateway-tests]. | Alarm/quality signals in the demo are authored exports. No manufacturer's live alarm interface is validated. |
| FR-02 — Progressive package | Sources retain pending, collected, unavailable or failed states. An incident and partial draft exist before analysis finishes; later records append revisions. | [Core][core], [coordinator][coordinator], [gateway][gateway]; [core][core-tests], [coordinator][coordinator-tests] and [gateway tests][gateway-tests]. | The bundled package demonstrates partial collection; actual site data availability is unknown. |
| FR-03 — Good/bad and scope | Side-by-side images expose source, time and available lot/tray/unit identity. Missing images are explicit. Gateway preserves explicitly classified good/bad boundaries. | [Evidence explorer][evidence-ui], [gateway][gateway]; [gateway tests][gateway-tests], [browser tests][browser-tests]. | Classification is supplied by the fixture/exporter. Automated image registration and real inspection escape rates are not validated. |
| FR-04 — Raw evidence and timing | Original bytes have SHA-256 references; metadata hashes are separate. Event/ingestion times, timezone, original units and clock corrections remain inspectable. Corrections retain originals. | [Models][models], [artifacts][artifacts], [gateway][gateway]; [artifact][artifact-tests], [gateway][gateway-tests] and [core tests][core-tests]. | Hashes establish byte integrity, not source authenticity. Clock corrections do not rewrite original timestamps. |
| FR-05 — Recent changes | Imported context and PM records remain source-linked. Gateway matches exact tool/configuration and rejects known conflicting lot scope. | [Gateway][gateway], [core][core]; [gateway tests][gateway-tests]. | Material-change and incomplete-PM examples are synthetic. Real recipe, valve, setup and PM schemas still need an approved exporter mapping. |
| FR-06 — Early communication | A template draft is saved immediately. Independent handoff jobs can generate a typed Gemini draft when explicitly enabled; mock mode uses the declared fallback. | [Core][core], [coordinator][coordinator]; [coordinator tests][coordinator-tests]. | No external model is needed for the mock. Live model draft quality has not been established. |
| FR-07 — Draft synchronization | Findings generate versioned suggestions; active human edits remain intact. Approved communication stores immutable subject/body, recipients and source versions. | [Coordinator][coordinator], [communication][communication]; [coordinator][coordinator-tests] and [communication tests][communication-tests]. | A stale preserved draft must be reviewed and saved before approval for sending. |
| FR-08 — Communication lifecycle | Draft, approval, attempt, acceptance, uncertainty, delivery and acknowledgment are distinct. Mock events never invoke SMTP; configured sending has permission, allowlist and retry guards. | [Communication][communication], [communication UI][communication-ui]; [communication tests][communication-tests], [browser tests][browser-tests]. | SMTP logic is tested with fakes. No real message or delivery was verified; acceptance is never presented as delivery. |
| FR-09 — Evidence timeline | Source events can be selected/scrubbed; raw timing, uncertain ordering, missing records and application history remain distinguishable. | [Evidence explorer][evidence-ui], [workspace][workspace-ui]; [gateway tests][gateway-tests], [browser tests][browser-tests]. | Visual ordering is not proof that independent device clocks were synchronized. |
| FR-10 — Competing hypotheses | Restriction, unstable delivery and material condition each expose mechanism, support, conflicts, missing evidence and a next observation/check. | [Diagnosis][diagnostic], [investigation UI][investigation-ui]; [diagnostic tests][diagnostic-tests]. | Rankings are bounded prototype rules, not calibrated root-cause probabilities. |
| FR-11 — Explain updates | New answers/check results change ranks and next steps with observation links. Assessment history is retained; repeated contradictory checks do not silently erase each other. | [Diagnosis][diagnostic], [core][core]; [diagnostic][diagnostic-tests] and [core tests][core-tests]. | Existing-reference validation does not prove every explanatory sentence is semantically supported. |
| FR-12 — 3D subsystem | Hypothesis/event selection links to a schematic mechanism view with selectable component controls, 3D/2D views and separate pneumatic paths. | [Mechanism view][mechanism-ui], [workspace][workspace-ui], [semantic assembly][assembly]; [browser tests][browser-tests]. | Geometry and animation are illustrative. They are not an exact machine reconstruction or motion-log replay. |
| FR-13 — Visual status | Evidence shows Observed/Simulated according to provenance; hypotheses are Inferred; schematics and model curves are labelled Simulated with assumptions. | [Evidence][evidence-ui], [mechanism][mechanism-ui] and [simulation UI][simulation-ui]; [browser tests][browser-tests]. | The mock does not certify visual honesty across every future feature or imported asset. |
| FR-14 — Model applicability | Saved runs retain model/fixture versions, inputs, evidence context, units, output points, assumptions and validity limits. Out-of-domain parameters are rejected. | [Simulation][simulation]; [simulation tests][simulation-tests]. | The learned regression surrogate fits invented toy responses. Held-out synthetic results do not establish real S932 physics. |
| FR-15 — Discovery fields | Material, amount/coverage, frequency, recent changes and location are prefilled when supported and exposed for confirmation/correction. | [Diagnosis][diagnostic], [investigation UI][investigation-ui]; [diagnostic tests][diagnostic-tests]. | No measurement is fabricated to fill an unrecorded discovery field. |
| FR-16 — Adaptive questions | Unknown is a valid answer; available information changes the next question/check or leads to review/escalation. | [Diagnosis][diagnostic]; [diagnostic tests][diagnostic-tests], [browser tests][browser-tests]. | Adaptation is restricted to the implemented S932 defect family and check catalogue. |
| FR-17 — Bounded decisions | An optional Jev adapter receives locally eligible choices, validates its distribution/selection and records fallback on missing access, low confidence, malformed output or failure. | [Decision adapter][decision], [diagnosis][diagnostic]; [decision tests][decision-tests]. | Jev is disabled in mock startup. Transport tests and authored benchmark expectations are not Jev accuracy measurements. |
| FR-18 — Why / two How | Hypotheses expose evidence-linked causal steps, explicit unsupported limits, mechanism explanation and how to distinguish alternatives. | [Diagnosis][diagnostic], [investigation UI][investigation-ui]; [diagnostic tests][diagnostic-tests]. | The chain can stop before five Whys. The PRD's proposed interpretation of two How is retained; no hidden cause is asserted to complete a template. |
| FR-19 — Checks / mini-DOE | Replay checks state purpose, prerequisites, role, expected outcomes and stopping criteria. Mock factorial plans add bounded factors, controls, repetitions, baseline, fixed matrix and review. | [Diagnosis][diagnostic], [experiments][experiments], [experiment UI][experiment-ui]; [experiment tests][experiment-tests], [browser tests][browser-tests]. | Factors are dimensionless simulator inputs, never physical settings. A prototype passage cannot authorize equipment work. |
| FR-20 — Result feedback | Recorded replay check results update hypotheses and handoff/report; contradictions and inconclusive outcomes persist. DOE stores every planned condition and response. | [Core][core], [experiments][experiments]; [core][core-tests], [diagnostic][diagnostic-tests] and [experiment tests][experiment-tests]. | Simulated DOE responses remain separate from diagnostic evidence and do not automatically confirm a fault. Real test-result interpretation is unvalidated. |
| FR-21 — Applicable passages | Retrieval exposes exact text, document/revision/section, configuration, authority and approval. Controlled-source eligibility requires review and exact configuration. | [Source registry][knowledge], [core][core]; [knowledge tests][knowledge-tests]. | No real approved manufacturer source is seeded. Prototype checks remain non-operational even when contextual sources are retrieved. |
| FR-22 — Conflicts and summaries | Immutable source revisions retain publication/withdrawal history. Unresolved conflicts block eligibility; reviewed secondary/example content never becomes a controlled procedure. | [Source registry][knowledge], [registry UI][knowledge-ui]; [knowledge tests][knowledge-tests]. | An actual site reviewer must establish source authenticity and resolve engineering conflicts. |
| FR-23 — Incident report | Readable Markdown includes evidence/timing, assessment history, questions/checks, conclusions, source versions, notes, saved simulations, DOE and communication history, with a content digest. | [Report builder][core], [report route][routes]; [core tests][core-tests], [browser tests][browser-tests]. | The report records what the system and reviewers entered; it does not certify machine recovery or release. |
| FR-24 — Reviewed learning | Closure creates a candidate. Review/publish/withdraw is separate; source evidence/observations and prior versions persist. New evidence withdraws stale learning. | [Core][core], [experience retrieval][experience]; [core][core-tests] and [experience tests][experience-tests]. | Reviewed replay experience is contextual knowledge, not automatic proof of another incident's cause or an approved BKM. |

## Reliability, access and audit requirements

| ID | Implemented mock / software behaviour | Evidence | Remaining limit |
|---|---|---|---|
| NFR-01 — Progressive response | Persisted initial incident/template plus explicit collection/job status; later results append versions. | [Core tests][core-tests], [coordinator tests][coordinator-tests]; [browser timing](S932_MOCK_EVALUATION.md#browser-timing). | Proposed p95 targets require deployment measurement. Local service and loopback browser timings exclude real network, collection and LLM drafting. |
| NFR-02 — Resilient orchestration | Independent leased jobs, unique input fingerprints, bounded retries, stale-result rejection and startup recovery. Replay collection, analysis and draft refresh rebase only over background-job revisions; any human change still requires reload. Sends have separate durable claims and uncertainty handling. | [Coordinator tests][coordinator-tests], [communication tests][communication-tests]. | Local SQLite workflows have not been load-tested for a multi-site production deployment. |
| NFR-03 — Read-only equipment | Gateway reads approved normalized exports; mock execution uses internal simulation. No machine-command or production-release adapter is implemented. | [Gateway][gateway], [experiments][experiments]; [gateway][gateway-tests] and [experiment tests][experiment-tests]. | Actual exporter permission and device integration remain site work. |
| NFR-04 — Roles | Demo roles are visibly separate from configured credentials. View, edit, test authorization, sending, closure, publication and data management have distinct permissions. | [Access][access]; [access tests][artifact-tests], [communication tests][communication-tests], [experiment tests][experiment-tests]. | Demo role selection is not authentication. Site identity provisioning, HTTPS and credential operations require deployment review. |
| NFR-05 — Data handling | External-data policy defaults to synthetic-only; original uploads are bounded/hash-checked. Original deletion/retention retains tombstones; configured API access is audited. | [Artifacts][artifacts], [data policy][policy], [access][access]; [access/artifact tests][artifact-tests]. | Original/buffer retention is implemented; full incident-record retention, legal holds and site data governance are not established. |
| NFR-06 — Input isolation | Typed boundaries, source eligibility, bounded choices and untrusted-data prompts prevent model output from authorizing tools or equipment actions. | [Decision tests][decision-tests], [diagnostic tests][diagnostic-tests], [knowledge tests][knowledge-tests]. | Citation/schema checks are not proof of semantic grounding or complete resistance to prompt injection. |
| NFR-07 — Auditability | Evidence corrections, assessment history, source/model versions, reviewed snapshots, approvals, attempts, receipts and mock experiment conditions are retained. | [Core][core-tests], [knowledge][knowledge-tests], [communication][communication-tests] and [experiment tests][experiment-tests]. | Records are application audit data, not a certified tamper-evident or regulated record system. |
| NFR-08 — Degraded operation | Missing/failed sources, uncertain clocks, stale work, retrieval errors and unavailable providers remain visible; deterministic/text/2D fallbacks preserve investigation. | [Coordinator][coordinator-tests], [decision][decision-tests], [gateway tests][gateway-tests], [browser tests][browser-tests]. | No missing sensor value is inferred as a measured normal value. Actual connector failure modes need site testing. |

## PRD acceptance scenarios

These are covered by authored mock or transport-level tests. They are not twelve real factory trials.

| Scenario | Implemented outcome and regression evidence |
|---|---|
| AT-01 — Duplicate trigger | One incident and initial draft; repeated gateway imports attach no duplicate evidence. Approval/send identity prevents duplicate submission. [Incident][core-tests], [gateway][gateway-tests], [communication tests][communication-tests]. |
| AT-02 — Missing PM | PM remains unavailable/pending as appropriate while partial draft and analysis proceed. [Incident][core-tests], [gateway][gateway-tests], [coordinator tests][coordinator-tests]. |
| AT-03 — Clock mismatch | Raw times, separate correction and uncertainty survive ingestion and display. [Gateway tests][gateway-tests], [evidence UI][evidence-ui]. |
| AT-04 — Ambiguous defect | Three hypotheses remain available; the next question/check distinguishes the candidates. [Diagnostic tests][diagnostic-tests]. |
| AT-05 — Unknown answer | Unknown advances the investigation without becoming a fabricated measurement. [Diagnostic][diagnostic-tests] and [incident tests][core-tests]. |
| AT-06 — Jev unavailable / low confidence | Declared deterministic fallback retains local eligibility constraints. [Decision tests][decision-tests]; no real provider-quality claim. |
| AT-07 — Contradictory result | Rankings and next steps change with retained evidence/history; conflicting repeated checks cannot silently confirm a cause. [Diagnostic][diagnostic-tests], [incident tests][core-tests], [browser tests][browser-tests]. |
| AT-08 — Wrong / secondary procedure | Configuration and authority gates block operational eligibility; unresolved conflicts also block it. [Knowledge][knowledge-tests] and [diagnostic tests][diagnostic-tests]. |
| AT-09 — Simulated restriction | The mechanism view and stored model outputs remain labelled simulated with assumptions and no diagnostic approval. [Simulation tests][simulation-tests], [browser tests][browser-tests]. |
| AT-10 — Unauthorized / failed email | Separate mock events and fake SMTP tests retain failed/unknown states. No draft or SMTP acceptance is labelled delivered without a distinct attributed receipt. [Communication tests][communication-tests], [browser tests][browser-tests]. |
| AT-11 — Inconclusive closure | Reviewer can close without inventing a confirmed cause; unresolved findings persist and equipment disposition remains separate. [Incident tests][core-tests], [browser tests][browser-tests]. |
| AT-12 — Learning review | Candidate capture does not auto-publish. Reviews preserve source versions; withdrawal and later source changes remove eligibility for reuse. [Incident][core-tests], [experience tests][experience-tests], [browser tests][browser-tests]. |

### Incident-response acceptance run

Run on 3 October 2026 by the incident response and handoff owner. All listed tests passed.

| Scenario | Tests |
|---|---|
| AT-01 duplicate trigger | `test_incidents.py::test_partial_creation_deduplicates_without_diagnosis_or_machine_assumptions`, `test_incident_gateway.py::test_bundled_mock_needs_no_machine_credentials_and_archives_original_bytes` |
| AT-02 missing PM | `test_incident_gateway.py::test_pre_and_post_buffer_survive_restarts_keep_clock_and_missing_sources`, `test_incident_coordinator.py::test_jobs_are_idempotent_and_handoff_finishes_while_analysis_waits` |
| AT-10 communication status | `test_incident_communication.py::test_mock_handoff_states_never_call_mail_transport`, `::test_send_claim_is_durable_and_accepted_is_not_delivered`, `::test_receipts_are_attributed_and_cannot_fabricate_delivery_before_submission`, `::test_allowlist_auth_and_demo_mode_prevent_unapproved_delivery`; browser "mock communication records accepted/unknown and receipt states without sending email" |
| AT-11 inconclusive closure | `test_incidents.py::test_inconclusive_closure_review_export_and_late_evidence_withdrawal`; browser "inconclusive closure requires explicit demo review and learning stays a candidate" |
| Late results cannot overwrite newer evidence or human edits | `test_incidents.py::test_late_analysis_cannot_overwrite_concurrent_evidence`, `test_incident_coordinator.py::test_late_evidence_supersedes_running_result`, `::test_human_edit_is_preserved_and_old_analysis_draft_cannot_replace_current` |
| Safe actions survive background revisions | `test_incident_coordinator.py::test_safe_actions_rebase_only_over_background_job_revisions`, `::test_safe_action_retries_when_a_background_job_commits_mid_action` |

## Claims the implementation does not establish

- No real S932 connection, controlled hardware procedure, physical DOE or equipment recovery has been exercised.
- Mock good/bad images and responses do not establish production vision accuracy or root-cause accuracy.
- The learned subsystem is a surrogate of disclosed synthetic equations. It is not calibrated machine physics, a validated world model, or evidence of generalization to factory observations.
- Jev/Gemini adapters and fallbacks exist; the default mock benchmark does not run real provider comparisons. No model superiority or real diagnostic accuracy is claimed.
- Mock communication and fake SMTP tests do not demonstrate actual sending, delivery, or an engineer's acknowledgment.
- Proposed PRD goals—production p95 latency, human-rated diagnostic usefulness, complete semantic traceability, technician understanding and 30% handoff improvement—still need their stated measurements and reviewers. The local benchmark only supports its explicitly scoped results.

The next validation step, once real access exists, is to obtain approved sources and a permitted export mapping, review incident labels, and evaluate the same workflow under supervised conditions. The mock does not depend on that future access.

[core]: ../apps/api/src/flowpilot/incidents/service.py
[models]: ../apps/api/src/flowpilot/incidents/models.py
[routes]: ../apps/api/src/flowpilot/incidents/routes.py
[gateway]: ../apps/api/src/flowpilot/incidents/gateway.py
[coordinator]: ../apps/api/src/flowpilot/incidents/coordinator.py
[artifacts]: ../apps/api/src/flowpilot/incidents/artifacts.py
[diagnostic]: ../apps/api/src/flowpilot/incidents/diagnostic.py
[decision]: ../apps/api/src/flowpilot/incidents/decision.py
[knowledge]: ../apps/api/src/flowpilot/incidents/knowledge.py
[experience]: ../apps/api/src/flowpilot/incidents/experience.py
[simulation]: ../apps/api/src/flowpilot/incidents/simulation.py
[experiments]: ../apps/api/src/flowpilot/incidents/experiments.py
[communication]: ../apps/api/src/flowpilot/incidents/communication.py
[access]: ../apps/api/src/flowpilot/incidents/access.py
[policy]: ../apps/api/src/flowpilot/incidents/diagnostic.py
[workspace-ui]: ../apps/web/src/incidents/IncidentWorkspace.tsx
[evidence-ui]: ../apps/web/src/incidents/EvidenceExplorer.tsx
[mechanism-ui]: ../apps/web/src/incidents/MechanismView.tsx
[investigation-ui]: ../apps/web/src/incidents/InvestigationPanel.tsx
[simulation-ui]: ../apps/web/src/incidents/SimulationPanel.tsx
[communication-ui]: ../apps/web/src/incidents/CommunicationPanel.tsx
[experiment-ui]: ../apps/web/src/incidents/ExperimentsPanel.tsx
[knowledge-ui]: ../apps/web/src/incidents/KnowledgeRegistry.tsx
[assembly]: ../apps/web/src/prototype/model.ts
[core-tests]: ../apps/api/tests/test_incidents.py
[gateway-tests]: ../apps/api/tests/test_incident_gateway.py
[coordinator-tests]: ../apps/api/tests/test_incident_coordinator.py
[artifact-tests]: ../apps/api/tests/test_incident_access_artifacts.py
[diagnostic-tests]: ../apps/api/tests/test_incident_diagnostic.py
[decision-tests]: ../apps/api/tests/test_incident_decision.py
[knowledge-tests]: ../apps/api/tests/test_incident_knowledge.py
[experience-tests]: ../apps/api/tests/test_incident_experience.py
[simulation-tests]: ../apps/api/tests/test_incident_simulation.py
[experiment-tests]: ../apps/api/tests/test_incident_experiments.py
[communication-tests]: ../apps/api/tests/test_incident_communication.py
[browser-tests]: ../test/e2e/incidents.spec.ts
