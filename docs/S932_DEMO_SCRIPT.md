# S932 two-minute demo script

Finalist script for the incident workspace. It replaces the nozzle-wizard flow in [M3_SUBMISSION.md](M3_SUBMISSION.md) for this round. Segment owners follow the [team plan](S932_REVAMP_TEAM_PLAN.md#9-two-minute-demonstration-ownership). Everything shown is a synthetic replay: no machine is connected and no email is sent.

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

## Segments 2–4 — 0:20–1:40 (Persons 3 and 2)

To be written by their owners: image comparison and timeline (0:20–0:45), hypotheses and 3D mechanism (0:45–1:10), then answer a question and load a labelled check result (1:10–1:40). Person 1's segment 5 assumes this segment records a **contradicted** delivery result, which moves the next step to "Review the recorded fluid-path finding".

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
