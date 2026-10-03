# S932 Revamp — Three-Person Feature Delivery Plan

**Date:** 30 September 2026  
**Status:** Feature allocation implemented for the mock-first scope in this checkout; see the [implementation guide](S932_INCIDENT_WORKSPACE.md), [requirement audit](S932_IMPLEMENTATION_AUDIT.md) and [validation record](MILESTONES.md).  
**Scope:** The user confirmed “mock first i dont have real machine.” The working demonstration extends the P0 prototype with independent jobs, a mock file gateway, simulated communication, a learned synthetic surrogate and reviewed mock factorial experiments. Live equipment validation remains outside this delivery.  
**Domain reference:** [Asymtek S932 Consolidated Reference](Asymtek_S932_Consolidated_Reference.md).

This plan assigns ownership by feature. Each person delivers the UI, backend behaviour and verification needed for their features. Person 3 integrates the workspace shell; they are not responsible for building everybody else's UI. GitHub Issues remain the execution tracker. This document proposes ownership and does not replace historical milestone records.

The P0 boundaries and sequencing below describe the original allocation. The linked implementation audit records the later mock extensions and distinguishes working software adapters from validated live integrations.

## 1. Shared product goal

> When an S932 develops progressively insufficient flux coverage, help a technician distinguish fluid-path restriction, unstable fluid delivery and material-condition changes using traceable evidence, visual mechanism explanations and the next useful check. Prepare an engineer handoff as soon as the incident opens.

The prototype demonstrates one defect family, three competing causes, and at least two different investigation outcomes. Evidence must be able to change the leading hypothesis and next step. An inconclusive outcome is valid.

Use a labelled incident replay containing good/bad images, available pressure/mass records, a recent change and an incomplete PM record. The consolidated reference supplies development context; its conversation summaries do not establish approved operating instructions.

## 2. Ownership at a glance

| Person | Feature ownership | Main deliverable | Suggested strengths |
|---|---|---|---|
| **Person 1 — Incident response and handoff** | Incident creation, replay/import, evidence collection, persistence, lifecycle, engineer draft and report export | An incident is saved immediately, evidence arrives progressively, and an engineer-ready package stays current | API development, data handling, workflow reliability |
| **Person 2 — Investigation and knowledge** | Competing hypotheses, adaptive questions, next-check selection, result interpretation, source retrieval and reviewed learning | The investigation changes direction when new evidence warrants it | AI integration, domain reasoning, evaluation |
| **Person 3 — Evidence exploration and visual explanation** | Workspace composition, image comparison, event timeline, hypothesis-linked 3D and accessible visual interaction | A technician can see what changed, inspect the evidence and understand each proposed mechanism | Frontend interaction, Three.js, visualisation |

**Shared rule:** One owner per feature. Other people consume its agreed inputs and outputs rather than reimplementing its logic.

## 3. Person 1 — Incident response and engineer handoff

| Task | Work to deliver | Done when |
|---|---|---|
| A1. Incident foundation | Introduce a versioned incident contract alongside existing cases. Save before model calls; preserve revision checks and history. Add manual and replay triggers with duplicate detection. | A repeated trigger returns the same incident; reloading preserves its evidence and state. |
| A2. Progressive evidence capture | Import the replay package and retain original files/references. Record tool/configuration, available lot/tray/unit IDs, event time/timezone and ingestion time. Track pending, collected, unavailable and failed sources. | Missing PM data does not block creation, analysis or the initial draft; late evidence creates a new revision. |
| A3. Collection and lifecycle UI | Build trigger/import controls, collection status and incident review/closure controls. Keep investigation state separate from machine/production disposition. | Users can see partial collection, correct evidence with history retained, escalate, and close as inconclusive without inventing a cause. |
| A4. Early communication draft | Start drafting independently of diagnosis. Include known facts, unknowns, incident identity and evidence links. Version updates and preserve human edits. | A usable partial draft exists before the final diagnosis; slow or failed analysis does not erase or prevent it. |
| A5. Engineer package | Build the handoff drawer and downloadable report containing evidence, hypothesis history, checks/results, unresolved items and source references. | The exported package corresponds to a recorded incident revision and clearly states replay/synthetic status. |
| A6. Reliable updates | Implement idempotent task retries, visible failure states and checks against stale model results. Reuse existing persistence and concurrency patterns. | Older background results cannot replace newer evidence or conclusions; a failed operation can be retried without duplicates. |

