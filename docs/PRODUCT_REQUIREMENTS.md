# FlowPilot - Hackathon MVP requirements

**Version:** 0.6 / 19 September 2026

**Status:** Flux-spray development baseline; revised procedure approval pending.

## Product and scope

FlowPilot helps process engineers and manufacturing technicians investigate reported flux-spray defects using traceable evidence, specialist findings, deterministic diagnostic scores, and illustrative inspection guidance. The active scenario is the expert-described S-932 / DJ-2200 non-contact atomized flux process with bulk feed (BFS).

The golden journey is: report declining coverage, quantify the synthetic pattern, answer approximately five adaptive questions, compare causes, record authorized nozzle inspection, confirm obstruction, record simulated nozzle cleaning/replacement, verify recovery, and explicitly resolve the simulated case. A negative nozzle inspection leaves the case open and redirects checks.

All images, procedure geometry, recovery results and case outcomes are labelled simulated. The system does not control equipment, authorize maintenance, connect to ATRMS, release production lots, or provide production-grade vision. One restriction-recovery path is complete; other repair paths and arbitrary log ingestion remain out of scope.

## Evidence and diagnosis

- Independently measure pixels in normal, incomplete, coarse/blobbed, shifted and overspray masks. Display target coverage (%), uncovered area (square pixels), pattern displacement (pixels), coarse area and material outside the keep-out boundary. Images cannot establish weight, thickness or pressure.
- Preserve operator reports, adaptive answers, image evidence and optional logs with provenance, timestamps, units and provisional/verified/rejected status. Unknown answers carry no diagnostic weight.
- Compare fluid-path restriction, coaxial-air/atomization fault, fluid-pressure/BFS supply fault, nozzle/alignment/recipe fault, and material-condition/idle-purge issues. Weights are keyed by hypothesis ID; display heuristic points with contributions, never probabilities.
- Fluid-path specialist covers restriction, atomization and supply; material/process specialist covers alignment and material condition. The critic identifies unsupported claims and missing evidence. Validate citations and coverage before accepting a whole live run; fall back to labelled cached findings on failure.
- Falling weight is compatible with several causes. Stable weight with blobs favors atomization; shifted coverage warrants alignment checks. Rising pressure demand proves no cause. A clear nozzle cannot exclude upstream restriction.
- Confirmed obstruction establishes the observed restriction, not exclusive causality or recovery. Provisional observations cannot authorize corrective action or resolution.
- Retain lossless log ingestion, explicit-only board correlation, timezone/order warnings and unknown records. Machine PASS is not quality acceptance. Potential field availability does not establish export syntax; new adapters need original examples.

## Inspection and recovery

- Illustrative geometry identifies BFS bottle/pickup, tubing, fluid QDs, DJ-2200 valve, nozzle, surrounding air cap, camera and substrate. Separate BFS pressure, valve-actuation air and coaxial air. Share semantic IDs and provide keyboard controls, reduced motion and 2D/text fallback.
- Stop/contain and external observations precede service. Show operator/maintenance boundaries and prohibitions. Controlled site procedures determine machine state, isolation, PPE, tools and settings; the illustration does not authorize physical service.
- After no nozzle obstruction, recommend air-cap installation/centering, coaxial air, fluid-pressure stability, BFS/QDs/tubing, maintenance valve checks, material/pot-life/idle-purge checks, then offsets/recipe teaching. Keep the case open.
- Record simulated nozzle cleaning or replacement separately from verification.
- Require confirmed Prompted Setup, calibration pass, weight and pressure compliance against a named reference, and all-unit visual acceptance on the first carrier per lane. The synthetic profile contains lanes A and B.
- Synthetic visual acceptance requires full target coverage, displacement at most one pixel, no coarse deposits and no material outside the boundary. These are demonstration criteria, not production specifications.
- Subsequent-tray applicability must be explicit; if required, at least five trays must be accepted. Unknown or failed checks block resolution. Calibration alone cannot pass recovery.
- Persist calibration attempts/failures. Two confirmed failures require escalation and block ordinary retries. Resolution records a simulated case, never a lot-release decision.

## Contracts and compatibility

Version 2 fixtures are shared by the API and offline storyboard. New cases carry scenario/rules version 2.0 and spray measurements. Recovery records include setup/calibration/limits checks, lane acceptance, subsequent-tray applicability and explicit confirmation. Inspection scope is nozzle-only. Existing endpoint paths remain; generated OpenAPI and TypeScript describe the new shapes.

Untagged/version 1 epoxy cases retain their original evidence, measurements, scores, findings, timeline and summaries. Reads do not recalculate them; all mutations are rejected. No destructive migration is needed. The UI offers a read-only archive and new flux investigation link.

## Acceptance and delivery

Run build, lint, types, API/reference tests, contract checks and browser tests. Verify positive recovery, negative handoff, independent pixel measurement, five cause signatures, citation/fallback behavior, corrections, recovery failure gates, legacy persistence, offline storyboard and accessible viewer behavior.

