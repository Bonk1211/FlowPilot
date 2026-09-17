> Historical baseline; superseded by ../PRODUCT_REQUIREMENTS.md on 17 September 2026.

# FlowPilot — Hackathon MVP Product Requirements Document

**Document status:** Development baseline  
**Version:** 0.4\
**Date:** 16 September 2026  
**Target event:** AI Horizon Solution Challenge 2026 — NSW Automation  
**Team assumption:** Two developers, approximately three build days  

**Version 0.4 revision:** Replaced the assumed rectangular machine-log CSV with the supplied industry-style, headerless event-log profile. Added lossless raw-event retention, typed event classification, explicit-only board correlation, timezone and ordering warnings, unknown-event coverage, and safe evidence projection. The detailed adapter contract is in [LOG_INGESTION.md](LOG_INGESTION.md).

## 1. Executive summary

FlowPilot is an AI-assisted investigation tool for industrial fluid-dispensing defects. It helps process engineers move from an observed defect to an evidence-backed root-cause hypothesis, the most useful next diagnostic test, a guided troubleshooting procedure, and verified recovery.

The hackathon MVP will demonstrate one complete scenario: an operator reports visibly undersized epoxy dots, and FlowPilot investigates a possible partial restriction in the dispensing cartridge/nozzle path. The product combines a labelled synthetic inspection image, a controlled industry-style machine event log, approximately five adaptive discovery questions, technician observations, multiple specialist reasoning roles, deterministic evidence scoring, and an interactive 3D troubleshooting guide.

The MVP is not a generic chatbot, an autonomous machine controller, or a production-grade computer-vision system. Its core product story is:

> Report → Quantify → Diagnose → Inspect → Fix → Verify → Learn

The two defining experiences are:

1. **Inspectable multi-agent diagnosis:** specialist agents form and challenge hypotheses using a shared evidence record; a deterministic scoring layer produces the final ranking.
2. **Animated troubleshooting guidance:** the recommended inspection is shown step by step on a simplified, illustrative 3D dispensing-head assembly with semantic part highlighting and callouts.

These sit on top of a challenge-aligned baseline: image/problem intake, smart follow-up questions, defect identification, ranked causes, an explained diagnostic score, a troubleshooting sequence, a reusable case, and a report.

## 2. Problem statement

Inspection systems can show that a dispensing result is abnormal, but identifying why it became abnormal still depends heavily on experienced engineers. New technicians may not know which component to inspect, which test best separates competing causes, or how to safely perform that test. Troubleshooting knowledge is also fragmented across manuals, presentations, reports, and senior employees' experience.

This causes:

- slow diagnosis and avoidable downtime;
- repeated trial-and-error checks;
- poor transfer of expert knowledge to newcomers;
- weak traceability between evidence, diagnosis, action, and outcome;
- loss of learning after an incident is resolved.

## 3. Product vision

FlowPilot acts as an investigation partner for a manufacturing engineer. It observes measurable symptoms, makes its reasoning inspectable, identifies missing evidence, recommends the next best test, visually guides the technician through that test, and records the confirmed resolution as a reusable case.

It must remain useful in factories without fully connected PLC, MES, or sensor infrastructure. For the MVP, synthetic inspection images, a simulated but realistic machine-log schema, and technician input are sufficient. All simulated inputs are labelled clearly.

## 4. Target users

### Primary user

Process engineer or manufacturing technician responsible for precision fluid-dispensing quality and recovery.

### Secondary user

New technician who needs clear component identification and step-by-step guidance.

### Supporting user

Domain expert or senior engineer who validates the diagnostic rules and troubleshooting procedure. Knowledge administration is post-hackathon scope.

### User needs

- Understand what changed and how it differs from the expected result.
- See plausible causes ranked with supporting and conflicting evidence.
- Know what to check next and why that check is useful.
- Locate the relevant tubing, nozzle, valve, or material component.
- Record observations and test outcomes without writing a formal report manually.
- Reuse prior cases and legacy troubleshooting documents.

## 5. Goals and non-goals

### MVP goals

- Demonstrate one polished, end-to-end cartridge/nozzle-restriction investigation triggered by an operator report.
- Accept a preselected or uploaded synthetic dispensing image and visibly identify controlled dot abnormalities against known ground truth.
- Ask approximately five relevant discovery questions, adapting later questions to earlier answers and image evidence.
- Import one controlled industry-style machine event-log format and turn supported events into traceable evidence without discarding unknown lines.
- Start reasoning immediately while marking unreviewed derived evidence as provisional.
- Use multiple reasoning roles to consider competing root causes.
- Keep the final ranking grounded in explicit evidence and inspectable rules.
- Recommend a next test that distinguishes the leading hypotheses.
- Separate diagnostic inspection, corrective action, and recovery verification.
- Animate the inspection on a simplified 3D dispensing-head assembly.
- Support both **obstruction found** and **no obstruction found** inspection outcomes.
- Update the diagnosis after the technician records the inspection outcome.
- Verify recovery using post-action measurements.
- Generate a concise in-app completed-case summary.

### Non-goals for the hackathon

