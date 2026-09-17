> **17 September 2026: active baseline changed.** Expert feedback replaces epoxy-dot dispensing with S-932 / DJ-2200 flux spraying. See [critical review](EXPERT_REVIEW.md). Historical entries below describe earlier work; version 2 joint review and revised procedure approval remain pending.

## 17 September 2026 - Flux scenario implementation and validation

- Replaced the active epoxy-dot scenario with version 2 flux-spray measurements, five cause families, BFS/DJ-2200/air-cap geometry, nozzle-only inspection, and structured recovery gates. Both offline outcomes require confirmation.
- Preserved version 1 cases as read-only without changing stored payloads. The observed log parser remains unchanged.
- Validation: `npm run check` passed (lint, types, nine parser tests, 127 API tests, generated contracts, production build). On this Windows environment, pytest used fresh workspace-local temporary/cache directories because the existing system temp folder denied access.
- Browser validation: 37 tests passed in the full run; the remaining test passed after correcting its calibration combobox selector. All 38 scenarios passed across those runs, including escalation persistence, archived-case controls, responsive layouts, WebGL fallback, playback and both inspection branches. Procedure and recovery screenshots were visually reviewed.
- Shared golden-fixture tests and contract-review hash consistency passed after the final provenance update. Live provider calls were not rerun; reasoning coverage/citation/fallback behavior was validated with mocked provider tests.
- Build retains the existing large lazy Three.js chunk warning. Expert procedure approval and joint acceptance of the new candidate remain pending; no acceptance or release was inferred from automated checks.

# Milestone development log

