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
| Feature rail → **Investigation** → **Analyze available evidence** | "Three explanations stay open: restriction, unstable delivery and a material change. None is declared the cause." |
| In **Evidence and mechanism**, timeline marker **Falling mass with a stable recorded pressure trend** | "This record is compatible with all three explanations, so it cannot separate them. It also conflicts with unstable delivery, because a stable pressure log can miss short transients." |
| **Conflicts with Unstable fluid delivery** | "Its components light up: BFS bottle, BFS pressure, pickup tube, fluid QD. The chips say Inferred and Simulated; nothing here is a sensor reading." |
| Feature rail → **Simulation** → **Compare mechanisms** | "Restriction and unstable delivery share the pickup tube and fluid QD. They differ in the feed tube and nozzle versus the bottle and its pressure, and each lists what evidence is still missing." |

If the 3D view cannot start, the 2D schematic carries the same highlights; use **2D schematic** and carry on.

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

3 October 2026 (Segments 2 and 3): the linked board, mechanism comparison, uncollected-source markers, no-WebGL fallback, keyboard and reduced-motion paths and phone width are covered by Playwright specs in `test/e2e/incident-navigation.spec.ts`, and the board and comparison were inspected once in the browser against `dev:mock`. No timed run with presenters has been done.