- Autonomous control of production equipment, recipes, pressure, or PLCs.
- Production-grade defect-classification accuracy.
- Automatic generation of accurate 3D meshes from photos or CAD files.
- An exact or OEM-certified digital twin of the production machine.
- Support for every dispensing process and defect type.
- Arbitrary machine-log formats, live PLC/MES connections, or automatic column mapping.
- Reliable ingestion of every possible legacy document format.
- Automatic model retraining from completed cases.
- A full enterprise knowledge graph or graph database.
- Sending email without explicit user review and confirmation.

## 6. Product principles

1. **Evidence before eloquence.** Every conclusion must point to observations, measurements, test results, or retrieved sources.
2. **Engineer remains in control.** The system recommends; the user confirms actions and root causes.
3. **No fake precision.** Use High/Medium/Low or a clearly labelled diagnostic score, not invented probabilities.
4. **One complete journey beats five partial features.** The nozzle-blockage scenario is the acceptance path.
5. **3D guidance is task-oriented.** Use a prepared model with semantic part IDs; do not spend the hackathon building a meshing pipeline.
6. **Agents share structured state.** Agents must not pass an ever-growing free-form conversation as the source of truth.
7. **Fast but falsifiable.** Diagnosis may begin with provisional evidence, but unverified inference cannot confirm a cause or close a case.
8. **Retrieved knowledge is cited.** If retrieval is added later, the interface distinguishes measured evidence, heuristic rules, retrieved text, and AI-generated explanations.

## 7. MVP scenario

### Operator-reported undersized epoxy dots

The demo begins when an operator reports that the latest inspected tray contains consistently undersized epoxy dots. The user selects a deterministic synthetic inspection image with known ground truth and attaches a controlled industry-style event log. FlowPilot quantifies the current image, extracts recognized machine events with line-level provenance, and opens an investigation without waiting for every derived fact to be confirmed. Because the supplied log contains timing, alignment, and height context rather than dispense pressure, temperature, or dot measurements, absent diagnostic telemetry remains visibly missing.

The system compares three causes:

- partial restriction in the dispensing cartridge/nozzle path;
- material viscosity change;
- trapped air bubble.

The system recommends a cartridge/nozzle inspection because its outcome best separates the leading causes. The user opens an expert-validated animated procedure on an illustrative close-up dispensing assembly and records one of two outcomes:

- **Obstruction found:** restriction becomes confirmed and FlowPilot offers the approved cleaning or replacement action.
- **No obstruction found:** restriction falls in rank, the case remains open, and material temperature/viscosity inspection becomes the next recommendation.

The polished demo follows the positive branch. Inspection, corrective action, and verification remain separate states. After the simulated approved action, a synthetic verification result returns to the golden range and the case is resolved.

## 8. End-to-end user journey

1. Operator reports visibly undersized epoxy dots.
2. User selects or uploads a controlled synthetic inspection image; the UI labels it as synthetic.
3. System overlays abnormal dots, displays quantitative measurements, and stores the derived facts as provisional evidence with visible source links.
4. User selects or uploads the sample machine event log. Recognized event families, unknown-event coverage, warnings, and evidence candidates are previewed before attachment to the same case.
5. User answers approximately five smart questions; at least one follow-up changes based on prior answers or available evidence.
6. FlowPilot begins specialist analysis without blocking on full evidence review.
7. Evidence ledger shows verified, provisional, rejected, and missing evidence with provenance.
8. Fluid-path and material/process specialists produce distinct structured findings.
9. A critic identifies unsupported claims, contradictions, and the most valuable missing observation.
10. The deterministic ranker displays the three causes with supporting, conflicting, and missing evidence.
11. FlowPilot recommends cartridge/nozzle inspection and explains how positive and negative outcomes would change the ranking.
12. User launches the expert-validated animated guide. The illustrative assembly highlights the relevant service components.
13. User records the inspection result. The negative option visibly changes the ranking and next recommendation; the polished path records **obstruction found**.
14. FlowPilot requires the critical observation to be confirmed before offering the approved corrective action.
15. User records the simulated cleaning or replacement as complete.
16. User starts a synthetic verification check.
17. FlowPilot confirms return to the golden range and marks the investigation resolved.
18. The structured case and in-app summary are stored for review.

## 9. Scope and priority

### P0 — Required for the judged demo

- Upload or select a controlled dispensing image.
- Deterministic synthetic normal and abnormal images with known ground truth and clear labelling.
- Quantitative image overlay for controlled missing, undersized, and oversized dots; the golden journey focuses on undersized dots.
- One controlled industry event-log importer plus **Use sample log**.
- Approximately five smart, adaptive discovery questions.
- Defect identification and an explained quality summary.
- Structured evidence ledger with provenance and verification state.
- Multi-agent hypothesis generation and critique.
- Deterministic cause ranking from explicit evidence weights.
- Next-best-test recommendation.
- Positive and negative inspection outcomes that change ranking and next action.
- Simplified illustrative 3D dispensing-head viewer.
- Step animation using semantic model-part IDs.
- Technician test-result entry.
- Separate inspection, corrective-action, and verification states.
- Diagnosis update and recovery verification.
- Investigation timeline and completed case summary.
- Cached/precomputed agent responses and one-click demo reset.

### P1 — Include if the core path is stable

- Node-level technician note on one model component.
- HTML report and editable email preview without sending.
- PDF export only if the full P0 flow is stable.

### P2 — Post-hackathon

