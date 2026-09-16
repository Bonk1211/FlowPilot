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

Last updated: **2026-09-16**. Status reflects this checkout and recorded sessions;
it does not assert progress on another developer's branch.

| Milestone | Current status | Developer A — backend | Developer B — experience | Shared checkpoint |
| --- | --- | --- | --- | --- |
| M0 — Contract and demo lock | In progress | Contracts and corrected negative timeline ready for review | Golden-screen prototype, node mapping, and 2D fallback complete | Shared fixture loads in API and UI; joint contract freeze pending |
| M1 — Thin vertical slice | Complete | Raster measurements, deterministic scoring, case APIs, cached findings, and persistence implemented | API-backed intake, discovery, diagnosis, 2D inspection, verification, and summary implemented | Positive journey passes from a fresh database/browser; both outcomes and reload verified |
| M2 — Core differentiators | Not started | Live specialists/critic and general evidence recomputation remain; deterministic outcomes and persistence exist | 3D assembly and animation remain; API-driven transitions exist | Integrate live reasoning and 3D; capture backup recording |
| M3 — Validation and submission | Not started | End-to-end fallback/reset validation remains | Accessibility polish, rehearsals, and final video remain | Two clean rehearsals, recorded expert review, and checked submission |

## M0 — Contract and demo lock

**Goal:** Agree on one scenario, shared schemas and fixtures, golden screens, and
the illustrative procedure boundary.

### Deliverables and checkpoint

- [x] **Shared:** Lock the prototype scenario to undersized epoxy dots with
  cartridge/nozzle restriction, viscosity change, and trapped air as candidates.
- [x] **Shared:** Add authoritative Pydantic contracts and generated OpenAPI/TypeScript
  declarations for the golden prototype, including both inspection outcomes.
- [x] **Shared:** Use one versioned golden fixture in the backend and frontend,
  including a bundled offline copy imported from the same source file.
- [x] **Developer B:** Add navigable golden-screen wireframes at `/prototype`.
- [x] **Developer B:** Define seven semantic model nodes and camera presets.
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
- [ ] Confirm fixture `v1.0` parity across API, frontend bundle, and tests.
- [ ] Confirm each snapshot selects only its applicable evidence; positive and
  negative observations never appear together in a displayed case.
- [ ] Review both inspection paths, including negative completion before
  reassessment and positive confirmation, action, verification, and resolution.
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
| Schema / fixture versions | `1.0` / `1.0` |
| Decision and unresolved concerns | Pending joint review; freeze not yet effective |

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

## M2 — Core differentiators

**Goal:** Integrate real reasoning and guided inspection with both outcome branches.

- [ ] **Developer A:** Implement specialists, critic validation, negative-branch
  recomputation, and persisted case transitions.
- [ ] **Developer B:** Integrate the simplified 3D assembly, semantic highlights,
  procedure animation, state transitions, verification, and text/2D fallback.
- [ ] **Shared checkpoint:** Verify that both outcomes update the real case and its
  next recommendation correctly; capture a backup screen recording.

**Next handoff:** Start after the M1 journey works. Reuse the M0 semantic node IDs
and camera presets; keep contract and fixture changes synchronized.

### Development history

No M2 implementation session recorded yet.

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
