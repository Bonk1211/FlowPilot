"""Opt-in real Gemini rehearsal; creates photo cache only, never case records."""

import argparse
import asyncio
import json
import os
import time
from pathlib import Path

from flowpilot.intake import LogContextRequest, ObservationChoice, log_context
from flowpilot.question_plan import QuestionPlanRequest, plan_questions
from flowpilot.settings import Settings
from flowpilot.vision import assess_example


async def rehearse():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Allow real Gemini API requests")
    args = parser.parse_args()
    if not args.live:
        parser.error("Pass --live to consume Gemini requests using demo evidence.")
    directory = Path(".cache/question-plan-rehearsal")
    directory.mkdir(parents=True, exist_ok=True)
    os.environ["FLOWPILOT_VISION_STORAGE_DIR"] = str((directory / "vision").resolve())
    settings = Settings()
    if not settings.gemini_api_key or not settings.reasoning_enabled:
        parser.error("Configure Gemini and enable reasoning before a live rehearsal.")
    rows = []
    for symptom, example, name, board in [
        ("continuous", "incomplete", "incomplete-coverage", "103"),
        ("intermittent", "coarse", "coarse-deposits", "203"),
    ]:
        photo = assess_example(example)
        for run in range(1, 6):
            request = QuestionPlanRequest(
                assessment_id=photo.assessment_id,
                state_id=f"{symptom}-{run}-initial",
                observations={"frequency": ObservationChoice(value=symptom)},
                log={
                    "text": Path(f"fixtures/logs/synthetic-{name}.log").read_text(),
                    "sourceName": f"{name}.log",
                },
                board_id=board,
                log_confirmed=True,
            )
            for phase in ["initial", "new_information"]:
                started = time.monotonic()
                result = await plan_questions(request)
                row = {
                    "route": name,
                    "run": run,
                    "phase": phase,
                    "request_ms": round((time.monotonic() - started) * 1000),
                    "mode": result.mode,
                    "reason": result.fallback_reason,
                    "order": [q.question_id for q in result.questions],
                    "clarification": result.clarification.model_dump()
                    if result.clarification
                    else None,
                }
                rows.append(row)
                print(json.dumps(row), flush=True)
                if phase == "initial":
                    first = result.questions[0].question_id
                    signals = log_context(
                        LogContextRequest(log=request.log, board_id=board)
                    ).signals
                    signal = signals.get(first)
                    request.observations[first] = ObservationChoice(
                        value=signal.answer if signal else "unknown",
                        source="machine_log" if signal else "technician_input",
                    )
                    request.supplements = {
                        first: (
                            "It began immediately after changing flux material. "
                            "Material stability has not been checked."
                        )
                    }
                    request.state_id = f"{symptom}-{run}-new-information"
    (directory / "results.json").write_text(json.dumps(rows, indent=2) + "\n")


asyncio.run(rehearse())