- Production-grade arbitrary-document ingestion, OCR for scans/tables, and richer extraction recovery.
- Obsidian vault synchronization and graph visualization.
- More processes, causes, and procedures.
- Knowledge retrieval and an authorized Knowledge Library.
- Production-grade vision across uncontrolled images, golden-image calibration, and additional defect classes.
- Production camera, PLC, sensor, MES, and maintenance integrations.
- Rich collaborative annotations, permissions, and audit history.
- Calibrated probabilistic diagnosis.

## 10. Functional requirements

### 10.1 Problem discovery, image analysis, and process visualization

**FR-001A:** The user shall be able to upload or select a controlled dispensing image before diagnosis.  
**FR-001B:** For the demo image set, the system shall segment dot locations, calculate available geometric measurements, and overlay detected abnormalities on the image.  
**FR-001C:** The controlled demo path shall identify at least missing, undersized, and oversized dots; irregular shape and spreading are stretch classes.  
**FR-001D:** The interface shall display an explainable quality summary covering size consistency, shape consistency, position, and defect risk. Any overall score shall show its contributing metrics and be labelled as a heuristic quality score.  
**FR-001E:** After initial problem input, the system shall ask approximately five smart discovery questions covering material, size/shape symptom, frequency, recent changes, and location or distribution. Questions already answered by confirmed image evidence or user input may be skipped or replaced.  
**FR-001F:** At least one follow-up question shall change based on an earlier answer, and the interface shall explain briefly why each question matters.  

**FR-001G:** The user shall be able to upload the controlled `.log` or `.txt` event-log format or select **Use sample machine log**.

**FR-001H:** The import preview shall show filename, source digest, local time range, timezone state, recognized and unknown event counts, board-run completeness, evidence candidates, units, and warnings before committing evidence.

**FR-001I:** The adapter shall recognize board run start/finish, timer-between-boards start/stop/instruction results, fiducial search/results, frame-location correction/relative position, and height-sense start/finish/results.

**FR-001J:** The parser shall split the event envelope at the first two commas only, preserve the raw logical event and source-line range, and retain unmatched payloads as `unknown` rather than dropping them.

**FR-001K:** Missing numeric values shall remain missing and shall never become zero. The importer shall not infer output dot diameter, dispense pressure, material condition, or root cause from fields that are not present.

**FR-001L:** Timestamps without an explicit timezone shall remain local and produce a visible warning. Source order shall be preserved when timestamps move backwards.

**FR-001M:** Board runs shall be paired only through explicit board IDs. Unlabelled measurement events shall not be silently assigned to the nearest board, and machine `PASS` status shall not be presented as proof of product quality.

**FR-001:** The dashboard shall show current mean dot diameter, expected diameter, deviation, variation, and case status.  
**FR-002:** If historical inspection measurements are present, the dashboard shall plot them with the golden range and specification limits.  
**FR-003:** An operator report, not an automated drift alert, shall trigger the golden investigation flow.  
**FR-004:** Synthetic images, logs, measurements, and outcomes shall be labelled **Demo / Simulated Data**.  
**FR-005:** The user shall be able to start an investigation from the reported defect summary.

### 10.2 Evidence ledger

**FR-006:** The system shall store every observation as structured evidence with ID, value, source, timestamp, quality, and verification state.  
**FR-007:** The interface shall distinguish measured evidence, machine-log facts, technician input, heuristic inference, and missing evidence.  
**FR-008:** Evidence may be `provisional`, `verified`, or `rejected`. Diagnosis may run with provisional evidence, but provisional inference alone shall not confirm a root cause, authorize the corrective-action stage, or close a case.  
**FR-008A:** Direct values from a recognized schema and deterministic image measurements may enter provisionally without blocking the workflow; ambiguous mappings, free-text extraction, inspection outcomes, completed actions, and final resolution require explicit confirmation.  
**FR-008B:** Editing or rejecting evidence shall automatically recalculate the ranking and preserve the change in the timeline.  
**FR-009:** Agent conclusions shall cite evidence IDs rather than rely only on prose.

### 10.3 Multi-agent reasoning

The minimum viable agent team is:

1. **Fluid Path Specialist** — cartridge/nozzle restriction, tubing, valve, pressure, and trapped-air hypotheses.
2. **Material & Process Specialist** — viscosity, temperature, open time, recipe, and process-change hypotheses.
3. **Diagnostic Critic** — challenges unsupported claims, searches for conflicting evidence, and identifies missing observations.
4. **Orchestrator** — merges structured findings, applies deterministic scores, and requests the next test.

**FR-010:** Each specialist shall return structured findings containing hypothesis, supporting evidence IDs, conflicting evidence IDs, missing evidence, and source references.  
**FR-011:** The critic shall identify at least one uncertainty, counterargument, or evidence gap when one exists.  
**FR-012:** The displayed cause order shall be produced by a transparent rule/weight layer, not by an untraceable LLM probability.  
**FR-013:** The UI shall show where agents agree and disagree.  
**FR-013A:** The UI shall display concise structured findings, not raw hidden reasoning or an unbounded agent conversation.  
**FR-014:** The system shall not treat retrieved documents as instructions that override application rules or user control.  
**FR-015:** The system shall degrade to a deterministic precomputed demo response if the model API is unavailable.

### 10.4 Next-best-test engine

