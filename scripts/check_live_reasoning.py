"""Opt-in, synthetic-data Gemini acceptance check. Never prints credentials."""

import asyncio
import json
import sys
from pathlib import Path

from flowpilot.cases import (
    Answer,
    Confirm,
    CreateCase,
    Diagnose,
    Inspect,
    apply_action,
    create_case,
)
from flowpilot.diagnosis.reasoning import enrich
from flowpilot.settings import Settings


async def main():
    settings = Settings(reasoning_enabled=True)
    if not settings.gemini_api_key:
        raise SystemExit("Configure GEMINI_API_KEY in the ignored root .env first.")
    if "--list-models" in sys.argv:
        from google import genai

        async with genai.Client(api_key=settings.gemini_api_key.get_secret_value()).aio as client:
            async for model in await client.models.list():
                if "generateContent" in (model.supported_actions or []):
                    print(model.name)
        return
    case = create_case(
        CreateCase(report="Synthetic acceptance: declining flux spray coverage.")
    )
    for value in ("continuous", "yes", "no", "unknown", "unknown"):
        apply_action(
            case,
            Answer(
                action="answer",
                revision=case.revision,
                question_id=case.next_question.id,
                value=value,
            ),
        )
    apply_action(case, Diagnose(action="diagnose", revision=case.revision))
    records = []
    for outcome in (None, "obstruction_found", "no_obstruction_found"):
        branch = case.model_copy(deep=True)
        if outcome:
            apply_action(
                branch, Inspect(action="inspect", revision=branch.revision, outcome=outcome)
            )
            apply_action(
                branch,
                Confirm(action="confirm_observation", revision=branch.revision, confirmed=True),
            )
        before = branch.investigation.model_dump(), [c.model_dump() for c in branch.ranking]
        await enrich(branch, settings)
        assert before == (
            branch.investigation.model_dump(),
            [c.model_dump() for c in branch.ranking],
        )
        records.append(
            {
                "outcome": outcome or "initial",
                "reasoning": branch.reasoning.model_dump(mode="json"),
                "findings": [f.model_dump(mode="json") for f in branch.findings],
            }
        )
        print(
            f"{outcome or 'initial'}: {branch.reasoning.mode}; {branch.reasoning.fallback_reason or 'critic accepted'}",
            flush=True,
        )
    cached = case.model_copy(deep=True)
    await enrich(cached, Settings(reasoning_enabled=False))
    assert cached.reasoning.mode == "cached"
    records.append(
        {"outcome": "forced_cached", "reasoning": cached.reasoning.model_dump(mode="json")}
    )
    output = Path("artifacts/demo/live-reasoning-check.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, indent=2), encoding="utf-8")
    if any(item["reasoning"]["mode"] != "live" for item in records[:3]):
        raise SystemExit(
            "Live acceptance incomplete; inspect safe fallback reasons in the artifact."
        )
    print("Live branches and forced cached mode passed.")


asyncio.run(main())
