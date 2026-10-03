# S932 Person Two Adaptive Investigation Plan

**Date:** 3 October 2026  
**Status:** Offline implementation validated; Jev classification smoke-checked live; comparative provider evaluation and technician reviews remain deferred.  
**Owner:** Person Two, Investigation and knowledge.  
**Scope:** Current synthetic S932 records and the existing insufficient flux coverage defect family.

Help a new technician follow an investigation with the context an experienced technician would use: what to ask, why it matters, what the answer changes, and what to do next. Deliver a clear, reliable investigation chart that grows from recorded answers.

The required interaction is **generate one node → technician answers → extend that node into relevant possibilities → answer the next node → repeat**. This supplements [Person Two's team allocation](S932_REVAMP_TEAM_PLAN.md#4-person-2--investigation-and-knowledge). GitHub Issues remain the execution tracker.

## Implementation record — 3 October 2026

| Checkpoint | Delivered and remaining evidence |
| --- | --- |
| 1 Contract and synthetic branches | Typed incident graph/actions and regenerated frontend contracts; [saved root, answer and immediate children](../fixtures/s932-investigation-example.json); six authored [synthetic scenarios](../fixtures/s932-investigation-evaluation.json). |
| 2 Complete offline graph | Persisted answers, bounded expansions, selectable branches, corrections, retries and reload recovery; React Flow and an ordered text view share the same saved state. The vertical flowchart uses decision diamonds, evidence parallelograms, check rectangles, clarification hexagons and start/review capsules, with recorded-answer arrows. It fills the workspace by default with floating navigation and a collapsible answer panel; the panel scrolls independently and becomes a floating bottom panel on mobile. Each question has a saved purpose and its own category color/label, independent of shape and status. **Question colors** explains the seven 5W2H categories, causal Why, hypothesis testing and unclassified prompts. **5 Whys** opens separate provisional causal reasoning; missing levels stay unestablished, and inspection preserves drafts and saved state. |
| 3 Adaptive Gemini questions | Separate typed interpretation/generation tasks, explicit thinking settings and confirmed observation rules implemented. Fake-provider tests cover confirmation and invalid candidate filtering. Live model support and question quality remain unvalidated. |
| 4 Jev decision evaluation | Separate readiness/next-step gates and complete probability validation implemented. OpenRouter and direct TypeSafe transports pass mocked checks. Jev also classifies newly generated question purpose, with persisted provenance and a local fallback. Four synthetic live classification probes through OpenRouter returned the expected categories using `typesafe/jev-1.13-20260917`. This verifies the classification connection, not diagnostic quality or comparative routing benefit; those evaluations remain open. |
| 5 Integrated usability and handoff | Keyboard/text interaction, mobile layout, answer durability, duplicate retries, stale responses, corrected/expired evidence and report provenance checked. Technician reviewer sessions and effectiveness comparisons have not run. |

Verification: `npm run check` passed (323 API tests, 9 reference tests, lint, types, contracts and production build). Before the flowchart redesign, the complete Chrome Playwright suite passed 80 tests. The full-screen graph passed 19 graph, incident and navigation scenarios, including distinct purpose colors, a keyboard-accessible color key, separate causal analysis, reload stability, unchanged saved state, panel collapse, draft preservation, Escape, mobile answering, resizing, late-evidence recovery and reduced motion. Desktop, tablet and mobile graph screenshots were inspected. The [latest offline evaluation](evaluations/s932-adaptive-2026-10-03.json) matches all 6 authored baseline expectations and records comparative live paths as not run. These fixtures are not independent diagnostic labels.

[Earlier provider smoke attempts](evaluations/s932-adaptive-2026-10-03-provider-attempts.json) returned Gemini HTTP 400 and did not evaluate Jev. After the request to use Jev for question classification, four synthetic prompts correctly classified timing, impact, causal Why and quantity; their selected probabilities were 0.98, 1.0, 1.0 and 1.0. No additional Gemini calls were made for this change. Credentials stay in the ignored root `.env`; the [environment template](../.env.example) still defaults to disabled providers. [Integration settings](S932_INCIDENT_WORKSPACE.md#optional-integrations) explain enabling providers and restarting. The design and acceptance criteria below remain the reference for the deferred evaluations.

## Agreed direction and proposed defaults

| Item                      | Direction                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Investigation interface   | Use React Flow for the growing node graph and Ameliorate as the reference for connected questions, explanations and evidence.                             |
| Development evidence      | Reuse current synthetic records, replay outcomes and source passages.                                                                                     |
| Adaptive questions        | Gemini provides the reasoning and proposes follow-up questions from the actual answer and current incident evidence.                                      |
| Decision evaluation       | Jev checks answer readiness, selects eligible next steps and classifies generated question purpose; Gemini proposes interpretations and questions.                                               |
| Main product priority     | Make the reasoning, usefulness of each question and following step understandable to a new technician.                                                    |
| Proposed answer format    | Suggested choices, Unknown and optional free text. Confirm any AI interpretation of free text before treating it as an observation.                       |
| Proposed branch behaviour | Show relevant alternative branches and activate one recommended question. The technician can select another eligible branch.                              |
| Unconfirmed inputs        | Gemini model support and question quality, comparative provider results, delivery deadline, and availability of technician reviewers. The offline graph remains usable without provider access. |

Ameliorate is an application that uses React Flow. The proposed implementation adapts its interaction ideas inside FlowPilot rather than adopting its application stack. React Flow supports custom nodes containing interactive inputs. If specific Ameliorate code is reused, retain its required licence notices. [Ameliorate repository](https://github.com/amelioro/ameliorate), [React Flow custom nodes](https://reactflow.dev/learn/customization/custom-nodes).

## Existing implementation and the gap

| Existing feature                                                                                                                                                                                     | Planned change                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Diagnostic assessment](../apps/api/src/flowpilot/incidents/diagnostic.py) compares restriction, unstable delivery and material condition, with supporting/conflicting evidence.                     | Keep these stable hypothesis IDs and extend the shared assessment to consume recognised facts from adaptive answers.                                                           |
| Discovery uses five fixed fields; optional Gemini output explains an existing assessment without changing its questions or decisions.                                                                | Add genuine follow-up question generation, including clarification questions beyond the five discovery prompts. Rephrasing a fixed question alone does not satisfy adaptation. |
| [Jev adapter](../apps/api/src/flowpilot/incidents/decision.py) selects among locally eligible next steps and records fallback.                                                                       | Reuse its typed decisions and validation. Evaluate answer-interpretation checks separately from next-step selection.                                                           |
| [Investigation panel](../apps/web/src/incidents/InvestigationPanel.tsx) presents hypotheses, discovery fields and checks.                                                                            | Make the growing graph the primary investigation interaction; retain evidence, source and hypothesis detail in its supporting panel.                                           |
| [Incident service](../apps/api/src/flowpilot/incidents/service.py) and [coordinator](../apps/api/src/flowpilot/incidents/coordinator.py) save observations, assessment history and independent jobs. | Persist graph steps with incident revisions and extend the existing analysis job. Preserve answers before provider work and reject stale expansions.                           |

Keep React, FastAPI and SQLite. Add React Flow for the requested interface; reuse the installed Gemini SDK and typed models for interpretation and question generation. Avoid a separate graph database, service or agent framework. The existing Cytoscape knowledge graph serves a different feature.

## Technician interaction

1. **Open the investigation with one node.** Choose the first useful question from the evidence already collected. Keep known facts in the context panel; do not repeatedly ask for facts already supplied. If no applicable question or check remains, the single node can request review or escalation and explain why.
2. **Answer in the node.** Offer suitable choices, Unknown and optional notes. For ambiguous free text, show the proposed interpretation for confirmation or ask a clarification question. Preserve the original text even when the technician corrects the interpretation.
3. **Save before expanding.** Record the answer and incident revision, mark the node answered, then show expansion progress. Generation failure must leave the saved answer intact and offer retry or a declared baseline step.
4. **Extend from that answer.** Add up to three useful child nodes. Each child pairs a possible explanation or evidence gap with its next question/check. Generate only relevant possibilities; do not force all three hypotheses into every expansion. No deeper descendants appear until their own node is answered.
5. **Activate one next question.** Explain why it is recommended and leave alternatives selectable. Switching branches changes the active question without recording an answer to the previous suggestion.
6. **Repeat or stop.** Update the assessment from confirmed observations. Contradictions can redirect the investigation. Unknown can lead to another evidence request. When available steps cannot resolve the incident, create a review/escalation node and retain unresolved causes.

The graph distinguishes **proposed**, **active**, **answered**, **blocked** and **superseded** nodes with visible text. Future possibilities never appear as completed checks or established causes. One question/check is active at a time; a terminal review state can have none.

An illustrative expansion after the answer “Intermittent” is:

```text
Question: Is the insufficient coverage continuous or intermittent?
Answer: Intermittent
├─ Unstable delivery remains possible
│  Follow-up: Do existing pressure records vary during the affected samples?
├─ Material condition remains possible
│  Follow-up: What do the available material and idle records show?
└─ Restriction remains possible
   Follow-up: What does the available mass trend show over this interval?
```

This example is not a fixed routing rule. The system must use the rest of the incident evidence to decide which follow-ups remain useful, and must not repeat questions that the imported records already answer.

## Gemini and Jev implementation

**Gemini reasons about the incident and writes candidate questions. Jev evaluates narrowly defined decisions about those candidates and answers. The backend validates their outputs, applies evidence rules and saves the graph.** Both models run on the server inside the existing incident analysis workflow.

Use the current incident, active evidence, confirmed answers, open hypotheses and applicable source passages as context. Include the recent path and already attempted questions so the models can avoid repetition. Treat source and answer text as data. Keep concise evidence-linked explanations in the UI, without exposing hidden model reasoning.

### Gemini reasoning tasks

Reuse the installed `google-genai` SDK and existing Gemini configuration. Give interpretation and question generation separate prompts and typed responses so generating a helpful question cannot silently create an observation.

| Task                         | Input                                                                                                | Required structured output                                                                                                                                                                                                                                           | Application behaviour                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Interpret a free-text answer | Saved question/expected answer definition, original answer, notes and relevant evidence.             | Target fact, proposed value or Unknown, supporting spans from the original answer, ambiguities and any suggested clarification question.                                                                                                                             | Validate the allowed fact/value and supporting text. Show the interpretation for technician confirmation before diagnosis uses it. |
| Generate adaptive questions  | Current assessment, confirmed observations, available source passages, missing facts and prior path. | Up to three candidates: temporary ID, question/check kind, prompt, target fact, hypothesis/component IDs, why it matters, answer choices/outcome interpretations, prerequisites and evidence/source references. Include Gemini's preferred candidate for evaluation. | Validate and filter candidates, assign persistent IDs, and give eligible options to Jev. Gemini's preferred candidate is advisory. |

For a predefined answer whose meaning is already explicit in the saved question schema, normalise it directly. Unknown remains unknown. Use Gemini interpretation for free text or conflicting notes; “pressure seems odd” must not become a measured fluctuation. An interpretation response does not generate a complete future investigation tree.

Allow candidate questions to target additional observation facts within the three supported mechanisms, such as timing, pressure variation, material changes and comparability. Extend the existing assessment rules for those recognised facts. Unsupported topics stay unresolved rather than creating arbitrary new causes or a second diagnosis engine.

Use `client.models.generate_content` with a typed JSON response through the installed SDK, following the existing explanation integration. Google's structured-output documentation supports JSON Schema and Pydantic. Revalidate returned data locally; a valid schema does not establish factual grounding. [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

Select a supported thinking-capable model through `FLOWPILOT_GEMINI_MODEL`. The checkout currently defaults to `gemini-3.5-flash-lite`; that is an existing setting, not a validated model choice for this task. The proposed starting configuration is low thinking for interpretation and medium for candidate generation, using `ThinkingConfig` on supported models. Record the actual setting and compare quality/latency before changing it. Keep thought output out of the technician response. [Gemini thinking documentation](https://ai.google.dev/gemini-api/docs/thinking).

### Jev decision tasks

Jev receives compact text/JSON state and predefined answer options. It does not write the questions, explanations or React Flow nodes. The shared bounded Choice adapter handles `next_step`, `answer_readiness` and `question_type` as distinct tasks.

| Decision           | Input and options                                                                                                                                                                                                                                        | Output                                                                                      | What the backend does                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `answer_readiness` | Original answer, saved question, Gemini's proposed interpretation and referenced evidence. Choice options: `ready`, `clarify`, `unknown`. Ask whether the supplied answer supports the proposed meaning, not whether a machine fault is physically true. | Selected option, probability for every option, provider confidence and model version.       | Clear predefined answers skip this call. For free text, `ready` permits showing the interpretation for confirmation; `clarify`, uncertainty or failure requests clarification. Explicit Unknown needs no provider call. |
| `next_step`        | Confirmed observations, current hypotheses, available evidence and the locally eligible candidate catalogue, including the deterministic fallback and applicable review/escalation options.                                                              | Selected candidate ID, complete option distribution, provider confidence and model version. | Validate the choice and distribution, apply the selection threshold, then activate the selected eligible node. Preserve useful alternatives as proposed nodes.                                                          |
| `question_type` | Generated question prompt and target fact; seven 5W2H purposes, causal Why, hypothesis test and unclassified options. | Selected purpose, complete probability distribution and model version. | Save the category and provenance on the node for colors/labels only. Predefined and legacy questions use the local fact mapping; failures retain it or remain unclassified. |

Reuse the existing `choose_next_step` transport, bounds and response checks. If only one eligible action remains, skip Jev. Configuration/source restrictions and a required review stop are applied before any model selection. Jev cannot override them. [TypeSafe API reference](https://docs.typesafe.ai/api).

Keep **answer interpretation**, **evidence support** and **next-step selection** separate. Store the full distribution and Jev's returned `confidence`; use the selected option's probability for routing. The existing next-step gate defaults to `0.75`, an unevaluated prototype threshold. Set and evaluate answer-readiness gating separately; do not silently reuse that threshold. Label displayed probabilities with their decision and never present them as fault probabilities or “confidence in the user.” Jev's documented calibration does not guarantee an individual answer is correct. [TypeSafe System One documentation](https://docs.typesafe.ai/concepts/system-one).

### Order of one investigation turn

```text
Saved technician answer
  → direct normalisation OR Gemini interpretation
  → Jev readiness check when needed → technician confirms free-text meaning
  → existing assessment updates from the confirmed observation
  → Gemini proposes immediate follow-up candidates
  → backend filters candidates and retains an eligible baseline
  → Jev selects the next step
  → Jev classifies the retained generated questions; predefined prompts keep fixed categories
  → backend saves expansion → React Flow shows children and one active question
```

1. Save the original answer against its node/revision before provider work. An answer can be recorded while its interpretation is pending; do not treat it as a confirmed fact yet.
2. Resolve meaning through the direct or free-text path above. If clarification is needed, extend with a clarification node and pause diagnostic use of the ambiguous answer. Save a pending interpretation and finish the job while waiting for the technician; confirmation is a revisioned action that schedules the next cycle. Do not hold a worker open or generate diagnostic alternatives from an unconfirmed interpretation.
3. Feed the confirmed, source-linked observation to the existing assessment. Changes in supporting/conflicting facts update hypotheses through that shared assessment, rather than accepting an LLM's unvalidated diagnosis.
4. Call Gemini for immediate candidates. Validate configuration, prerequisites, allowed evidence topics, references, expected answer definitions and duplication. Reject invented measurements and unsupported physical instructions. Reference checks alone do not prove semantic support; include source-support review in evaluation.
5. Merge eligible generated candidates with the deterministic baseline and review/escalation choices. Deduplicate and bound the expansion to three children while retaining the selected action and its fallback where useful. Run Jev only against the filtered catalogue.
6. Commit the expansion only if the parent answer and incident input fingerprint remain current. Attach each child to that answer, mark alternatives proposed and activate one selected question/check. Reuse Gemini's validated candidate explanation and Jev's recorded selection status; no additional Gemini call is required merely to display the chosen node.

Initialisation uses assessment → Gemini candidates → filtering → Jev selection, but commits only the selected root node. Alternatives are context at that point; no child nodes appear before the technician answers. Later generation always extends the answered node, not the entire diagram. A technician-selected alternative stays active unless completed, invalidated or replaced by an explicit selection; background processing must not silently switch it.

A clear choice answer normally needs one Gemini generation call and one Jev selection call. Each retained generated question also receives a purpose-classification call; predefined prompts need none. Free text can additionally need Gemini interpretation and Jev readiness, followed by technician confirmation. Do not call providers again on polling, reload or unchanged inputs; reuse saved expansions, classifications and the existing job fingerprint/retry logic.

### Reuse configuration and failure handling

| Implementation area               | Planned change                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnostic.py`                   | Add typed interpretation/candidate tasks beside the current Gemini integration. Keep `enrich_assessment` as explanation-only; give new reasoning tasks their own prompt versions and validation.                              |
| `decision.py`                     | Keep `next_step` Choice handling and add an explicitly typed readiness decision. Preserve eligible-ID, finite probability, complete distribution, timeout and response-size checks.                                           |
| `service.py` and `coordinator.py` | Extend the existing analysis cycle to the order above, persist raw/confirmed answers and reject stale expansions. Keep handoff work independent of model latency.                                                             |
| `settings.py`                     | Reuse `GEMINI_API_KEY`, `FLOWPILOT_GEMINI_MODEL`, `FLOWPILOT_REASONING_ENABLED`, and the existing Jev key/model/enabled settings. Retain current timeouts; make task thinking/readiness policy explicit when implementing it. |

Use the existing synthetic-only external-data policy and server-side keys. Save provider/model, task/prompt version, thinking setting, input revision/fingerprint, selected decision, validation status and fallback reason. Never persist credentials or raw provider error messages. Mock startup must continue to work without either live provider.

| Failure                                                | Behaviour                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Gemini interpretation is unavailable or unsupported    | Keep the raw answer and request a structured answer/clarification; do not manufacture a fact.               |
| Jev readiness is uncertain or fails                    | Keep interpretation unconfirmed and request clarification/manual confirmation; no automatic diagnostic use. |
| Gemini generation fails or every candidate is rejected | Use the eligible deterministic next step, or review/escalate if none remains. Label the fallback.           |
| Jev selection fails or falls below its gate            | Use the retained eligible baseline. Valid generated alternatives can remain proposed.                       |
| Evidence/answer/selection changes during a call        | Discard the stale expansion and retry against current inputs through the existing job workflow.             |

Compare deterministic routing, Gemini-only reasoning/selection and Gemini generation plus Jev selection. Gemini-only selection is an evaluation mode subject to the same filters, not an undisclosed application fallback. Record unavailable comparisons as not run. Adopt the combined approach based on measured synthetic workflow benefit and reviewer assessment.

## Question usefulness and graph readability

Every question must give the technician a concrete reason to answer. Show a short explanation beside the active question; open detail on selection rather than placing long machine-specification text inside every node.

| Technician needs to know     | Content to show                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Why this question?           | The evidence gap and competing explanations it could distinguish.                       |
| What should I look at?       | Relevant existing record, component and inspectable source passage, with source status. |
| What could the answers mean? | Outcome interpretations and their limitations, including Unknown.                       |
| Why this next step?          | The answer/evidence that made it useful and why other branches remain open or blocked.  |

Prefer questions that distinguish open causes, can be answered from available evidence and impose less effort than another unnecessary check. Begin with an explicit ordering/rubric, then evaluate it; do not invent numerical information-gain scores without outcome data.

Use a consistent layout with labelled connections and stable positions for completed nodes. Place new children near their parent without moving the entire chart. Provide fit-to-view and focus-current controls, readable text, keyboard operation, reduced motion and an ordered text view for the same investigation. Preserve unsaved notes during page changes. A new technician sees explanatory detail by default; an experienced technician can collapse it while using the same decisions.

Here, production quality means a readable, persistent and recoverable interface. Factory diagnostic effectiveness remains to be established separately from synthetic replay behaviour.

## Contracts persistence and feature handoffs

Extend the existing incident contract with the smallest graph state needed to reconstruct the investigation. Store logical nodes and links in the incident snapshot; calculate layout in the frontend. Do not persist a separate copy of the diagnosis inside React Flow state.

| Record              | Minimum information                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question/check node | Stable ID, parent ID and parent answer reference, kind, status, prompt, target fact, question-purpose category and optional Jev classification provenance, linked hypothesis/component IDs, source/evidence references, expected answer/outcome definitions and source revision. |
| Recorded answer     | Node ID, original answer/notes, interpretation status (pending, clarification, confirmed or Unknown), proposed/confirmed meaning, observation reference, provenance, time and correction relationship.     |
| Expansion           | Parent answer reference, proposed child IDs, recommended child ID, input revision/fingerprint and provider metadata. Reuse the existing job status for pending/failure/retry.                              |
| Branch selection    | Active eligible node ID. Selecting an alternative is a revisioned action, not an observation or result.                                                                                                    |

Add typed actions for answering generated nodes and selecting branches rather than allowing arbitrary `check_id` values through the current result action. Extend the current correction pattern so edited answers preserve originals, supersede dependent expansions and trigger reassessment. Reuse saved question definitions during interpretation; do not reconstruct their meanings from free-text IDs.

Deduplicate answer submissions and expansions using stable IDs and their input fingerprints. Extend the existing fingerprint to include saved answer/confirmation state, parent question/version and explicit technician branch selection. Exclude generated expansions and automatically activated recommendations so completing a job does not schedule itself again. A retry or browser reload must not create duplicate children. Validate revision and active-node state on the server. Late evidence, a corrected answer or a branch change must prevent an old model response from attaching to the current path. Existing incidents must load with an empty graph until initialisation; keep their earlier observations and assessments readable.

Person Two defines these contracts and owns the reasoning/graph feature. Person One coordinates persistence, action registration, job wiring and the report extension. Give Person One the saved path, answers, findings and unresolved items for handoff. Give Person Three stable hypothesis/component IDs and evidence selections for the mechanism view; coordinate changes to the workspace shell. Regenerate shared frontend types through `npm run contracts:generate`.

Reviewed learning continues through the existing candidate/review/publication flow. Closing an investigation must not automatically turn generated questions or synthetic outcomes into approved knowledge.

## Delivery checkpoints

| Checkpoint                         | Work                                                                                                                                                                              | Exit condition                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Contract and synthetic branches  | Agree node/answer/expansion contracts; reuse the base replay and supported, contradictory and inconclusive variants. Define useful questions and expected branch changes.         | All owners can inspect the same example of one root, one answer and its immediate children.                                                                                |
| 2 Complete offline graph           | Add persisted graph state, answer/selection actions and React Flow custom nodes. Use deterministic/mock expansions and existing checks.                                           | One root → answer → children → next answer works after reload, with one active step and no duplicates.                                                                     |
| 3 Adaptive Gemini questions        | Add Gemini interpretation/generation tasks with thinking settings, typed outputs and confirmation. Extend recognised observation rules.                                           | Different answers produce different grounded follow-ups, including a new question beyond the fixed discovery prompts. Missing access is visibly recorded as mock/fallback. |
| 4 Jev decision evaluation          | Add Jev readiness and next-step decisions with distinct gates/fallbacks. Compare baseline, Gemini-only and Gemini plus Jev on the same held-out scenarios.                        | Available providers have recorded results; unavailable comparisons say not run. Combined routing is enabled based on evaluated benefit.                                    |
| 5 Integrated usability and handoff | Verify corrections/concurrency, source detail, accessibility, report history and the novice/expert detail view. Run the full synthetic demo and reviewer sessions when available. | Acceptance scenarios pass and the saved graph/report explain why the next step changed. Reviewer gaps remain explicit.                                                     |

Deliver checkpoints in order. Keep offline mock demonstrations usable while live-provider work proceeds. No calendar estimate is assigned until availability and the deadline are known.

## Acceptance and evaluation

Use the existing API tests and Playwright setup. Add focused checks for the new behaviour, preserve meaningful diagnostic/provider regressions, and verify actual rendered graph interaction rather than only node counts.

| Scenario                    | Required result                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First investigation view    | Exactly one logical root node; no unanswered descendants are generated in advance.                                                                                                                |
| Answer and expand           | The original answer is saved before generation; immediate children explain their relation to that answer. Only one question/check becomes active.                                                 |
| Adaptive follow-up          | Opposite answers with the same initial incident produce different justified questions/next steps; already answered facts are not asked again.                                                     |
| Explore an alternative      | Another eligible child can become active without fabricated answers or deletion of the existing path.                                                                                             |
| Unknown or ambiguous answer | Unknown remains unknown; ambiguous text requests confirmation/clarification or different evidence. No invented measurement changes the diagnosis.                                                 |
| Model handoff               | Structured choices skip interpretation/readiness calls. Free text stays unconfirmed until technician approval even when Jev selects ready. Only eligible candidate IDs reach next-step selection. |
| Decision confidence         | Validate full distributions and selected-option probability gates; never substitute provider confidence or display a fault probability. Readiness and routing gates are evaluated separately.     |
| Contradiction               | Conflicting observations remain inspectable and can change the leading assessment and next step.                                                                                                  |
| Correct an earlier answer   | Original text and prior path remain in history; dependent suggestions are superseded, and the current assessment uses the correction.                                                             |
| Reload and retry            | Saved nodes/answers/selection are reconstructed; repeated submissions and expansion retries create no duplicates.                                                                                 |
| Late provider response      | Evidence/answer/selection revision changes prevent stale children and decisions from becoming current.                                                                                            |
| Provider failure            | Timeout, invalid output, missing key and uncertain decisions preserve the answer and show the declared fallback or review path.                                                                   |
| Source restriction          | Wrong configuration or unverified procedures cannot enable physical instructions; contextual passages stay inspectable.                                                                           |
| No useful step remains      | A terminal review/escalation node retains unresolved causes and permits inconclusive handoff.                                                                                                     |
| Accessible interaction      | The entire answer/select/review flow works with keyboard and ordered text view; labels distinguish status without colour alone.                                                                   |
| Handoff and learning        | Export includes the saved investigation path and source revision. Closure creates a review candidate without automatic publication.                                                               |

Measure question effectiveness with the same held-out synthetic scenarios across providers: agreement with reviewed eligible next steps, duplicate/irrelevant questions, unsupported statements, handling of Unknown/contradictions, questions/checks to a justified review outcome, and response latency. Keep evaluation answers out of generation prompts and report results as synthetic workflow measurements. Existing authored fixtures can support regression but are not independently validated diagnostic labels.

For selection-only comparisons, give each selector the same saved context and eligible candidate set. Evaluate generated questions separately against reviewer-defined acceptable questions and outcomes, then compare complete investigation paths. This separates a better question generator from a better selector.

To test the experience gap, use matched synthetic scenarios with a manual specification lookup/check workflow and the graph workflow. When reviewers are available, involve both new and experienced technicians, vary scenario/order to reduce practice effects, and record time, unnecessary checks, correct escalation and whether participants can explain the next step. Fewer questions alone is not success if the system misses ambiguity or a necessary check. No improvement percentage is claimed before this study runs.

Give both workflows the same available passages and records. The current source set lacks approved machine manuals, so this comparison starts as synthetic reference lookup and cannot establish performance against a real site's controlled manual workflow.

During implementation run targeted API/browser checks, regenerate and verify contracts, then use the repository's `npm run check` and relevant Playwright scenarios before integration. Record only checks actually run and distinguish fake transport tests from live-provider evaluation. This document proposes those checks; writing the plan does not establish that they passed.

## Deferred work

Keep broader fault families, live equipment collection, physical procedure generation, automatic production release, model training and a general diagram editor outside this delivery. Add them only when the complete synthetic investigation works and the required reviewed methods/data exist. Continue using current source review and learning controls rather than expanding them into another subsystem.

The first deliverable is a repeatable demonstration: **one question → saved answer → meaningful alternatives → one recommended follow-up → contradictory evidence redirects the path → traceable engineer handoff**.
