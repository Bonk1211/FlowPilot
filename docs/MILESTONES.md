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
| M0 — Contract and demo lock | In progress | Initial contracts exist; review/freeze handoff pending | Golden-screen prototype, node mapping, and 2D fallback complete | Shared fixture loads in API and UI; joint contract freeze pending |
| M1 — Thin vertical slice | Not started | Parser and persistence foundations exist; integrated case flow remains | M0 screens provide a starting point; live intake integration remains | Complete report → diagnose → inspect → fix → verify flow |
| M2 — Core differentiators | Not started | Live specialists, critic, recomputation, and persistence integration remain | 3D assembly, animation, and live transitions remain | Both outcomes change the real case; backup recording captured |
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

## M1 — Thin vertical slice

**Goal:** A complete clickable journey integrated with the case API, even if rough.

- [ ] **Developer A:** Implement synthetic image generation/measurement, evidence
  normalization, question branching, scoring rules, case APIs, and cached findings.
  Integrate the existing controlled event-log adapter and persistence foundations.
- [ ] **Developer B:** Build image intake/overlays, log import preview, adaptive
  discovery, evidence/ranking presentation, and the procedure shell against APIs.
- [ ] **Shared checkpoint:** Run report → diagnose → inspect → fix → verify with
  the versioned fixture from a clean database and fresh browser session.

**Next handoff:** Finish the M0 contract review, then record which API operations
Developer A supplies and which screens Developer B connects in the next session.

### Development history

No M1 implementation session recorded yet. Existing foundation code and the M0
storyboard are starting points, not evidence that the integrated M1 flow is complete.

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