Track implementation progress, decisions, verification, and developer handoffs here.
The [PRD delivery plan](PRODUCT_REQUIREMENTS.md#16-two-developer-delivery-plan)
defines milestone scope. GitHub Issues remain the task tracker; link related issues
and PRs in entries when available. This log records what was actually delivered.

## How to update this log

1. Before starting work, read the relevant milestone's remaining work and handoff.
2. After each meaningful implementation session, append a dated entry under that
   milestone using the template below. Keep earlier entries as history.
3. Update the overview, checklists, and next handoff in the same change as the code.
   Record partial progress and blockers even if the milestone is unfinished.
4. Record the commands actually run, their results, and any environment workarounds.
   Distinguish fixture demonstrations from working backend behavior. Never carry
   earlier test results forward as proof of untested changes.
5. Mark a milestone complete only when both developers' deliverables and its shared
   checkpoint have evidence. If a regression reopens it, append the reason and
   change its current status without deleting the original completion entry.

Use **Not started**, **In progress**, **Blocked**, or **Complete** for status.
For blocked work, name the dependency and the next action needed to unblock it.
Use dates in `YYYY-MM-DD` format; include `+08:00` for local timestamps when needed.

## Overview

Last updated: **2026-09-17**. Status reflects this checkout and recorded sessions;
it does not assert progress on another developer's branch.

| Milestone | Current status | Developer A — backend | Developer B — experience | Shared checkpoint |
| --- | --- | --- | --- | --- |
| M0 — Contract and demo lock | In progress | Version 2 flux contracts and recovery gates ready for review | Flux storyboard, semantic nodes, and 2D fallback implemented | Shared v2 fixture loads in API and UI; joint contract freeze pending |
| M1 — Thin vertical slice | Complete | Flux workflow and confirmed-inspection gap correction verified | Recovery reload and fresh retry confirmation verified | 129 API tests and all 38 offline browser scenarios pass |
| M2 — Core differentiators | Complete | Five-cause live specialists and critic validated with persisted cases | Flux 3D, recovery, negative handoff, and reload verified | Both v2 live journeys pass; fresh positive/negative backup videos captured |
| M3 — Validation and submission | Not started | End-to-end fallback/reset validation remains | Accessibility polish, rehearsals, and final video remain | Two clean rehearsals, recorded expert review, and checked submission |

## M0 — Contract and demo lock

**Goal:** Agree on one scenario, shared schemas and fixtures, golden screens, and
the illustrative procedure boundary.

### Deliverables and checkpoint

- [x] **Shared:** Implement the version 2 S-932 / DJ-2200 flux-spray scenario with
  restriction, atomization, supply, alignment, and material-condition candidates.
  Joint scenario/contract acceptance remains pending below.
- [x] **Shared:** Add authoritative Pydantic contracts and generated OpenAPI/TypeScript
  declarations for the golden prototype, including both inspection outcomes.
- [x] **Shared:** Use one versioned golden fixture in the backend and frontend,
  including a bundled offline copy imported from the same source file.
- [x] **Developer B:** Add navigable golden-screen wireframes at `/prototype`.
- [x] **Developer B:** Define flux-assembly semantic model nodes and camera presets.
- [x] **Developer B:** Implement synchronized SVG and text procedure views with
  graceful handling of unavailable node mappings.
- [x] **Shared:** Verify API/fixture equality, contract drift, outcome branches,
  confirmation gates, offline behavior, and responsive layouts.
- [x] **Shared:** Record negative inspection completion before reassessment and
  cover timeline ordering and branch evidence isolation with regression tests.
- [ ] **Both developers:** Review and freeze the shared contract/fixture boundary
  before independent M1 implementation. Record review evidence here.

### Development history

#### 2026-09-16 — Developer B: prototype and shared-contract implementation

**Delivered:** Added Report, Log, Questions, Diagnose, Inspect, Correct, Verify, and
Summary screens. Both inspection outcomes are reachable. The positive path separates
observation confirmation, corrective action, verification, and resolution; the
negative path keeps the case open and recommends reviewing material conditions.
Added restart/back controls, evidence-linked score explanations, specialist/critic
examples, and the semantic 2D procedure guide.

**Shared work:** At Developer B's request, this session also implemented the missing
shared M0 contracts. Added `GET /api/demo/golden-scenario` and
[`fixtures/v1/golden-scenario.json`](../fixtures/v1/golden-scenario.json), version
`1.0`. The API validates the fixture without database access. The frontend consumes
the same fixture when the API is unavailable. Existing Report/log-preview behavior
remains available at `/`.

**Decisions and boundaries:** Question answers demonstrate branching but do not
recompute diagnosis. Scores, images, outcomes, and timelines are precomputed.
Nothing is persisted by the prototype. Procedure wording is pending expert review;
the diagram is illustrative. Real analysis and workflow execution belong to M1/M2,
and 3D rendering/animation belongs to M2.

**Verification recorded in the implementation session:**

- `npm run check`: passed lint, type checks, 9 reference-parser tests, 39 backend
  tests, contract drift checks, and the production build.
- `npm run test:e2e`: all 21 browser tests passed, including existing foundation
  coverage and both prototype branches.
- Reviewed desktop and mobile screenshots. After the final fixture-text and mobile
  skip-link corrections, reran the 8 golden-fixture backend tests and the 375px
  prototype browser check; both passed. `git diff --check` also passed.
- Windows workaround: the full check used isolated workspace pytest temporary/cache
  directories because existing system temporary-directory permissions caused errors.

**Next handoff:** Developer A should review the generated contracts and fixture
semantics with Developer B, record the freeze, and implement the M1 execution APIs.
Developer B should connect the agreed APIs to the intake and investigation screens.
Expert procedure review remains required before guidance can be described as approved.

**Issue/PR/commit:** No reference recorded for this session. The implementation is
present in the working tree; this entry is not evidence of a merge or deployment.

#### 2026-09-16 — Developer B: negative timeline correction and review preparation

**Status change:** Unchanged — M0 remains In progress; joint review is pending.

**Delivered:** Corrected the negative snapshot, which previously skipped
`inspection_completed` and returned directly to `diagnosing`. Completion now uses
the `EV-CLEAR` observation timestamp (10:25 +08:00); reassessment follows at
10:26 +08:00. Added backend regression coverage for ordered states, chronological
timestamps, observation alignment, and exclusion of positive-branch evidence.
Extended the browser test to verify both final timeline entries in display order.
The case remains open with no confirmed cause and the material-review recommendation.

**Decisions:** Schema and fixture versions remain `1.0`: this corrects storyboard
content without changing the interface. This is precomputed M0 behavior, not a live
case engine. No joint acceptance or expert procedure approval is asserted.

**Verification:** `npm run check` passed lint, type checks, 9 reference-parser tests,
40 backend tests, contract drift checks, and the production build. The first run
caught one overlong test assertion; it was corrected before the successful rerun.
`npm run test:e2e` passed all 21 browser tests, including the updated negative
timeline test. `git diff --check` passed. Checks used workspace uv/pytest caches
and `.cache/m0-fix-temp` for pytest temporary files; browser tests ran outside the
sandbox because Chromium launch is blocked inside it. Existing backend deprecation
warnings remain nonblocking.

**Remaining/blockers:** Developer A and Developer B must review the corrected
contract/fixture boundary and record acceptance below before the freeze is complete.

**Next handoff:** Both developers review the candidate below. After acceptance,
fill in the reviewed revision and date, check the freeze deliverable, and mark M0
Complete in the overview. M1 remains Not started until that handoff is complete.

**Issue/PR/commit:** This correction is uncommitted. Original M0 implementation:
`c648311` (contracts/fixture), `91f55fe` (prototype), `7d6f810` (lint), and
`d5454ce` (documentation). GitHub Issues were unavailable during the preceding audit
because CLI authentication failed.

### Pending joint contract review and freeze

These checkboxes record joint review, not automated test results. Leave them
unchecked until both developers have accepted the corresponding boundary.

- [ ] Review canonical evidence, findings, scores, outcomes, case states, and
  procedure schemas against generated OpenAPI/TypeScript declarations.
- [ ] Confirm fixture `v2.0` parity across API, frontend bundle, and tests.
- [ ] Confirm each snapshot selects only its applicable evidence; positive and
  negative observations never appear together in a displayed case.
- [ ] Review both inspection paths, including negative completion before
  reassessment and positive confirmation, action, verification, and resolution.
- [ ] Review nozzle-only scope, structured recovery checks, two-failure escalation,
  and unchanged read-only legacy cases.
- [ ] Accept the illustrative procedure boundary, pending expert review, and
  semantic model-node/camera mappings with the 2D/text fallback.
- [ ] Agree ownership: Developer A owns authoritative contracts and execution;
  Developer B owns presentation; both own fixture changes and integration.
- [ ] Accept the change policy: contract changes require joint review and
  synchronized authoritative-schema, generated-contract, fixture, and test updates
  in the same commit.

| Acceptance field | Record |
| --- | --- |
| Developer A reviewer and acceptance | Pending |
| Developer B reviewer and acceptance | Pending |
| Reviewed revision (commit SHA including this correction) | Pending |
| Acceptance date (`YYYY-MM-DD`, `+08:00` if timestamped) | Pending |
| Schema / fixture versions | `2.0` / `2.0` |
| Decision and unresolved concerns | Pending joint review; freeze not yet effective |

#### 2026-09-16 — Review package prepared; freeze intentionally pending

Prepared [the joint review package](M0_CONTRACT_REVIEW.md) and a reproducible
[candidate manifest](contract-review-candidate.json), including the current M2
contract extensions. Candidate SHA-256:
`cdd057e54410aaea7fb0737332e038090f6735c85ff34477a50b377e0204890b`.
`node scripts/contract-review.mjs --check` detects changes to the covered contract,
fixture, and workflow files. This identifies review material, not acceptance.
When asked about joint acceptance, Developer B explicitly instructed **“keep pending.”**
Both acceptance records, final reviewed commit, and acceptance date remain Pending.
M0 stays In progress; no sign-off is inferred from the implementation or tests.

## M1 — Thin vertical slice

**Goal:** A complete clickable journey integrated with the case API, even if rough.

- [x] **Developer A:** Implement synthetic image generation/measurement, evidence
  normalization, question branching, scoring rules, case APIs, and cached findings.
  Integrate the existing controlled event-log adapter and persistence foundations.
- [x] **Developer B:** Build image intake/overlays, log import preview, adaptive
  discovery, evidence/ranking presentation, and the procedure shell against APIs.
- [x] **Shared checkpoint:** Run report → diagnose → inspect → fix → verify with
  the versioned fixture from a clean database and fresh browser session.
- [x] **Audit corrections:** Preserve compound evidence units and derive missing
  recovery evidence from verified observations, including when loading saved cases.

**Next handoff:** Both developers review the expanded contracts and pending M0
freeze record. Developer A can replace cached findings with live specialists and
critic; Developer B can integrate 3D using the existing node/step contract. Keep the
server-owned confirmation and verification gates when adding M2 behavior.

### Development history

#### 2026-09-16 — Developer B / shared scope: complete M1 vertical slice

**Status change:** M1 Not started → Complete. At Developer B's explicit request,
this session implemented both developers' M1 scope and proceeded despite the pending
joint M0 freeze. M0 remains In progress; no acceptance was recorded on anyone's behalf.

**Delivered:** Generated normal/undersized/oversized/missing-dot PNG samples and
independent pixel-component measurement. Added typed case creation/read/action APIs,
log attachment with raw provenance, five adaptive answers, versioned scoring rules,
cached finding templates grounded in case evidence, and atomic revision-checked
SQLite case storage. Added migration `0002` without replacing the snapshot table.

The main workspace now supports report entry, sample selection/overlays, uploaded
or sample log preview, question branching, evidence/ranking, the semantic 2D guide,
explicit confirmation of either inspection result, simulated corrective action,
measured verification (including failure/retry), and explicitly resolved summaries.
Case URLs restore saved state after refresh. `/prototype` remains the M0 offline
storyboard; `/log-preview` preserves the foundation log viewer.

**Decisions:** Generated sample selection, not image upload. Only undersizing has
diagnostic rules; other images demonstrate measurement without invented rankings.
Initial golden scores match the M0 fixture. Negative inspection records completion,
lowers restriction, and hands off to material review while keeping the case open.
Cached templates are labelled and use current evidence IDs; no model calls or 3D
are claimed. General evidence editing and further repair workflows remain M2 work.

**Verification:** `npm run check` passed lint/format checks, TypeScript, 9 reference
parser tests, 57 backend tests, generated-contract drift checks, and production build.
`npm run test:e2e` passed all 26 browser tests. Each suite migrates an isolated
database and each browser test uses a fresh context. New coverage includes both
confirmed outcomes, failed verification/retry, URL restore, log upload, intermittent
ranking, failed requests, stale revision recovery, and a 375px keyboard/layout check.
Reviewed the mobile procedure screenshot. Initial failures exposed an obsolete
foundation assertion and ambiguous browser selectors; both were corrected. Checks
used workspace uv/pytest caches and temporary directories, with browser launch
outside the sandbox. Existing backend deprecation warnings are nonblocking.

**Remaining/blockers:** Joint M0 acceptance remains pending. Live specialists/critic,
3D/animation, general evidence editing, expert procedure review, and final clean-state
rehearsals/submission are later milestones. M1 passing is not final MVP acceptance.

**Issue/PR/commit:** Uncommitted local implementation. Existing M0 corrections remain
in the working tree. No GitHub issue update or push was performed.

#### 2026-09-16 — Developer B / shared scope: M1 audit corrections

**Status change:** The critical audit reopened M1's completion assessment after
finding lost compound units in the evidence ledger and known intermittent recovery
still labelled missing. Both findings are now corrected and regression-tested;
M1's current assessment is Complete. Earlier session entries remain historical.

**Delivered:** `Evidence.unit` now accepts scalar strings, per-field maps, and null.
Attachment retains parser units, and the log preview, M1 ledger, and M0 evidence
views share a unit-aware formatter. Added the versioned `evidence-units.json` fixture
and regenerated shared contracts. Missing recovery evidence is derived from current
verified observations and synchronized with cached specialist findings. Empty lists
display "None listed" rather than implying inspection evidence is complete.

**Compatibility:** Existing cases are normalized on read and before mutation.
Missing compound units are restored only from a unique retained log candidate with
the same key, source reference, and value. Existing units and ambiguous matches are
preserved. GET remains read-only: scores, confirmations, workflow state, history,
and revision do not change. The next successful action persists the normalized case
with its normal revision increment. No database migration or bulk rewrite is needed.

**Verification:** `npm run check` passed lint, formatting, TypeScript, 9 parser
tests, 73 backend tests, contract drift checks, and production build. The 16 new
backend cases cover units, null values, storage round-trips, legacy recovery,
ambiguous matches, unchanged GET storage/history, and known/unknown/rejected recovery.
`npm run test:e2e` passed all 27 tests, including units and corrected findings after
reload. An initial run exposed a test race between two successive confirmation
checkboxes; specific accessible labels fixed it, and the full journey now has a
60-second test budget. ESLint passed again for that final test edit.
`git diff --check` passed. Workspace caches and isolated pytest/browser databases
were used; Chromium required execution outside the sandbox. Existing backend
deprecation warnings remain nonblocking.

**Next handoff:** The two audited M1 defects are closed. M2 has not started; joint
M0 acceptance remains pending and no reviewer sign-off is implied by these fixes.

**Issue/PR/commit:** Uncommitted local changes; no issue update, commit, or push.

#### 2026-09-17 — Post-expert-review M1 gaps closed

**Status change:** M1 briefly reopened for the v2 audit; now Complete.

**Corrected:** A confirmed negative nozzle inspection no longer appears as missing
evidence. Upstream inspection remains unknown. Both outcomes are covered through
cached findings, reload, and the live reasoning payload. Recovery reload restores
submitted checks and the last image selection; prior checks remain separately
readable, and each retry requires fresh confirmation. Two-failure escalation still
survives reload and blocks retry.

**Verification:** `npm run check` passed lint, types, nine parser tests, 129 API
tests, generated-contract checks, and production build. All 38 offline browser
scenarios passed together. The first check found mixed Python line endings; these
were normalized before the passing run. Pytest used isolated workspace temporary
and cache directories; Chromium required execution outside the sandbox. Existing
dependency deprecations and the lazy Three.js chunk warning remain nonblocking.

**Next handoff:** M0 v2 joint acceptance remains pending. See the M2 entry below
for fresh live and recording acceptance. No commit or push performed.

## M2 — Core differentiators

**Goal:** Integrate real reasoning and guided inspection with both outcome branches.

- [x] **Developer A:** Implement specialists, critic validation, negative-branch
  recomputation, and persisted case transitions. FR-011 audit correction verified below.
- [x] **Developer B:** Integrate the simplified 3D assembly, semantic highlights,
  procedure animation, state transitions, verification, and text/2D fallback.
  Evidence presentation/navigation audit corrections verified below.
- [x] **Shared checkpoint:** Verify that both outcomes update the real case and its
  next recommendation correctly; capture a backup screen recording.

**Next handoff:** Proceed to M3 reliability/rehearsals and revised expert procedure
review. M0's v2 joint contract freeze remains pending by explicit user direction.

### Development history

#### 2026-09-16 — Developer B: M2 implementation and acceptance

**Status change:** Not started → Complete. This session implemented the authorized
backend and experience work together, with tests and local backup footage.

**Backend delivered:** Added Google GenAI orchestration: concurrent Fluid Path and
Material/Process specialists, then a critic. Strict structured output, assigned
hypothesis coverage, citation/source validation, and whole-run fallback protect
deterministic scoring and confirmation gates. Model calls run outside database
transactions; a revision-checked commit prevents stale results from overwriting
newer cases. Persisted mode/model/prompt/evidence revision/timestamp/fallback/critic
metadata is compatible with older case documents. GET never calls the model.

**Evidence delivered:** Technician reports/answers can be edited and evidence can
be rejected with a reason and explicit confirmation. Prior values/states remain in
the timeline. Upstream answer changes retire dependent answers and resume the
appropriate discovery branch; completed discovery can be diagnosed again. Other
eligible changes recompute scores, missing evidence, findings, and recommendation.
Rejecting image evidence retires its derived contribution. Corrections clear any
pending observation, and both confirmed inspection outcomes lock further corrections.

**Experience delivered:** Evidence source/status filters, correction forms, retained
raw-log access, live/cached labels and run metadata, and pre-confirmation evidence
review. Added a lazy-loaded Three.js assembly with seven semantic meshes, shared
camera presets, highlighted active parts, play/pause, previous/next, reset, and
keyboard/pointer camera controls. Reduced motion disables autoplay/pulsing and snaps
camera changes. Missing mappings, renderer failure, context loss, and explicit 2D
selection preserve diagram/text guidance. Playback stops at the final step and never
records an observation. GPU resources and interaction listeners are disposed.

**Integration findings resolved:** The live API rejected the SDK's `response_schema`
conversion of `additionalProperties`; switched to `response_json_schema` while
keeping strict local Pydantic validation. Clarified critic rejection semantics:
a correctly described, weakened hypothesis is not an unsupported finding. Added
regression coverage for the transport schema and persisted live findings on GET.
The planned Gemini 3.8 Flash and tested 3.7 Flash returned overload responses;
2.5 Flash generation returned 404 despite appearing in model discovery. Selected
the verified `gemini-3.5-flash-lite` default, configurable through `.env`.

**Verification recorded:**

- `npm run check` passed lint, types, 9 reference-parser tests, the then-current
  95 backend tests, contract drift, and production build. After final coverage was
  added, all **97 backend tests** passed; lint/type/build and contract generation
  were checked again. `git diff --check` passed.
- The full **33-test browser suite** passed, including both outcome journeys,
  correction invalidation/filtering, 3D controls/highlights/playback, reduced motion,
  mobile layout, WebGL creation/context failure, unknown mapping, and reload.
  The added pre-confirmation correction test and updated raw-log/positive journey
  passed targeted reruns, bringing the suite to **34 distinct browser tests**.
- The opt-in synthetic live check passed initial diagnosis, positive inspection,
  and negative inspection with critic-accepted findings, plus forced cached mode.
  The safe result artifact is `artifacts/demo/live-reasoning-check.json` (ignored).
  Model runs did not alter deterministic scores or observations.
- Both real API journeys passed again under the recording configuration. Local
  backup videos are `artifacts/demo/positive.webm` and `negative.webm`; originals
  are under `artifacts/demo/recordings/`. These use visibly labelled cached mode,
  not live model responses. Decoded frames were inspected, including resolved
  summary and negative inspection history. They are short backup footage, not
  the final narrated submission. Desktop and mobile 3D screenshots were inspected.
- Windows checks used workspace uv/pytest caches and isolated test databases.
  Chromium and live network verification required execution outside the sandbox.
  Existing TestClient deprecations and the lazy Three.js bundle-size warning are
  nonblocking; Three.js is loaded only when the inspection viewer opens.

**Remaining boundaries:** Domain-expert procedure approval, M0 joint freeze, M3
rehearsals/reset work, and final submission remain pending. The guide highlights
parts and moves its camera; it does not demonstrate or authorize cartridge removal.
Provider availability can change, so the cached fallback remains part of acceptance.

**Issue/PR/commit:** Working-tree implementation; no new commit or issue publication
was requested in this session. See [development instructions](DEVELOPMENT.md#m2-reasoning-evidence-corrections-and-3d)
for configuration and repeatable acceptance/recording commands.

#### 2026-09-16 — Critical checkpoint audit of M0–M2

**Status change:** M0 remains In progress; M1 remains Complete; M2 Complete →
In progress. The preceding implementation entry is historical, not the current
acceptance decision. No application fixes were made during this audit.

**Checkpoint assessment:**

- **M0:** Canonical schemas, shared versioned fixture, prototype screens, semantic
  nodes, negative timeline, and fallback have passing checks. The technical shared
  checkpoint is met. The PRD's end-of-M0 schema freeze is not met: both reviewer
  acceptances, reviewed revision, and acceptance date remain Pending. Automated
  checks cannot stand in for joint acceptance.
- **M1:** Backend measurements/log adapter/questions/scoring/API/persistence and
  frontend intake/overlays/discovery/diagnosis/procedure/verification are present.
  The complete report-to-verification journey passes with an isolated migrated
  database and fresh browser context, including failure/retry and reload. No new
  M1-specific blocker was reproduced. Synthetic sample selection is the previously
  recorded boundary; this is not arbitrary production-image recognition.
- **M2:** Specialists, critic calls, negative recomputation, revision-safe persistence,
  3D controls/playback/fallback, and both confirmed branches are implemented. The
  literal shared checkpoint (both outcomes update cases, backup recording exists)
  is met. Full acceptance is reopened because the following defects undermine the
  critic and evidence-review deliverables.

**Reproduced findings, in priority order:**

1. **High — critic can omit known uncertainty (FR-011).** The saved live positive
   result has an accepted critic with no missing evidence, no counterargument,
   and a generic “fully grounded” endorsement while material temperature/open-time
   gaps still exist. A controlled provider response reproduced acceptance in live
   mode with an empty critic gap list and no concern in its summary despite known
   ranking gaps. `diagnosis/reasoning.py` validates roles, IDs, sources, and structure
   but does not enforce this critic obligation. Add a grounded uncertainty check
   and a regression that rejects/falls back when a critic merely endorses findings.
2. **Medium — image rejection displays a nonexistent inspection/handoff.** After
   diagnosis, reject the `undersized` image evidence. The API correctly returns
   `diagnosis_supported=false`, no inspection evidence, and `recommendation=null`.
   `CaseApp.tsx` nevertheless displays “Inspection recorded” and “Material review
   is the next handoff.” The browser audit reproduced both messages. Render a
   specific unsupported/rejected-image state with an appropriate next action;
   reserve inspection/material-review messages for actual confirmed outcomes.
3. **Medium — filters break evidence citation navigation.** Choose the verified
   evidence filter and click a ranking citation for provisional image evidence.
   The citation remains visible, but its target row has been removed; the browser
   audit confirmed zero matching targets after the click. Citation navigation
   must reveal the referenced evidence (for example, clear conflicting filters)
   and then focus/scroll to it. Cover ranking and specialist citation links.

**Fresh verification:** `npm run check` passed (97 backend tests, 9 reference-parser
tests, lint, formatting, types, generated-contract drift, and production build).
`npm run test:e2e -- --workers=4` passed all 34 browser tests in one run. Additional
isolated audit probes reproduced the two UI defects; a controlled in-memory
reasoning call reproduced the critic gap. Passing regression suites therefore do
not cover these acceptance failures yet. `git diff --check` passed.

**Evidence limits:** Reviewed the existing live artifact and confirmed both backup
videos exist. No new Gemini request was made during this audit. The live acceptance
script exercises in-memory workflow/reasoning; provider-mocked API tests cover
persistence, and browser/recording suites force cached mode. This is layered evidence,
not a recorded fresh-browser → live-provider → persisted-case rehearsal. Such a live
integration rehearsal would strengthen acceptance after the fixes. The short backup
videos are not the M3 narrated submission, and expert review remains an M3 checkpoint.

**Next handoff:** Address these three findings with regressions, rerun affected
checks, and append the results. Separately obtain genuine joint M0 acceptance;
do not infer it from implementation progress. No commit, push, or issue publication
was performed for this audit.

#### 2026-09-16 — Audit fixes and live integration acceptance

**Status change:** M2 In progress → Complete. M1 remains Complete. M0 remains
In progress at the user's explicit request to keep the joint freeze pending.

**Corrected:** Prompt `m2.3` includes deterministic known gaps and requires the
critic to report at least one when gaps exist. Application validation rejects an
empty or invented-only critic gap list, retaining the entire cached finding set.
This applies before inspection and after either confirmed outcome. Nine backend
regression cases cover all three stages, including normalized matching.

Rejected image evidence now displays its own recovery message and a new-case link;
it does not claim inspection or material handoff. Material-review messaging requires
the verified negative observation and actual material recommendation. Ranking and
specialist supporting/conflicting citations clear both filters, reveal the target,
and focus/scroll to it after rendering. Browser regressions cover keyboard navigation,
both filter types, image rejection, and reload persistence.

**Acceptance gap closed:** Added the explicit opt-in `playwright.live.config.ts`
suite, with a fresh migrated database, fresh browser contexts, real backend Gemini
calls, case creation/discovery through the UI, and equality checks on saved API
documents after reload. Both tests passed: the positive branch continued through
corrective action, measured verification, and resolved summary; the negative branch
stayed diagnosing with the material recommendation. Initial and post-inspection
reasoning was live, critic-reviewed, and contained known gaps in both tests.
The suite fails on cached fallback, so this is evidence of live integration rather
than a silent substitution. Local screenshots/results are under
`artifacts/demo/live-browser/`; the regular suites remain offline by default.

**Verification:** `npm run check` passed lint, formatting, types, 106 backend tests,
9 parser tests, contract drift checks, and production build. All 36 regular browser
tests passed together. The two real live-browser tests passed in 48.3 seconds.
`node scripts/contract-review.mjs --check` and `git diff --check` passed. Existing
TestClient deprecations and the lazy Three.js bundle-size warning remain nonblocking.

**M0 handoff prepared:** Added a review guide and reproducible SHA-256 manifest of
the current contracts, fixtures, and workflow boundary. Both acceptance records
remain Pending; no reviewer name, date, or final reviewed commit was invented.
The user explicitly chose to keep the freeze pending after receiving the package.

**Remaining:** M0 joint acceptance and M3 expert review/rehearsals/submission remain.
No commit, push, or issue publication was requested or performed in this session.

#### 2026-09-17 — Version 2 live acceptance and backup evidence refreshed

**Status change:** M2 reopened for stale v1 acceptance coverage, then returned to
Complete after fresh v2 validation. M0 remains In progress; M1 is Complete.

**Corrected:** Live browser tests now traverse all five procedure steps, expect the
air-cap/pressure-supply handoff after a clear nozzle, and submit explicitly confirmed
recovery checks before resolution. The current M0 checklist now describes v2 flux
contracts, recovery/escalation, and read-only legacy cases; earlier session entries
remain history. No acceptance or expert approval was inferred.

**Fresh evidence:** Both tests in `playwright.live.config.ts` passed (59.6 seconds).
Initial and post-inspection reasoning used the real provider with critic validation;
API payloads matched after browser reload. The positive case resolved with structured
recovery checks, while the negative case stayed open with `air_supply` guidance.
Safe persisted-case attachments and screenshots are under
`artifacts/demo/live-browser/`. Both recording journeys passed (41.1 seconds),
including failed verification, reload, retry, and resolution. Fresh labelled cached
backups are `artifacts/demo/positive-v2.webm` and `negative-v2.webm`, with originals
under `artifacts/demo/recordings/`. Decoded frames were inspected for procedure,
verification, resolved summary, and retained negative observation. These ignored
local artifacts are backup footage, not the final narrated M3 submission.

**Review candidate:** Regenerated manifest SHA-256
`2450f1c9576ba243f59568cdcfe7fb3623e2f92f37fbbc447201619dcfac6a1f`.
The hash identifies this working-tree candidate; both reviewers, acceptance date,
and final reviewed commit remain Pending. Contract consistency and diff checks pass.

**Remaining:** Genuine M0 joint acceptance and M3 revised procedure approval,
clean-state rehearsals, and submission. No commit, push, or issue publication.

## M3 — Validation and submission

**Goal:** Deliver a reliable, reviewed prototype and a checked submission video.

- [ ] **Developer A:** Complete workflow tests, fallback validation, reset endpoint,
  and failure handling.
- [ ] **Developer B:** Polish accessibility, demo reset, recording layout, and the
  in-app summary; prepare the final video.
- [ ] **Shared checkpoint:** Run two consecutive rehearsals from clean demo state
  without database edits, manual prompt changes, or developer-only controls.
- [ ] **Shared checkpoint:** Record domain-expert procedure review and any changes.
- [ ] **Shared checkpoint:** Upload the 6–10 minute video and check access signed out.

**Next handoff:** Use M2 findings to prioritize reliability fixes. Keep P1 frozen
until the P0 journey succeeds twice. Record rehearsal results and submission links.

### Development history

No M3 implementation session recorded yet. Earlier milestone tests do not replace
the final clean-state rehearsals or expert review.

## Session entry template

Copy this under the relevant milestone's **Development history** heading:

```markdown
#### YYYY-MM-DD — Developer A / Developer B / Shared: session title

**Status change:** Previous → current, or unchanged.
**Delivered:** Completed behavior and affected components; link relevant artifacts.
**Decisions:** Contract/fixture versions, tradeoffs, and scope changes.
**Verification:** Commands/scenarios actually run, results, and workarounds; say if not run.
**Remaining/blockers:** Unfinished work, dependency owner, and action needed.
**Next handoff:** Who does what next and what they need from this session.
**Issue/PR/commit:** Links or identifiers, or “not recorded”.
```
