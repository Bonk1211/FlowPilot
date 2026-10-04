# S932 two-minute demo script

Finalist script for the incident workspace. It replaces the nozzle-wizard flow in [M3_SUBMISSION.md](M3_SUBMISSION.md) for this round. Segment owners follow the [team plan](S932_REVAMP_TEAM_PLAN.md#9-two-minute-demonstration-ownership); Segment 3 is Person 2's reasoning presented by Person 3. Everything shown is a synthetic replay: no machine is connected and no email is sent.

## Before the demo

```sh
npm ci
uv sync --locked
npm run db:migrate
npm run dev:mock
```

Open `http://127.0.0.1:5173/` at 1440×900. `dev:mock` runs background analysis and draft jobs, so the workspace can update while you click. Replay collection, analysis and draft refresh tolerate those background updates. Other actions show "Incident changed" if a background job saved first; reload and repeat.

## Segment 1 — 0:00–0:20 · Incident response (Person 1)

| Click | Say |
|---|---|
| **Start S932 replay** | "A coverage alarm opens an incident. It is saved before any AI runs." |
| Feature rail → **Evidence** | "Evidence arrives progressively: 2 of 4 sources so far. The machine log is still pending and the PM record is unavailable, but none of that blocks us." |
| Feature rail → **Handoff** | "The engineer handoff already exists: what we know, what is missing, no cause claimed. Diagnosis is still pending." |

## Segment 2 — 0:20–0:45 · Images and timeline (Person 3)

| Click | Say |
|---|---|
| Feature rail → **Evidence** → **Collect next evidence** | "A material change and a falling-mass record arrive. The dashed cards are sources we never received: the PM record is unavailable and the pressure export is pending. We do not assume they were normal." |
| **Compare images** | "Last known good next to first known bad, each with its source and time. They are illustrative images, so they show where to look, not a measurement." |
| Timeline marker **Material container changed…** | "The recent change sits before the decline. The clocks are uncertain, so the order is provisional, and the original timestamps stay available." |

## Segment 3 — 0:45–1:10 · Hypotheses and mechanism (Person 2 supplies the reasoning, Person 3 presents it)

| Click | Say |
|---|---|
| Feature rail → **Investigation** → **Analyze available evidence** → **Exit full screen** | "Three explanations stay open: restriction, unstable delivery and a material change. None is declared the cause." |
| In **Evidence and mechanism**, timeline marker **Falling mass with a stable recorded pressure trend** | "This record is compatible with all three explanations, so it cannot separate them. It also conflicts with unstable delivery, because a stable pressure log can miss short transients." |
| **Conflicts with Unstable fluid delivery** | "Its components light up: BFS bottle, BFS pressure, pickup tube, fluid QD. The chips say Inferred and Simulated; nothing here is a sensor reading." |
| Feature rail → **Simulation** → **Compare mechanisms** | "Restriction and unstable delivery share the pickup tube and fluid QD. They differ in the feed tube and nozzle versus the bottle and its pressure, and each lists what evidence is still missing." |

If the 3D view cannot start, the 2D schematic carries the same highlights; use **2D schematic** and carry on.

### Optional: the experiment loop (about 25 s, replaces the last row of Segment 3)

Use an incident whose investigation has two confirmed answers (for example frequency **intermittent**, pressure **unstable**).

| Click | Say |
|---|---|
| Live rail → **Unstable fluid delivery** | "Each experiment says why it is worth running, what it tests and what the illustrative model predicts: here, a decline that comes and goes." |
| **Run all three experiments** | "Three plans, each approved as the demo engineer and run in the background. Nothing here touches a machine." |
| Playback steps 3, 4 and 7 | "The parts this explanation involves come apart; the liquid arrives in surges with gaps; the deposit builds stripe by stripe. Every frame says Simulated." |
| Unstable track → **Return to investigation with this finding** | "Only this one is consistent with the records under the stated criteria. It comes back as a dashed simulated finding with a suggested manual check. It is not evidence, and it does not confirm the cause." |

Do not say the simulation found, confirmed or ranked the cause.

## Segment 4 — 1:10–1:40 · Question and labelled result (Person 2)

To be written by Person 2: answer a question and load a labelled check result. Person 1's segment 5 assumes this segment records a **contradicted** delivery result, which moves the next step to "Review the recorded fluid-path finding".

## Segment 5 — 1:40–2:00 · Engineer package (Person 1)

| Click | Say |
|---|---|
| Feature rail → **Handoff** | "The draft followed the evidence. It now carries the contradicted delivery check and the new next step, still marked not sent." |
| Feature rail → **Investigation** → **Export report** | "One file for the engineer: evidence with hashes and timing, every assessment revision, the check results and unresolved items. It is tied to a recorded incident revision and states that this is a synthetic replay." |

## Alternate result

If asked whether the system just follows a script, record **supported** instead of **contradicted** at the first check. The ranking, next step, handoff draft and report all change to follow that result.

## What not to claim

Synthetic data only. No real machine connection, diagnostic accuracy, email delivery or downtime saving is demonstrated. The browser timings in [S932_MOCK_EVALUATION.md](S932_MOCK_EVALUATION.md#browser-timing) come from a local loopback run, not production.

## Rehearsal record

3 October 2026: Segments 1 and 5 plus the contradicted path were run twice through Playwright with `dev:mock` settings. Both runs completed with no on-page errors. The report contained the recorded revision, the snapshot SHA-256, the contradicted result, the new next step and "Investigation open; no final conclusion." A live rehearsal with all three presenters is still needed.

3 October 2026 (Segments 2 and 3): `test/e2e/incident-demo-segments.spec.ts` follows both segments click for click and checks the claims the narration makes: two uncollected sources, the good/bad pair, the provisional ordering, three open hypotheses, the four components behind "unstable delivery", and the shared and distinct components in the comparison. It passed, and the clicking alone took about 0.7 s (segment 2) and 0.9 s (segment 3) against the local test server. Speaking time and presenter handover are not measured. The board, comparison and uncollected-source markers were also inspected in the browser against `dev:mock`. No timed run with presenters has been done.