**FR-016:** The system shall select a test based on its ability to distinguish the highest-ranked unresolved causes.  
**FR-017:** A recommendation shall include the test name, estimated duration, required parts, instructions, expected outcomes, safety note, and rationale.  
**FR-018:** Test outcomes shall map to explicit positive or negative evidence weights for candidate causes.  
**FR-019:** The system shall recalculate the ranking after the result is submitted. **Obstruction found** shall enable the approved corrective-action stage; **no obstruction found** shall keep the case open and recommend the next discriminating check.

### 10.5 Animated 3D troubleshooting

**FR-020:** The MVP shall load one simplified, illustrative dispensing-head assembly inspired by a production precision jetting setup. It shall use stable semantic nodes such as `fluid_reservoir`, `feed_tube`, `jet_actuator`, `service_cartridge`, `nozzle`, `vision_camera`, and `substrate_tray`.  
**FR-021:** A procedure step shall be able to set camera position, highlighted node, callout text, instruction text, and caution text.  
**FR-022:** The user shall be able to play, pause, move forward, and move backward through steps.  
**FR-023:** The user shall be able to rotate, pan, and zoom the model.  
**FR-024:** A node-level technician note is P1 and shall not block the guided procedure.  
**FR-025:** The viewer shall state that it is an illustrative service model and not OEM-certified maintenance guidance.  
**FR-026:** The interface shall provide a simple 2D diagram fallback if the 3D asset or renderer fails.

### 10.6 Knowledge retrieval and legacy documents — post-hackathon

The three-day MVP shall not implement document ingestion, vector retrieval, or knowledge administration. The following requirements are retained as future product direction only.

**FR-027:** For the MVP, administrators shall preprocess a small, curated document set before the demo.  
**FR-028:** The ingestion pipeline should accept text-bearing PDF, DOCX, PPTX, and Markdown files. Scanned documents are not guaranteed.  
**FR-029:** Each chunk shall retain document title, section or slide/page, process type, equipment, defect, and revision where available.  
**FR-030:** Retrieval shall use metadata filtering plus embedding nearest-neighbour search; lexical search is desirable but not required for P0.  
**FR-031:** Retrieved passages shall be displayed with document and location citations.  
**FR-032:** A retrieved passage may support an explanation but shall not directly alter a diagnostic score unless a maintained rule links it to evidence.

#### 10.6.1 Authorized Knowledge Library — post-hackathon

This interface would make the solution maintainable by domain experts after the hackathon, but it is outside the three-day build.

**FR-KB-01:** The MVP shall support two knowledge permissions: **Viewer** and **Knowledge Admin**.  
**FR-KB-02:** A Knowledge Admin shall be able to upload a text-bearing PDF, DOCX, PPTX, or Markdown file.  
**FR-KB-03:** New content shall enter a **Draft** state and shall not be used for retrieval until an authorized user reviews and publishes it.  
**FR-KB-04:** Before publishing, the interface shall show extraction status, extracted text preview, detected sections/pages/slides, and any warnings.  
**FR-KB-05:** The administrator shall be able to add or correct title, process type, equipment, defect, component, document revision, and effective date metadata.  
**FR-KB-06:** Publishing shall create or refresh the retrieval index and record the publisher and timestamp.  
**FR-KB-07:** Updating a published document shall create a new version while preserving the prior version in audit history.  
**FR-KB-08:** An administrator shall be able to archive content; archived content shall no longer appear in new retrieval results.  
**FR-KB-09:** A **Test retrieval** action shall accept a sample question and display the passages, scores, metadata filters, and citations that would be supplied to the reasoning system.  
**FR-KB-10:** Uploaded content shall be treated as untrusted reference material and shall never override system safety rules, authorization rules, or the requirement for human confirmation.

### 10.7 Knowledge graph and Obsidian

Obsidian is treated as an optional knowledge-authoring surface, not the runtime reasoning engine.

**FR-033:** Post-MVP knowledge records may be represented as Markdown with YAML frontmatter and links between processes, symptoms, causes, tests, parts, and actions.  
**FR-034:** A graph view may be generated from these links after the hackathon.  
**FR-035:** The core demo shall not depend on Obsidian being installed or available.

### 10.8 Case completion and optional export

**FR-036:** The user shall record the confirmed root cause, corrective action, verification result, and notes.  
**FR-037:** The completed case shall retain its evidence, agent findings, ranking history, inspection result, corrective action, verification result, and timeline.  
**FR-038:** The P0 system shall show an in-app summary containing the problem, evidence, ranked causes, inspection, action, and verification.  
**FR-039:** HTML/email preview and PDF export are P1 only and shall not displace the core flow.  
**FR-040:** The MVP shall never send email automatically.

## 11. Core data contracts

### Evidence

```json
{
  "id": "EV-014",
  "key": "mean_dot_diameter_px",
  "value": 24.8,
  "unit": "px",
  "source_type": "synthetic_image_measurement",
  "source_ref": "IMG-DEMO-ABNORMAL#dots-33-40",
  "quality": "high",
  "verification_state": "provisional",
  "timestamp": "2026-09-16T10:21:00+08:00"
}
```

### Machine-event record

```json
{
  "id": "LOG-a42f10b8344bb5727115",
  "kind": "timer_between_boards_stopped",
  "occurred_at": "2026-09-13T01:15:34.095+08:00",
  "local_timestamp": "2026-09-13T01:15:34.095",
  "source_ref": "demo-machine.log#L4",
  "raw": "2026-09-13,01:15:34.095,End of Timer Between Boards,Conveyor 1 Timer Between Boards Stopped, Duration = 123.493 sec.",
  "fields": {
    "conveyor": 1,
    "duration_seconds": 123.493
  }
}
```

