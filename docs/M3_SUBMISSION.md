# FlowPilot submission package

Target length: **8 minutes**, including deliberate pauses for readable evidence and
interaction. Audience: hackathon judges, process engineers and technicians.
This is a narration/recording package, not an uploaded or approved submission.
Use only synthetic cases and the current v2 flux scenario.

## Recording runbook

1. Run the validation commands in DEVELOPMENT.md. Use a fresh migrated demo
   database and a fresh browser profile. Keep prior real/developer databases intact.
2. Set `FLOWPILOT_REASONING_TIMEOUT_SECONDS=12` for the live demo. Use
   `FLOWPILOT_REASONING_ENABLED=false` for a dependable cached recording. Keep the
   mode label visible and describe whichever mode actually appears.
3. Record at 1440 × 900 or larger with browser zoom at 100%. Follow the eight-minute
   sequence below. Allow time to read evidence; pause playback before explaining a part.
4. Use the visible **Restart demo** button between cases. The prior case must still
   load by its saved URL. Never manually edit the database or bypass confirmations.
5. Use `playwright.rehearsal.config.ts` for automated footage, traces and results.
   Automated footage is a source asset, not a substitute for the narrated final cut.
6. Record the script below in the presenter's own voice. Align the accompanying
   `submission-captions.srt` chapter captions to the finished cut; add verbatim
   captions from the actual narration before publication. Do not represent chapter
   captions as a complete accessibility transcript.

## Eight-minute script and shot list

### 00:00–00:45 — Problem and boundary

**Shot:** Report screen; show the flux-spray scenario and simulated image label.

“FlowPilot helps a technician investigate declining flux-spray coverage. A defect
image, an operator report and machine events can describe different parts of the
same incident. The challenge is keeping those observations traceable while deciding
what to check next. This demonstration models the S-932 and DJ-2200 flux-spray
configuration. Its images, geometry and recovery results are simulated. FlowPilot
does not control the equipment or authorize physical maintenance.”

Pause on the report, then start the investigation.

### 00:45–01:40 — Measured symptoms and source evidence

**Shot:** Coverage overlay, measurement values, sample log preview and raw event view.

“The image measurement describes the symptom: target coverage, uncovered area,
pattern displacement, coarse deposits and material outside the boundary. These
pixels cannot tell us deposited weight or fluid pressure. We can also attach a
controlled machine log. Each extracted fact retains its source, timestamp and units;
unknown records remain available. A machine PASS is not treated as product-quality
acceptance. Here we can open the original event instead of trusting an unexplained
summary.”

Attach the previewed log and return from the source viewer. Hold the compound units
on screen long enough to read them.

### 01:40–02:30 — Adaptive discovery

**Shot:** Answer incomplete coverage, falling weight, stable pressure, and unknown
material/idle information using the normal controls.

“The next questions narrow the investigation without pretending that every field
is known. In this case, coverage and reported flux weight are declining, while the
operator reports no known pressure change. Material conditions remain unknown.
An unknown answer contributes no diagnostic weight. Operator input remains
distinguishable from measured image evidence and machine-log facts. If an answer
is corrected, FlowPilot keeps its history and recomputes the affected branch.”

Complete discovery and select Diagnose case.

### 02:30–03:35 — Explained diagnosis and reasoning

**Shot:** Five ranked causes, score contributions, evidence links, known gaps and
specialist/critic findings. Keep the live/cached label readable.

“Five cause families are compared: fluid-path restriction, atomization, pressure or
BFS supply, alignment or recipe, and material conditions. These numbers are
heuristic points, not probabilities. Each contribution links back to evidence.
Restriction is a candidate, not proof of exclusive causality. Two specialists
explain the evidence and a critic checks their grounding and missing information.”

**If live:** “These findings came from the live provider and passed the application's
citation and coverage checks.”

**If cached:** “This run uses labelled deterministic findings. The case workflow
remains usable when model access fails; cached text is never presented as live AI.”

“The server owns scores and confirmation gates in either mode.”

### 03:35–04:35 — Illustrative inspection and explicit confirmation

**Shot:** Start the procedure, show synchronized component highlight and text,
keyboard camera buttons, then briefly switch to 2D.

“The guide connects each instruction to an illustrative component. Text and a 2D
view remain available without WebGL. Playback moves the camera and highlight; it
does not operate machinery or demonstrate an approved removal procedure. Site
procedures and authorized personnel determine isolation, tools and service steps.
The inspection here is nozzle-only. Selecting an observation is separate from
confirming it.”

