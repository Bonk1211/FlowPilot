import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from flowpilot import question_plan as module
from flowpilot.question_plan import (
    ModelQuestionPlan,
    QuestionPlanRequest,
    plan_questions,
    prepare,
    validate_plan,
)
from flowpilot.settings import Settings


@pytest.fixture
def plan_request(monkeypatch):
    monkeypatch.setattr(
        module,
        "load_assessment",
        lambda _: SimpleNamespace(passed=False, raw_score=3.2, threshold=1.88),
    )
    return QuestionPlanRequest(
        assessment_id="VIS-test",
        state_id="state-1",
        observations={"frequency": {"value": "continuous"}},
    )


def test_disabled_is_explicit_and_has_complete_fallback(plan_request):
    result = asyncio.run(plan_questions(plan_request))
    assert result.mode == "fallback"
    assert result.fallback_reason == "Live question planning is disabled."
    assert [q.question_id for q in result.questions] == [
        "continuous",
        "change",
        "temperature",
        "service",
    ]
    assert not result.ready


def test_live_can_prioritize_material_and_returns_bound_state(plan_request):
    async def generate(payload, settings):
        _, result = prepare(plan_request)
        result.questions = sorted(result.questions, key=lambda q: q.question_id != "temperature")
        return result

    result = asyncio.run(plan_questions(plan_request, Settings(reasoning_enabled=True), generate))
    assert result.mode == "live"
    assert result.questions[0].question_id == "temperature"
    assert result.state_id == plan_request.state_id


@pytest.mark.parametrize("mutation", ["duplicate", "citation", "trigger", "interpretation"])
def test_invalid_model_output_falls_back(plan_request, mutation):
    async def generate(payload, settings):
        _, plan = prepare(plan_request)
        raw = plan.model_dump()
        if mutation == "duplicate":
            raw["questions"][0] = raw["questions"][1]
        elif mutation == "citation":
            raw["source_refs"] = ["invented"]
        elif mutation == "trigger":
            raw["replan_when"] = [{"question_id": "change", "answer": "invented"}]
        else:
            raw["clarification"] = {
                "question_id": "temperature",
                "prompt": "Confirm?",
                "proposed_value": "yes",
                "source_ref": "note:temperature",
            }
        return raw

    result = asyncio.run(plan_questions(plan_request, Settings(reasoning_enabled=True), generate))
    assert result.mode == "fallback"
    assert len(result.questions) == 4


def test_note_interpretation_is_only_a_proposal_and_not_ready(plan_request):
    plan_request.supplements = {"frequency": "Started after material change"}
    payload, fallback = prepare(plan_request)
    raw = fallback.model_dump()
    raw["clarification"] = {
        "question_id": "temperature",
        "prompt": "Material concern?",
        "proposed_value": "yes",
        "source_ref": "note:frequency",
    }
    result = validate_plan(ModelQuestionPlan.model_validate(raw), payload)
    assert result.clarification.proposed_value == "yes"
    assert "temperature" not in plan_request.observations
    payload["already_clarified"] = ["temperature"]
    with pytest.raises(ValueError):
        validate_plan(result, payload)


def test_timeout_cancels_generation_without_retry(plan_request, monkeypatch):
    monkeypatch.setattr(module, "DEADLINE_SECONDS", 0.05)
    calls = []

    async def generate(payload, settings):
        calls.append(1)
        await asyncio.sleep(1)

    result = asyncio.run(plan_questions(plan_request, Settings(reasoning_enabled=True), generate))
    assert result.mode == "fallback"
    assert "4-second" in result.fallback_reason
    assert calls == [1]


def test_reject_unconfirmed_log_and_inactive_branch(plan_request):
    plan_request.observations["intermittent"] = module.ObservationChoice(value="yes")
    with pytest.raises(HTTPException) as failure:
        prepare(plan_request)
    assert failure.value.status_code == 422
    plan_request.observations.pop("intermittent")
    plan_request.log = module.LogPreviewRequest(text="log", sourceName="test.log")
    with pytest.raises(HTTPException, match="Confirm or remove"):
        prepare(plan_request)


def test_sdk_request_has_one_attempt_and_bounded_timeout(plan_request, monkeypatch):
    from google import genai

    captured = {}
    _, fallback = prepare(plan_request)

    class Client:
        def __init__(self, **kwargs):
            captured.update(kwargs)
            self.aio = self
            self.models = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def generate_content(self, **kwargs):
            return SimpleNamespace(text=fallback.model_dump_json())

    monkeypatch.setattr(genai, "Client", Client)
    asyncio.run(
        module.generate(
            {"remaining": [], "evidence": {"photo": {}}}, Settings(gemini_api_key="test")
        )
    )
    assert captured["http_options"].retry_options.attempts == 1
    assert captured["http_options"].timeout == 10000


def test_completed_answers_are_ready_only_without_interpretation(plan_request):
    for key in ("continuous", "change", "temperature", "service"):
        plan_request.observations[key] = module.ObservationChoice(value="unknown")
    result = asyncio.run(plan_questions(plan_request))
    assert result.ready
    assert result.questions == []


def test_read_only_endpoint_returns_state_and_rejects_invalid_branch(plan_request):
    from fastapi.testclient import TestClient
    from flowpilot.main import app

    client = TestClient(app)
    response = client.post("/api/intake/question-plan", json=plan_request.model_dump())
    assert response.status_code == 200
    assert response.json()["state_id"] == "state-1"
    plan_request.observations["intermittent"] = module.ObservationChoice(value="yes")
    assert (
        client.post("/api/intake/question-plan", json=plan_request.model_dump()).status_code == 422
    )