Regenerate the contract-review candidate after covered changes. Passing tests do not establish joint acceptance or expert approval. See [critical review](EXPERT_REVIEW.md), [original response](archive/expert-response.md), and [historical baseline](archive/PRODUCT_REQUIREMENTS-v0.4.md).

## Unchanged cross-cutting requirements

Evidence auditing and case retention remain required. The user has promoted reviewed case learning and its graph workspace into current scope; document ingestion and enterprise knowledge administration remain future work.

### 10.2 Evidence ledger

**FR-006:** The system shall store every observation as structured evidence with ID, value, source, timestamp, quality, and verification state.  
**FR-007:** The interface shall distinguish measured evidence, machine-log facts, technician input, heuristic inference, and missing evidence.  
**FR-008:** Evidence may be `provisional`, `verified`, or `rejected`. Diagnosis may run with provisional evidence, but provisional inference alone shall not confirm a root cause, authorize the corrective-action stage, or close a case.  
**FR-008A:** Direct values from a recognized schema and deterministic image measurements may enter provisionally without blocking the workflow; ambiguous mappings, free-text extraction, inspection outcomes, completed actions, and final resolution require explicit confirmation.  
**FR-008B:** Editing or rejecting evidence shall automatically recalculate the ranking and preserve the change in the timeline.  
**FR-009:** Agent conclusions shall cite evidence IDs rather than rely only on prose.


### 10.6 Case Learning Database — current scope

**FR-LB-01:** Each saved investigation is one database record. Confirmed inspection/action/verification outcomes automatically prepare experience drafts, optionally summarized by Gemini. Only explicit technician review publishes reusable knowledge.
**FR-LB-02:** The graph-first Learning Database provides search/status/process/symptom filters, source evidence, versions and review controls. Counts derive from saved data; unreviewed and unresolved cases remain visible.
**FR-LB-03:** New diagnoses retrieve at most three compatible published experiences, with source/version, matching conditions and unknown applicability. History affects explanations/check focus, not fixed score rules or current workflow confirmations.
**FR-LB-04:** Disputes, archives and revisions remove old advice from effective retrieval. Factual source changes require new review. Old diagnostic snapshots retain original citations and indicate changed references.
**FR-LB-05:** Case evidence and historical references use distinct namespaces. Model failure retains truthful deterministic behavior. No-match/unknown conditions never fabricate cases, measurements or successful repairs.
**FR-LB-06:** Exclude self/future/incompatible sources; group equivalent simulated experience. Preserve source locks, legacy payloads, optimistic concurrency and atomic publication/rollback.

Implementation, API contracts, research and limits: [Database Learning](DATABASE_LEARNING_PLAN.md).

#### 10.6.1 Legacy document retrieval — future direction

Document ingestion and vector retrieval are outside this case-learning increment. The following document requirements remain future direction only.

**FR-027:** For the MVP, administrators shall preprocess a small, curated document set before the demo.  
**FR-028:** The ingestion pipeline should accept text-bearing PDF, DOCX, PPTX, and Markdown files. Scanned documents are not guaranteed.  
**FR-029:** Each chunk shall retain document title, section or slide/page, process type, equipment, defect, and revision where available.  
**FR-030:** Retrieval shall use metadata filtering plus embedding nearest-neighbour search; lexical search is desirable but not required for P0.  
**FR-031:** Retrieved passages shall be displayed with document and location citations.  
**FR-032:** A retrieved passage may support an explanation but shall not directly alter a diagnostic score unless a maintained rule links it to evidence.

#### 10.6.2 Authorized document library — future direction

Enterprise roles and uploaded-document administration are separate from the implemented single-user case-experience review workflow.

**FR-KB-01:** A future deployment shall support two knowledge permissions: **Viewer** and **Knowledge Admin**.
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

The current graph is a Cytoscape.js view of stored case and knowledge relationships, with typed edges, sources, click-through details and keyboard equivalents. Obsidian informs global/local graph interaction; it is not a runtime dependency.

**FR-033:** Post-MVP knowledge records may be represented as Markdown with YAML frontmatter and links between processes, symptoms, causes, tests, parts, and actions.  
**FR-034:** The current database shall provide a graph of cases, symptoms, components, possible causes, findings, actions and outcomes. Connections do not establish causality; each link exposes source and status.
**FR-035:** The core demo shall not depend on Obsidian being installed or available.

### 10.8 Case completion and optional export

**FR-036:** The user shall record the confirmed root cause, corrective action, verification result, and notes.  
**FR-037:** The completed case shall retain its evidence, agent findings, ranking history, inspection result, corrective action, verification result, and timeline.  
**FR-038:** The P0 system shall show an in-app summary containing the problem, evidence, ranked causes, inspection, action, and verification.  
**FR-039:** HTML/email preview and PDF export are P1 only and shall not displace the core flow.  
**FR-040:** The MVP shall never send email automatically.


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


Ownership remains unchanged; shared fixtures and integration require joint review.