**Reuse first:** [cases.py](../apps/api/src/flowpilot/cases.py), [persistence](../apps/api/src/flowpilot/persistence/), [ingestion](../apps/api/src/flowpilot/ingestion/) and existing audit/history components. Avoid extending the nozzle-only state machine into every new incident behaviour.

**Handoffs:** Give Person 2 a versioned evidence snapshot and a way to submit questions/results. Give Person 3 normalised events, artifact references, collection status and the incident lifecycle. Consume Person 2's diagnosis output when refreshing reports; the first draft must work without it.

**P0 boundary:** Draft and export only. Real machine connectivity, email delivery and production release integration belong to the pilot phase.

## 4. Person 2 — Investigation and knowledge

**Next iteration:** See the [Person Two adaptive investigation plan](S932_PERSON_2_INVESTIGATION_PLAN.md) for the proposed React Flow interaction: one question node, a recorded answer, then relevant branches and an adaptive follow-up. It uses the existing synthetic records and proposes Gemini reasoning/question generation with Jev evaluating answer readiness and selecting eligible next steps; this extension is planned work.

| Task | Work to deliver | Done when |
|---|---|---|
| B1. Three-cause investigation | Define restriction, unstable delivery and material-condition hypotheses. Store supporting, conflicting and missing evidence; retain previous assessments. | Similar symptoms can keep multiple causes open; diagnosis does not always lead to nozzle inspection. |
| B2. Adaptive discovery | Confirm discovery fields already populated by evidence. Ask only useful missing questions; accept Unknown and corrections. Build the question/answer panel. | An unknown answer requests different evidence or escalates instead of becoming an invented observation. |
| B3. Next-check selection | Define a small catalogue of checks with applicability, prerequisites, sources and expected outcomes. Choose among eligible checks/questions, abstention and escalation. | Each recommendation explains which competing explanations its result could distinguish. |
| B4. Result-driven update | Record a check's conditions and result, update hypotheses and select the next step. Build hypothesis cards and the check/result UI. | At least two replay outcomes lead to different justified next steps; a contradictory result changes the leading assessment. |
| B5. Applicable source retrieval | Index a small relevant set of passages with document/revision/configuration/source status. Keep controlled instructions, reviewed experience and secondary summaries distinguishable. | Claims link to inspectable passages; unverified or wrong-configuration material cannot enable operational instructions. |
| B6. Reviewed learning | Generalise existing case learning beyond nozzle findings. Capture supported and inconclusive outcomes as review candidates. Reuse review, versioning and withdrawal controls. | Closing a case does not automatically publish or overwrite approved knowledge. |
| B7. Decision provider and evaluation | Deliver a deterministic baseline. Add Jev if accessible, recording provider/version and fallback status. Compare rules, the existing LLM and Jev when available on the same held-out incidents. | Provider failure preserves the investigation and uses a declared fallback; measured results distinguish workflow success from diagnostic accuracy. |

**Reuse first:** [diagnosis](../apps/api/src/flowpilot/diagnosis/), [question_plan.py](../apps/api/src/flowpilot/question_plan.py), [knowledge](../apps/api/src/flowpilot/knowledge/) and existing knowledge review UI. Retain useful typed responses, citation checks and model timeouts. Existing heuristic scores must not be relabelled as calibrated probabilities.

**Handoffs:** Give Person 1 evidence-linked findings, next steps and unresolved items for the handoff. Give Person 3 stable hypothesis IDs, relevant component IDs, explanatory text and evidence links. Person 3 renders these outputs without implementing a second diagnosis engine.

**P0 boundary:** One defect family, a small check catalogue and a small searchable source set. Use labelled replay/synthetic test results. Formal physical DOE and broad equipment coverage remain later work. Stop Five-Why chains when evidence runs out; do not force an unsupported root cause.

## 5. Person 3 — Evidence exploration and visual explanation