Unknown events use the same envelope with `kind: "unknown"`, an empty `fields` object, and the original payload intact. A machine-event record does not require or imply membership in a board run.

### Machine-run summary

```json
{
  "board_id": "78",
  "started_at": "2026-09-13T01:13:30.268+08:00",
  "finished_at": "2026-09-13T01:15:34.934+08:00",
  "status": "PASS",
  "start_source_ref": "demo-machine.log#L1",
  "finish_source_ref": "demo-machine.log#L3",
  "complete": true
}
```

This summary correlates only explicit `Run Started` and `Run Finished` board IDs. `status` is a machine-run fact whose quality meaning remains unverified.

### Agent finding

```json
{
  "agent": "fluid_path_specialist",
  "hypothesis_id": "partial_cartridge_nozzle_restriction",
  "supporting_evidence_ids": ["EV-014", "EV-019"],
  "conflicting_evidence_ids": [],
  "missing_evidence": ["nozzle_inspection_result"],
  "source_refs": [],
  "confidence_band": "medium",
  "summary": "Persistent undersizing is compatible with a flow restriction, but physical inspection is still required."
}
```

### Investigation state

```text
reported
  → diagnosing
  → inspection_recommended
  → inspection_completed
  → cause_confirmed
  → corrective_action_completed
  → verification_passed
  → resolved
```

The `no_obstruction_found` outcome returns the case from `inspection_completed` to `diagnosing` with updated evidence and a new recommended test.

### Procedure step

```json
{
  "step_id": "inspect_service_cartridge_02",
  "title": "Inspect the service cartridge and nozzle path",
  "model_node_id": "service_cartridge",
  "camera_preset": "cartridge_closeup",
  "highlight": "warning",
  "instruction": "Follow the expert-validated site procedure to inspect for visible residue or restriction.",
  "caution": "Illustrative guidance only. Follow the site's approved isolation, PPE, and material-handling procedure."
}
```

### Optional node-level note — P1

```json
{
  "id": "ANN-007",
  "case_id": "CASE-1042",
  "model_node_id": "material_tube",
  "text": "Check here for trapped air after changing the syringe.",
  "author": "technician"
}
```

## 12. Proposed system architecture

```text
Operator report
      │
      ├── synthetic inspection image → deterministic measurements
      ├── controlled event log → format adapter → lossless events + evidence candidates
      └── adaptive questions → technician observations
                              │
                              ▼
               Structured evidence ledger
          (provisional / verified / rejected / missing)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   Fluid-path specialist          Material/process specialist
              └───────────────┬───────────────┘
                              ▼
                    Diagnostic critic
                              │
                              ▼
          Deterministic ranker + next-best-test
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     Evidence/ranking UI             Procedure step schema
                                              │
                                              ▼
                                 3D viewer + text fallback
              └───────────────┬───────────────┘
                              ▼
          Inspect → fix → verify → completed case
```

Recommended implementation choices for a fast MVP:

- React and TypeScript frontend.
- Three.js or React Three Fiber for the 3D viewer.
- Python/FastAPI backend.
- SQLite for cases, evidence, state transitions, and optional notes.
- YAML/JSON for causes, weights, tests, and procedure steps.
- Parallel specialist calls followed by one critic call; use simple polling only if visible progress is needed.
- Versioned JSON fixtures for the golden case and cached fallback; avoid unnecessary real-time infrastructure.

## 13. User interface requirements

### Problem discovery

- Image upload or curated sample selector.
- Annotated result overlay and explainable quality summary.
- Machine event-log upload plus **Use sample log**, import preview, recognition coverage, and warnings.
- A focused question flow of approximately five adaptive questions.
- Visible progress and a short **Why this matters** explanation for each question.
- Non-blocking notice that provisional evidence can be reviewed while diagnosis runs.

### Dashboard

- Process name and persistent **Demo / Simulated Data** badge.
- Reported-defect summary and investigation status.
- Current measurements and, when available, historical inspection context.
- Current mean, deviation, and variation.
- **Start Investigation** action.

### Investigation workspace

- Left: evidence ledger and technician input, with filters for verified, provisional, rejected, and missing evidence.
- Center: ranked causes, agent consensus/disagreement, and cited reasoning.
- Right: recommended next test and missing evidence.
- Bottom or secondary tab: chronological investigation timeline.

### Guided procedure workspace

- Large 3D viewer with the current part highlighted.
- Persistent **Illustrative model — not OEM-certified guidance** label.
- Step title, instruction, rationale, caution, and progress.
- Play/pause, previous, next, and reset-camera controls.
- Accessible text list of all steps as a non-3D fallback.

### Completion workspace

- Verification chart comparing pre-action and post-action measurements.
- Confirmed cause and corrective action.
- In-app completed-case summary.

### Deferred surfaces

Knowledge Library, document ingestion, PDF export, email integration, rich case history, and point-level 3D annotations are not part of the three-day implementation.

## 14. Non-functional requirements