Select obstruction found. Pause on the disabled confirmation button, explicitly
confirm the simulated observation, and show the resulting state.

### 04:35–05:45 — Action and recovery gates

**Shot:** Record simulated nozzle replacement; fill recovery checks; demonstrate a
failed coarse sample followed by a freshly confirmed normal sample.

“A confirmed obstruction establishes the observed restriction. It does not establish
recovery. We separately record a simulated corrective action, then verify setup,
calibration, weight and pressure against a named reference. Both lanes require
all-unit acceptance on the first carrier. Subsequent-tray applicability must be
explicit. This coarse sample fails even when calibration passes, so the case stays
open. A retry requires fresh confirmation. Two calibration failures would require
escalation and block ordinary retries.”

Show passing measurements, then explicitly confirm resolution. Explain that the
result resolves a simulated case and does not release a production lot.

### 05:45–06:30 — Saved result and repeatability

**Shot:** Completed summary, evidence, ranking, timeline, reload, then Restart demo.

“The saved summary brings together the original problem, evidence, ranked causes,
inspection, action and verification. Reloading restores the persisted result.
Restart demo creates another investigation while retaining this one and its audit
history. Our rehearsal exercises two consecutive complete journeys with fresh
confirmations, using the same controls shown here.”

Keep the old case URL available for a final persistence check.

### 06:30–07:20 — Negative inspection and uncertainty

**Shot:** Fresh case, completed discovery, nozzle inspection with no obstruction,
explicit confirmation, changed ranking and open-case message.

“A clear nozzle does not prove the whole fluid path is clear. The negative result
is recorded before reassessment, and the case remains open. FlowPilot redirects
attention to the air cap, coaxial air, pressure stability, BFS and connections,
followed by material and alignment checks. It does not invent a second repair
workflow or close the case just because one candidate became less likely.”

### 07:20–08:00 — Reliability and honest limits

**Shot:** Labelled fallback footage, offline storyboard, final summary/review status.

“The prototype is tested for provider fallback, unavailable API responses, stale
case revisions, recovery failures and accessible viewing alternatives. An
interrupted case action requires reloading the saved state before retrying.
The offline storyboard is labelled and separate from a persisted investigation.
This submission demonstrates one traceable, simulated restriction-recovery path.
Joint contract acceptance and revised expert procedure approval remain pending.
The next step is review of this exact candidate, not a claim of production readiness.”

## External completion records

Automated positive journeys and cached recordings establish workflow repeatability.
They do not satisfy the full timed presentation rehearsal requirement. Run the
complete script twice, from fresh demo state, with narration and readable pauses.
Record actual results below; leave a run pending if it needed database edits,
prompt changes, developer-only intervention or an unplanned restart.

| Timed rehearsal | Presenter / date | Duration (6–10 minutes) | Reasoning mode | Reset, both outcomes and readable pacing | Recording / result |
| --- | --- | --- | --- | --- | --- |
| 1 | Pending | Pending | Pending | Pending | Pending |
| 2 | Pending | Pending | Pending | Pending | Pending |

During the completed-case segment, show the saved completion notes, current versus
rejected evidence, earlier recovery attempts and the revision-linked diagnostic
history. Explain that old cases cannot recover historical results that were never saved.

| Checkpoint | Required record | Current status |
| --- | --- | --- |
| M0 joint acceptance | Both named reviewers, date, candidate hash, reviewed commit and decision in MILESTONES.md | Pending |
| Revised procedure review | Authorized reviewer identity, date, reviewed candidate, controlled-document applicability, requested changes and explicit decision | Pending |
| Final narrated video | Local path, duration between 6 and 10 minutes, audio/caption and visual review | Pending final narration/edit |
| Submission access | Destination URL, uploader, upload time and successful signed-out playback check | Pending |

Reviewer form: **Name / role:** ___; **date and timezone:** ___; **candidate hash:**
___; **reviewed commit:** ___; **controlled references and applicability:** ___;
**decision and limitations:** ___; **required changes:** ___. Obtain fresh review
after any change to the reviewed boundary. Feedback previously received is not
approval of the revised procedure.

Before final upload, confirm that the title and description identify a simulated
prototype, narration matches the displayed reasoning mode, no credentials or real
case data appear, captions match the audio, and the complete video plays signed out.