| Task | Work to deliver | Done when |
|---|---|---|
| C1. Incident workspace | Compose the incident header, evidence area, investigation panel, expandable mechanism view and handoff drawer. Integrate Person 1 and Person 2's feature panels. | Technicians can revisit evidence and hypotheses without restarting a linear repair wizard. |
| C2. Good/bad image comparison | Show last-known-good and first-known-bad images with identities and timestamps. Reuse existing vision outputs where applicable; retain image references and limitations. | A user can inspect the source image behind an observation; missing or incomparable images are explicit. |
| C3. Evidence timeline | Display normalised image, machine and maintenance events supplied by Person 1. Show missing records, uncertain ordering and recorded clock corrections. Keep application activity distinguishable. | Selecting an event opens its evidence; the interface does not imply a precise sequence when clocks are uncertain. |
| C4. Hypothesis-linked 3D | Reuse the assembly and semantic component mapping. Add schematic explanations for the three hypotheses and preserve distinct pneumatic paths. | Selecting a hypothesis highlights its relevant components and displays its mechanism and assumptions. |
| C5. Linked exploration | Synchronise selected event, evidence revision and hypothesis across panels. Keep Observed, Inferred and Simulated labels visible. | A historical selection is identifiable; hypothetical internal states cannot be mistaken for sensor measurements. |
| C6. Accessible delivery and demo | Preserve keyboard navigation, readable labels, reduced-motion behaviour and a text/2D fallback. Assemble the two-minute demonstration with all owners. | Investigation and escalation remain usable without WebGL or animation; the complete replay can be demonstrated reliably. |

**Reuse first:** [CaseApp.tsx](../apps/web/src/CaseApp.tsx), [CaseAudit.tsx](../apps/web/src/components/CaseAudit.tsx), [PhotoAnalysis.tsx](../apps/web/src/components/PhotoAnalysis.tsx), [ProcedureViewer.tsx](../apps/web/src/components/ProcedureViewer.tsx), [AssemblyScene.tsx](../apps/web/src/components/AssemblyScene.tsx), [semantic model](../apps/web/src/prototype/model.ts) and existing design tokens.

**Handoffs:** Consume Person 1's events/artifacts and Person 2's hypothesis outputs. Return selection events and display components; persist business-state changes through the owning feature's API.

**P0 boundary:** Schematic explanation with labelled hypothetical behaviour. A calibrated or learned world model requires measured data, a defined prediction task and separate validation. Do not make model training a dependency of the prototype UI.

## 6. Agree these contracts before parallel implementation

Person 1 coordinates the shared incident contract. Each feature owner defines their own payload below; all three review one shared example incident. Reuse the repository's existing contract export approach rather than maintaining incompatible frontend and backend definitions.

| Contract | Owner | Minimum shared agreement |
|---|---|---|
| Incident | Person 1 | ID, schema version, revision, tool/configuration, replay/live mode, lifecycle and separate disposition |
| Evidence/event | Person 1 | Stable ID, artifact reference, original event time/timezone, ingestion time, association IDs, collection status and provenance |
| Hypothesis assessment | Person 2 | Stable ID, evidence revision, status/rank, support/conflict/missing evidence IDs, explanation and component IDs |
| Question/check/result | Person 2 | ID, applicability, source references, prerequisites, expected outcomes, original response/result and replay/actual status |
| Knowledge passage | Person 2 | Source ID, revision/section, configuration, authority and review status |
| Visual selection | Person 3 | Selected event/evidence revision, hypothesis ID and semantic component IDs; no duplicated diagnostic state |
| Mechanism scenario | Person 3 | Hypothesis/component mapping, model version, assumptions and visible observed/inferred/simulated status |
| Handoff/report | Person 1 | Draft version, source incident revision, content, missing facts, human edits and export status |

Collection status, source authority, human confirmation and observed/inferred/simulated status answer different questions. Keep them distinct. A collected source is not necessarily authoritative; a technician-confirmed simulated result remains simulated.

**Shared fixtures:** Agree one base incident and three labelled result variants: one supports the initial explanation, one contradicts it and redirects the investigation, and one remains inconclusive. Person 1 supplies the package structure, Person 2 defines expected diagnostic changes, and Person 3 maps the visual states. Fixtures are development examples, not evidence of real-machine accuracy.

**Shared-file coordination:** Person 1 coordinates API registration and persistence wiring; Person 3 coordinates the app shell and global styles. Each person owns their feature modules. Agree narrow changes to shared files before editing them, and regenerate shared contracts through the existing process.

## 7. Integration order

No calendar estimates are assigned because availability and the submission deadline are unknown. Build in these checkpoints; frontend and reasoning work can start with the agreed fixtures while persistence is being implemented.