- **Explainability:** Every ranked cause must expose supporting, conflicting, and missing evidence.
- **Traceability:** Agent findings, test outcomes, and user changes must be timestamped in the case timeline.
- **Safety:** Procedures must be validated by a domain expert, display their illustrative status and site-procedure dependency, and never initiate machine control.
- **Reliability:** The full judged demo must work with cached/precomputed reasoning if network or model access fails.
- **Performance:** Dashboard interactions should feel immediate; the first reasoned result should appear within approximately 15 seconds under demo conditions.
- **Usability:** A newcomer should be able to advance through the animated procedure without prior training.
- **Accessibility:** Instructions must not rely on color alone; every highlight has a text label.
- **Security:** Uploaded images, logs, and case data remain within the selected deployment boundary; secrets are never stored in frontend code.
- **Honesty:** Simulated data, heuristic scores, illustrative models, and AI-generated content are explicitly labelled.

## 15. Success metrics and acceptance criteria

### Hackathon success metrics

- A judge completes the full scenario without developer intervention.
- A judge can select a labelled synthetic image, see abnormal dots highlighted, and understand how the quality summary was derived against known ground truth.
- A judge can attach the sample machine log, inspect recognized and unknown events, and see safe normalized facts become traceable evidence.
- The system asks approximately five relevant questions and visibly adapts at least one question to a prior answer.
- At least two specialist agents and one critic produce visibly distinct, evidence-linked findings.
- Partial cartridge/nozzle restriction ranks first for the main scenario without being presented as confirmed before inspection.
- The recommended test explains which competing causes it separates.
- The 3D guide highlights the correct model part for every procedure step.
- Selecting **no obstruction found** lowers restriction and changes the next recommendation.
- Selecting **obstruction found** confirms the cause and unlocks the approved corrective-action stage.
- Inspection, corrective action, and verification appear as distinct state transitions.
- Verification data returns to the golden range and resolves the case.
- A completed in-app case summary is produced.

### Demo definition of done

The MVP is done only when the entire flow can be run twice consecutively from a clean demo state without database edits, manual prompt changes, or developer-only controls.

### Challenge requirement coverage

| Official challenge expectation | PRD coverage | Demo proof |
|---|---|---|
| Approximately five smart questions | P0 | Adaptive discovery flow with visible rationale |
| Identify the dispensing defect | P0 | Image overlay plus confirmed symptom summary |
| Generate and rank possible causes | P0 | Specialist agents plus deterministic diagnostic score |
| Explain why a cause is ranked | P0 | Supporting, conflicting, and missing evidence |
| Recommend a troubleshooting sequence | P0 | Next-best test plus animated procedure |
| Dynamic follow-up questions | P0 | Branching question based on frequency/recent-change answer |
| Image recognition bonus | P0, controlled scope | Missing/undersized/oversized demo-image detection |
| Quality score bonus | P0, explainable heuristic | Metric breakdown rather than an opaque number |
| Learning database bonus | P0 | Completed structured case and similar-case-ready schema |
| PDF report bonus | P1 | Generated report after verified recovery |
| Beyond-chatbot industrial value | Primary differentiator | Machine-log evidence, falsifiable multi-agent critique, 3D guidance, and verified recovery |

## 16. Two-developer delivery plan

The schedule below assumes two developers and three focused build days. P1 is frozen until the full P0 journey works twice from a clean state.

| Milestone | Outcome | Developer A — Reasoning & backend | Developer B — Experience & 3D | Shared checkpoint |
|---|---|---|---|---|
| **M0: Contract and demo lock** (first 2–3 hours) | One scenario, shared schemas, fixtures, and procedure boundary | Define canonical image/log evidence, findings, scores, test outcomes, and case-state schemas | Wireframe the golden screens; define semantic 3D node names and a 2D fallback | The same versioned golden fixture loads in frontend and backend |
| **M1: Thin vertical slice** (remainder of Day 1) | Complete clickable journey with fixtures | Implement synthetic image generation/measurement, controlled event-log adapter, scoring rules, case API, and cached findings | Build report intake, overlays, log preview, questions, evidence/ranking UI, and procedure shell | Full report → diagnose → inspect → fix → verify flow works, even if visually rough |
| **M2: Core differentiators** (Day 2) | Real reasoning and guided inspection integrated | Implement specialist prompts, critic, validation, negative branch, recomputation, and persistence | Implement simplified 3D assembly, semantic highlights, state transitions, verification, and text fallback | Both inspection outcomes change the case correctly; capture a backup screen recording |
| **M3: Validation and submission** (Day 3) | Reliable prototype and 6–10 minute submission video | Add tests, fallback validation, reset endpoint, and failure handling | Polish accessibility, demo reset, recording layout, and in-app summary | Two clean rehearsals, expert procedure review recorded, final video uploaded and checked signed-out |

### Ownership boundaries

**Developer A owns:**

- schemas and APIs;
- synthetic image generation/analysis, the controlled log adapter, question branching, and evidence normalization;
- diagnostic rules and ranking;
- agent orchestration, structured outputs, and fallbacks;
- case persistence, state transitions, summary data, and reset/fallback behavior.

**Developer B owns:**

- application shell and investigation UX;
- image upload/overlay and adaptive discovery-question experience;
- log import preview and evidence-review experience;
- verification comparison;
- 3D model integration and procedure animation;
- agent findings, evidence links, timeline, and in-app summary presentation.

**Both developers own:**

