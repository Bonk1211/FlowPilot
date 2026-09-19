# Learning Database — implementation, research and validation

Date: 2026-09-19. Baseline: `258536d` on `feat/photo-anomaly-workflow`; implementation: `feat/database-learning`.

## Agreed product behavior

The user selected a graph-first knowledge workspace and automatic preparation followed by technician confirmation. One investigation is one case record; observations, actions and outcomes update it. Saving a case does not publish trustworthy experience automatically.

`Recorded → Prepared → Reviewed → Reused in diagnosis`

The `/knowledge` workspace has a searchable/filterable case browser, interactive relationship graph, and source/review inspector. It shows real saved-case, reusable-experience and pending-review totals. Every saved case appears, even before it is eligible to generate experience. Equivalent simulated experiences are grouped with access to their source records; counts are not probabilities or independent industrial samples.

## Research and implementation decisions

Sources checked 2026-09-19:

- [RAG, Lewis et al.](https://arxiv.org/abs/2005.11401): retrieval supplies external memory to generation. This implementation uses bounded structured case retrieval, not a trained dense retriever or parameter updates to Gemini.
- [Obsidian Graph view](https://help.obsidian.md/plugins/graph): global/local connection exploration inspired the central graph and focused neighborhood controls. No Obsidian installation or Markdown editing is required.
- [SQLite FTS5](https://www.sqlite.org/fts5.html): lexical similarity alone does not establish compatible process conditions. Current small, structured data supports an explicit matching baseline; no additional search index or vector service yet.
- [SQLAlchemy transactions](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) and [version checks](https://docs.sqlalchemy.org/en/20/orm/versioning.html), via Context7: compare-and-swap writes, check affected row count, and roll back related writes together.
- [Cytoscape.js](https://github.com/cytoscape/cytoscape.js), via Context7: typed graph elements, built-in `cose` layout, tap selection, pan/zoom, and lifecycle cleanup. Canvas is accompanied by keyboard-operable node/relationship lists.
- [Google Gen AI Python SDK](https://github.com/googleapis/python-genai), via Context7: Pydantic JSON output plus application validation. Schema conformance cannot establish factual truth; a technician reviews the evidence before publication.
- [React effects](https://react.dev/learn/synchronizing-with-effects), via Context7: ignore stale network reads; use record/revision identity for editing forms.

UI follows the repository UI/UX Pro Max skill and existing FlowPilot tokens. Its focused graph guidance requires labelled types, keyboard alternatives and a readable relationship list. Generic marketing/landing-page suggestions were not adopted.

## Data and trust

Migration `0003` adds `knowledge_entries` and a singleton `knowledge_library_revision`. Existing case JSON is not rewritten. Each source has at most one knowledge aggregate containing immutable content versions and lifecycle events. Status is `draft`, `published`, `disputed` or `archived`; older content versions remain available as superseded history.

A source snapshot contains case ID/revision, a signature of relevant source facts, process/simulation provenance, conditions, original possible causes, confirmed nozzle inspection, actual action/outcome, evidence with references, image links, log digest and a simulated-experience fingerprint. A knowledge version contains title, lesson, inspection/outcome interpretation, bounded check focus and cited evidence IDs. Template titles describe the topic without encoding a recovery claim, so retracting an outcome cannot leave a misleading success label.

- Publication requires an explicit confirmation, reviewer name, reason, current source facts and supported structured assertions.
- Reviewers may retract an interpretation to uncertain/unresolved, edit the reusable lesson, change check focus, and change source citations. A stronger or different positive claim needs supporting recorded evidence. The locked source inspection is not silently rewritten; a genuinely new physical finding belongs in a new linked investigation.
- A dispute or revision immediately removes the old version from active retrieval. Revised content requires publication again. Archived entries are not automatically resurrected.
- Factual source changes invalidate published experience in the same transaction as the case write, then prepare a fresh draft for eligible workflow events. Pure diagnostic refresh does not invalidate unchanged source facts.
- Compare-and-swap revisions prevent lost edits. A published-library epoch prevents committing a diagnosis when retrievable knowledge changed during model generation; draft-only edits do not invalidate unrelated diagnoses. No SQLite write lock spans model/network requests.
- Reviewer names are self-reported; this is the existing single-user demo, not authenticated enterprise RBAC.

## Gemini and automatic preparation

Confirmed inspection, completed action, verification and resolution atomically save an evidence-template draft. When configured/enabled, a FastAPI background task asks the existing Gemini model for a structured draft. Valid output appends a version; it never publishes. Generation metadata records pending/live/cached/manual and the fallback reason.

Model input is bounded source evidence, explicitly treated as untrusted data. The model must retain the recorded finding/outcome and use only source evidence IDs. Unsupported output, timeout, missing credentials or provider failure retains the evidence template. Late output cannot replace a newer source, technician edit or publication. A durable pending draft survives process interruption; the inspector provides a retry or manual-edit path. There is no separate job queue or automatic distributed worker recovery.

Specialists and critic receive retrieved historical experience in a separate field. `knowledge_refs` uses `KB-…@vN`, distinct from current-case evidence/source references. Invalid references trigger the existing whole-run fallback. Deterministic diagnosis also exposes historical support/check focus when Gemini is unavailable. Fixed score rules, current inspection confirmation and recovery gates remain independent.

The assistant's explanation endpoint remains deterministic and read-only; it links the historical references saved with the diagnosis. It does not claim to perform a separate live Gemini chat.

## Retrieval and graph

Only current published experience is eligible. Require another case, identical process/simulation scope, source facts predating the target report, a shared positive symptom and at least one known diagnostic condition beyond symptom frequency. Known contradictory conditions exclude a candidate. Unknowns never contribute to similarity; material batch, recipe and physical equipment instance remain unknown. Retrieval does not use report wording, filenames, current inspection outcome or future results.

Order by matched conditions, publication time and stable ID. Coalesce equivalent simulated sources and return at most three. Store full match content/reasons/version in the case and diagnostic snapshots. Historical support changes the explanation and check focus, without changing fixed diagnostic points. Saved snapshots stay immutable; reference-status reads indicate superseded, disputed, archived or source-changed citations. `refresh_knowledge` appends a new diagnostic snapshot without bypassing workflow states.

The graph is a projection, not an independent editable source of truth. Case → Symptom, Component, Possible cause, Finding, Action and Outcome links retain relation, source citation, evidence IDs and review status. Hypothesis edges are dashed. The default projection contains up to 40 filtered record groups, expandable to 100; narrow filters beyond that. The counts represent the full database. This bounded graph and in-memory structured scan target demo-sized data, not a production-scale corpus.

## API additions

| API | Behavior |
| --- | --- |
| `GET /api/knowledge/graph` | Counts, searchable/filterable record groups, graph; `q`, `status`, `process`, `symptom`, `limit` |
| `GET /api/knowledge` | Knowledge entries and optional text/status filtering |
| `GET /api/knowledge/by-source/{case_id}` | Entry for a case, or null |
| `POST /api/knowledge/from-case/{case_id}` | Prepare/reopen a source-revision-checked draft for older saved cases |
| `GET /api/knowledge/{id}` | Content versions, source evidence, generation metadata and lifecycle history |
| `POST /api/knowledge/{id}/actions` | Revision-checked revise/publish/dispute/archive with reviewer, reason and confirmation |
| `POST /api/knowledge/{id}/prepare` | Retry interrupted pending model preparation |
| `GET /api/knowledge/{id}/graph?version=N` | Inspect relationships for an exact historical version |
| `GET /api/investigations/{id}/knowledge-status` | Compare current and historical diagnostic citations with current knowledge |
| Case action `refresh_knowledge` | Explicitly rerun retrieval/reasoning and retain older snapshots |

## Walkthrough

1. Start a photo investigation, confirm an inspection, record action/verification and resolve it, or leave a nozzle-negative case as an unresolved handoff.
2. Follow **Review case experience** or **Learning Database**. Select the case, inspect **Evidence**, edit if necessary, enter reviewer/reason, tick confirmation and **Confirm & publish**.
3. Start a new case with compatible conditions. **Past experience** shows the source version, why it matched, applicability gaps and suggested check focus.
4. In the database, mark the old interpretation disputed, then **Edit as new version**. Saving withdraws the old advice; publish the corrected draft after review.
5. A subsequent case uses the corrected version. Reopen the earlier diagnosis: its original citation remains, with a change notice and explicit refresh action.

## Validation record

Tests use isolated temporary SQLite databases; browser services use `.cache/e2e-*`, never daily `flowpilot.db`. Backend coverage includes the A/B/C loop, excluded states, self/future/incompatible/simulation-domain exclusion, insufficient information, deduplication, failed recovery, source invalidation, unchanged-source refresh, optimistic conflicts, rollback, late model output, citation validation, graph provenance and model fallback. Browser coverage exercises publication/correction through the actual form, graph keyboard access, filtering, and a 375px viewport, alongside existing photo/log/3D/recovery journeys.

Automated model tests inject responses and do not spend API quota or establish production diagnostic accuracy.

Verified on 2026-09-19:

| Check | Result |
| --- | --- |
| `UV_CACHE_DIR=.cache/uv npm run check` | Passed: lint, typecheck, 9 reference-parser tests, 205 API tests, generated-contract consistency, production build |
| Final frontend lint/build after visual refinement | Passed; the build includes TypeScript checking |
| `UV_CACHE_DIR=.cache/uv PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=2` | 54 passed, including the complete A/B/C publication/correction loop, existing photo + log + 3D + recovery journeys, keyboard graph selection and 375px reflow |
| Visual review | Database desktop/mobile and 1280×720 diagnosis screenshots inspected; next action, assessment and cited experience visible together |
| Local migration `0002 → 0003` | Existing 9 case rows and snapshot rows retained byte-for-byte (row count + SHA-256 comparison); zero knowledge records inserted |
| Running local app | API health, database overview and `/knowledge` respond successfully; counts 9 saved / 0 reusable / 0 pending before any real review |

The first complete browser run caught a 4px page overflow caused by the new navigation link increasing the header height. The header spacing was corrected while retaining a 44px control target; the final suite passes the existing viewport assertions. Repeated selection of the same record and cleared current-reference warnings after explicit refresh also have browser coverage. A later run exposed a race in the existing keyboard upload test: it focused the file-picker button while the initial loading fieldset was still disabled. The test now waits for the button to be enabled and verifies focus before Enter; the keyboard/file-chooser assertion is retained.

The initial bundle is approximately 484 kB minified; the approximately 466 kB graph workspace is loaded only when visiting `/knowledge`. The existing Three.js assembly chunk remains approximately 641 kB and produces the build's size advisory. Two upstream test-client deprecation warnings remain. Concurrent draft-only edits now leave the retrieval epoch unchanged; a regression verifies they do not reject an unrelated diagnosis, while publication/dispute during reasoning still rejects stale references.

No Gemini key is configured in this execution environment, so an actual provider round trip was not exercised. Controlled-response tests verified accepted historical citations, rejection of fabricated versions or historical evidence posing as current evidence, valid draft preparation, unsupported-fact rejection, provider failure, and late-result protection. The runnable local fallback remains explicit.

Code is on `feat/database-learning`, uncommitted and unpushed. The pre-existing untracked `handoff.md` is preserved.