| Checkpoint | Person 1 | Person 2 | Person 3 | Joint exit condition |
|---|---|---|---|---|
| **M0 — Contract and scope** | Incident/evidence format and fixture loader design | Three hypotheses, check catalogue and source status | Workspace composition and component mappings | All three consume the same example incident and agree the result branches. |
| **M1 — First complete path** | Save/import, partial collection and early draft | Baseline diagnosis and one question/check cycle | Evidence workspace, good/bad pair and timeline | Trigger → persisted evidence → investigation → partial handoff works end to end. |
| **M2 — Core differentiator** | Versioned updates, report export and inconclusive closure | Contradictory result branch, source retrieval and optional Jev adapter | Hypothesis-linked 3D and historical selection | Opposite test outcomes produce different traceable conclusions and visual explanations. |
| **M3 — Demo readiness** | Retry/stale-result checks and draft/export verification | Fallback, applicability and learning review checks | Accessibility, WebGL fallback and full-flow verification | Required P0 scenarios pass and the two-minute replay is repeatable. |

Person 3 coordinates assembling the demo; each owner fixes failures in their feature. All three participate in the final integrated run.

## 8. Acceptance ownership

The IDs below refer to the [PRD acceptance scenarios](S932_AI_Troubleshooting_PRD.md#101-acceptance-scenarios). Each lead owns verification and coordinates any cross-feature fix.

| Scenario | Lead | Supporting owner / required evidence |
|---|---|---|
| AT-01 — Duplicate trigger | Person 1 | One incident and one initial draft job for the same trigger |
| AT-02 — Missing PM record | Person 1 | Persons 2/3 show continued analysis and explicit missing data |
| AT-03 — Clock mismatch | Person 3 | Person 1 preserves times/offsets; timeline exposes uncertainty |
| AT-04 — Ambiguous defect | Person 2 | Multiple hypotheses and a distinguishing next question/check |
| AT-05 — Unknown response | Person 2 | No invented observation; alternate request or escalation |
| AT-06 — Jev unavailable | Person 2 | Declared fallback/abstention with applicability checks preserved |
| AT-07 — Contradictory result | Person 2 | Persons 1/3 preserve history and display the revised assessment |
| AT-08 — Inapplicable/unverified source | Person 2 | Operational recommendation blocked; source remains inspectable |
| AT-09 — Simulated internal fault | Person 3 | Visible hypothetical status and assumptions |
| AT-10 — Communication status | Person 1 | P0 never claims a draft/export was sent; delivery failure testing follows when sending is implemented |
| AT-11 — Inconclusive closure | Person 1 | Person 2's unresolved hypotheses remain in the report; no release implied |
| AT-12 — Learning review | Person 2 | New learning enters review without automatic publication |

Additionally, Person 1 verifies that late background results cannot overwrite newer evidence or human-edited drafts. Every owner tests the meaningful branches and failures of their feature using existing test tools. Report only checks actually run.

The PRD's acknowledgement and initial-draft latency targets are proposed benchmarks, not achieved results. Person 1 records timing conditions and measurements. Person 2 owns decision-quality evaluation; synthetic replay success must not be reported as production diagnostic accuracy or downtime savings.

## 9. Two-minute demonstration ownership

| Time | Demonstration | Owner |
|---|---|---|
| 0:00–0:20 | Trigger a replay; show saved incident, progressive collection and early draft | Person 1 |
| 0:20–0:45 | Compare good/bad images and inspect the timeline/recent change | Person 3 |
| 0:45–1:10 | Compare hypotheses and their 3D mechanism explanations | Person 2 supplies reasoning; Person 3 presents it |
| 1:10–1:40 | Answer a question, load a labelled check result and show the changed next step | Person 2 |
| 1:40–2:00 | Show traceable findings and export the engineer package | Person 1 |

Keep an alternate replay result ready to demonstrate that the application can change direction. The explanation, selected next step and handoff should all follow the actual result.

## 10. Defer until the complete P0 flow works

| Later capability | Future lead | Add when |
|---|---|---|
| Read-only live gateway and rolling evidence buffer | Person 1 | Machine exports, access, clock behaviour and data policy are confirmed |
| Email routing, approved sending and delivery tracking | Person 1 | Recipient rules and sending authorization are established |
| Broader cases, physical checks and formal mini-DOE | Person 2 | Applicable controlled methods and reviewed incident data are available |
| Calibrated subsystem simulation and learned world model | Person 3, with Person 2 on evaluation | A measurable prediction task, sufficient data and an agreed error tolerance exist |

Reuse the current React, FastAPI, SQLite and Three.js stack. No new agent framework, database migration to another product, or separate service fleet is required for this task split. Keep existing saved cases readable while introducing the incident workflow.