- the API contract;
- fixture versioning;
- integration at each milestone;
- demo reset and offline fallback;
- the final rehearsal and judge narrative.

### Checkpoint discipline

- Freeze the shared schemas by the end of M0; changes require both developers to update fixtures in the same commit.
- Integrate at least twice per day; do not leave frontend/backend integration until the final evening.
- Maintain one golden end-to-end fixture used by UI, API, and tests.
- At each milestone, run the product from a clean database and a fresh browser session.
- Stop adding features when M2 is not stable; polish only after the core path passes.

## 17. Test plan

### Unit tests

- Deterministic synthetic normal image yields the expected ground-truth measurements.
- Deterministic synthetic abnormal image detects the expected missing, undersized, and oversized dots.
- The parser splits only the first two commas and retains the remaining payload verbatim.
- Recognized event payloads normalize with correct units and source-line references.
- A wrapped, non-timestamped continuation is retained with the preceding event and produces a warning.
- Missing numeric values remain missing and never become zero.
- Unknown events are retained and counted without failing the import.
- Timestamp regressions preserve source order and produce a warning.
- Runs correlate only through explicit board IDs; incomplete file slices remain importable with warnings.
- No absent pressure, temperature, recipe, valve-time, or dot-diameter evidence is manufactured.
- Question path changes after an intermittent-versus-continuous answer.
- A confirmed image-derived answer is not redundantly asked again.
- Provisional evidence can influence a ranking but cannot confirm a cause or resolve a case.
- Editing or rejecting evidence recalculates the ranking.
- Persistent undersizing boosts cartridge/nozzle restriction.
- Intermittent recovery boosts air bubble.
- Temperature/open-time evidence boosts viscosity change.
- Critic rejects a finding whose evidence IDs do not exist.
- **Obstruction found** and **no obstruction found** update the correct cause weights and next recommendation.
- Procedure step references a valid model node or falls back gracefully.

### Integration tests

- Investigation creation copies image, log, and technician observations into evidence with provenance.
- Re-importing identical content can be detected from the source digest without relying on the filename.
- Import preview can be cancelled without writing events or evidence to the case.
- Every displayed agent claim resolves to evidence or a cited source.
- Inspection submission recalculates ranking and appends the timeline.
- Corrective action cannot be completed before the positive inspection observation is verified.
- Verification cannot resolve a case before corrective action is recorded.
- Completed-case summary matches the stored case.

### Demo tests

- Online model path.
- Offline/cached reasoning path.
- 3D renderer failure with 2D/text fallback.
- Clean reset between judge sessions.
- Full golden flow twice from a clean state.
- Negative inspection branch visibly changes ranking and next recommendation.

## 18. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Multi-agent responses are slow or contradictory | Demo delay and loss of trust | Enforce structured outputs, parallelize specialists, use deterministic scoring, cache the golden scenario |
| Agents invent evidence or citations | Unsafe and unconvincing reasoning | Validate evidence IDs and source references; reject unsupported findings; show critic output |
| Real production image is unavailable | Vision claims look weak | Use deterministic synthetic images with known ground truth; label them clearly and avoid production-accuracy claims |
| Vendor log spelling or layout differs from the photographed sample | Recognition coverage falls or fields are misread | Keep a lossless raw-event layer, isolate the format adapter, retain unknown events, show recognition coverage, and validate against the original file |
| Procedure is unsafe or unrealistic | Loss of trust and potential harm | Require domain-expert review; keep guidance illustrative and defer unverified disassembly steps |
| 3D asset lacks semantic parts | Animation cannot target components | Build a simplified close-up from primitives with fixed semantic nodes; keep a 2D/text fallback |
| Evidence review creates friction | Slow investigation | Diagnose with visible provisional evidence; gate only ambiguous or consequential facts |
| Team overbuilds Obsidian/knowledge graph | Core workflow remains incomplete | Keep it P2; use simple YAML/Markdown relationships now |
| Vision work absorbs the schedule | Core reasoning and guidance suffer | Use generated ground-truth fixtures and simple measurement; do not train a custom model |
| Network or API access fails during judging | Core demo fails | Provide a visible demo-mode badge and deterministic cached responses |
| Video production consumes the final build window | Prototype or submission quality suffers | Finish the rough vertical slice on Day 1, capture a backup on Day 2, and reserve Day 3 for validation and recording |

## 19. Product critique and recommended cuts

The initial feature list combines three substantial products: a diagnostic engine, a 3D training system, and a knowledge-management platform. Two developers cannot make all three credible in a short hackathon.

The following decisions protect the core value:

- Replace **3D meshing** with a **prebuilt semantic 3D model**. Meshing is technically risky and does not improve the judge's understanding of the troubleshooting journey.
- Treat **Obsidian** as a future authoring/export option. Its graph view is visually interesting but is not the same as an evidence-aware diagnostic graph.
- Defer **legacy-document ingestion and the Knowledge Library** until after the hackathon. They are separate products and do not strengthen the three-day acceptance path enough.
- Use **multi-agent reasoning to expose alternative hypotheses and criticism**, not to manufacture a consensus. The deterministic evidence layer remains authoritative.
- Make **PDF and email drafting** post-core enhancements, never dependencies of the investigation flow.

## 20. Recommended feature improvement

If there is capacity for one feature beyond the core, build an **Evidence Gap / Why This Test? panel** rather than a general knowledge graph. It should show:

- what the system knows;
- what it does not know;
- which leading causes remain ambiguous;
- how the recommended test is expected to change the ranking.

This makes the multi-agent reasoning concrete, builds trust, and directly supports the product's claim that it conducts an investigation with the engineer.

A second high-value improvement is **one-click demo replay**. It makes the product resilient during judging and lets the team show the entire investigation in under three minutes.

## 20.1 Competitive positioning

The official statement already proposes questions, cause ranking, image recognition, a learning database, and PDF reporting. Implementing only those suggestions would satisfy the brief but would not clearly differentiate the team. FlowPilot should therefore present the following as one connected investigation experience:

1. **See it:** upload a dispensing image and display measurable visual evidence rather than only a label.
2. **Combine evidence quickly:** normalize safe facts from a controlled machine event log, expose what remains unknown, and ask approximately five adaptive questions without blocking on full review.
3. **Debate transparently:** show specialist agents proposing different causes and a critic challenging weak reasoning.
4. **Choose the next best test:** explain which uncertainty the test resolves instead of giving a static checklist.
5. **Show the technician exactly where:** animate the expert-validated inspection on a semantic, illustrative 3D assembly.
6. **Prove the fix:** compare post-action measurements with the golden range and close the case only after recovery.
7. **Retain trusted learning:** store the confirmed case as a reusable, structured record.

The eye-catching element is the transition from an annotated defect image to visible agent debate and then to an animated, component-specific troubleshooting procedure. The defensible industrial value is the evidence ledger, next-best-test logic, human confirmation, and recovery verification underneath that visual story.

## 21. Demo script

The submission should target approximately eight minutes within the required 6–10 minute window.

1. **0:00–0:50 — Problem and objective:** explain slow, experience-dependent diagnosis after an operator notices a dispensing defect.
2. **0:50–1:30 — Solution and differentiation:** introduce evidence-led diagnosis, adaptive questions, next-best-test selection, guided inspection, and verified recovery.
3. **1:30–2:20 — Technical design:** show the image measurement, event-log adapter, evidence ledger, specialist/critic flow, deterministic ranker, case state machine, and cached fallback.
4. **2:20–5:50 — Functional prototype:** report undersized dots; select the labelled synthetic image; attach the sample log; answer the adaptive questions; review provisional and verified evidence; compare hypotheses; show why inspection is recommended; play the 3D guide; record **obstruction found**; record the approved corrective action; verify recovery.
5. **5:50–6:50 — Testing and validation:** show ground-truth image tests, event-log normalization and lossless-fallback tests, evidence-ID validation, the **no obstruction found** branch, 3D text fallback, and offline agent fallback.
6. **6:50–7:40 — Industry value and feasibility:** explain expert procedure validation, format adapters, human control, case traceability, and future production integration.
7. **7:40–8:00 — Close:** “Inspection tells you something is wrong. FlowPilot helps determine why, what to check next, and whether the fix worked.”

Record the functioning interface rather than relying on slides alone. Upload the final video as an unlisted YouTube link and verify playback from a signed-out browser before submission.

## 22. Open decisions and recommended defaults

| Decision | Status / default |
|---|---|
| Actual build time | Confirmed: two developers, three days |
| Trigger | Confirmed: operator reports a visible defect |
| Primary process and defect | Epoxy dot dispensing with undersized dots; suspected cartridge/nozzle restriction |
| Production mechanism | Working default: non-contact precision jetting; replace terminology/model if the domain expert confirms needle dispensing |
| Vision input | Confirmed: deterministic synthetic images with known ground truth and explicit labelling; no production-accuracy claim |
| Machine log | Confirmed: controlled adapter for the supplied industry-style event-log pattern; validate exact encoding, wrapping, timezone, and semantics against the original file before production use |
| Evidence review | Confirmed: non-blocking provisional evidence with selective confirmation gates |
| Diagnostic branches | Confirmed: both obstruction-found and no-obstruction-found outcomes; polish the positive path |
| 3D model | Simplified close-up dispensing assembly with semantic nodes and an illustrative/not-OEM-certified label |
| Procedure authority | Domain-expert review available; approved wording and steps remain pending input |
| Agent/model availability | Hosted model when available plus cached structured responses |
| Knowledge, PDF, and email features | Deferred until P0 is stable; not part of the three-day baseline |
| Submission | Required 6–10 minute YouTube prototype video; target approximately eight minutes |

## 23. Final release gate

Do not call the MVP complete until all of the following are true:

- The main scenario works from operator report through verified recovery.
- A labelled synthetic image produces the expected ground-truth abnormalities.
- The controlled sample event log imports with lossless raw events, provenance, units, recognition coverage, and warnings.
- Approximately five discovery questions are asked, with at least one adaptive branch.
- Multi-agent findings are distinct, structured, and grounded.
- The cause ranking remains explainable without reading hidden prompts.
- The negative inspection result changes both ranking and next recommendation.
- Provisional evidence cannot confirm a cause or resolve a case.
- Inspection, corrective action, and verification are distinct state transitions.
- The animation points to real semantic model parts and has a text fallback.
- The completed case can be reopened.
- The demo can reset in one action.
- The team can run the full prototype path twice from a clean state.
- A domain expert has reviewed the procedure wording and safety cautions.
- The final 6–10 minute video plays from a signed-out browser using the submitted YouTube link.
