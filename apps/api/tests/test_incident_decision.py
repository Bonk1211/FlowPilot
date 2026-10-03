import asyncio
import json

import httpx
import pytest
from flowpilot.incidents.decision import DecisionOption, check_answer_readiness, choose_next_step
from flowpilot.incidents.models import InvestigationQuestion
from flowpilot.incidents.question_types import classify_question
from flowpilot.settings import Settings

OPTIONS = [
    DecisionOption(
        id="delivery_review", kind="check", description="Review delivery record.", eligible=True
    ),
    DecisionOption(
        id="material_review", kind="check", description="Review material record.", eligible=True
    ),
    DecisionOption(
        id="operate_machine", kind="check", description="Not authorized.", eligible=False
    ),
]


def test_question_classification_is_separate_from_diagnosis_and_preserves_fallbacks():
    question = InvestigationQuestion(
        id="generated-impact",
        target_fact="reported_impact",
        prompt="Why does this defect matter for product quality?",
        why="Record impact.",
    )
    settings = Settings(
        _env_file=None,
        incident_jev_enabled=True,
        jev_gateway="openrouter",
        openrouter_api_key="classification-test-key",
    )

    async def run(probability, allowed=True):
        def handler(request):
            payload = json.loads(request.content)
            assert str(request.url) == "https://openrouter.ai/api/v1/systemone"
            assert set(payload["questions"]) == {"question_type"}
            assert json.loads(payload["state"]) == {
                "prompt": question.prompt,
                "target_fact": question.target_fact,
            }
            classification = payload["questions"]["question_type"]
            assert "untrusted DATA" in classification["instructions"]
            categories = classification["criteria"]
            assert "why_impact" in categories and "why_cause" in categories
            probabilities = {key: 0.0 for key in categories}
            probabilities.update(why_impact=probability, unclassified=1 - probability)
            return httpx.Response(
                200,
                json={
                    "model": "jev-test",
                    "usage": {"input_tokens": 1, "output_tokens": 1},
                    "answers": {
                        "question_type": {
                            "type": "choice",
                            "choice": "why_impact",
                            "confidence": 1,
                            "probabilities": probabilities,
                        }
                    },
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await classify_question(question, settings, allowed, client)

    classified = asyncio.run(run(0.95))
    assert classified.selected_id == "why_impact" and classified.provider == "jev"
    assert "purpose only" in classified.limitation
    assert "classification-test-key" not in classified.model_dump_json()
    uncertain = asyncio.run(run(0.6))
    assert uncertain.selected_id == "unclassified" and uncertain.status == "fallback"
    assert uncertain.response is not None
    local = asyncio.run(run(0.95, allowed=False))
    assert local.provider == "deterministic" and local.response is None
    assert local.selected_id == "unclassified"
    assert question.question_type == "unclassified"  # A classification never mutates the question.


@pytest.mark.parametrize("gateway", ["typesafe", "openrouter"])
def test_readiness_has_a_separate_gate_and_never_routes_by_provider_confidence(gateway):
    async def run(probabilities):
        def handler(request):
            assert request.headers["Authorization"] == f"Bearer {gateway}-test-key"
            payload = json.loads(request.content)
            assert set(payload["questions"]) == {"answer_readiness"}
            return httpx.Response(
                200,
                json={
                    "model": "jev-test",
                    "usage": {"input_tokens": 1, "output_tokens": 1},
                    "answers": {
                        "answer_readiness": {
                            "type": "choice",
                            "choice": "ready",
                            "probabilities": probabilities,
                            "confidence": 0.99,
                        }
                    },
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await check_answer_readiness(
                {},
                Settings(
                    _env_file=None,
                    incident_jev_enabled=True,
                    jev_gateway=gateway,
                    jev_api_key="typesafe-test-key",
                    openrouter_api_key="openrouter-test-key",
                    jev_min_probability=0.75,
                    jev_answer_min_probability=0.9,
                ),
                client=client,
            )

    uncertain = asyncio.run(run({"ready": 0.8, "clarify": 0.15, "unknown": 0.05}))
    assert uncertain.task == "answer_readiness" and uncertain.selected_id == "clarify"
    assert uncertain.minimum_probability == 0.9 and uncertain.response is not None
    malformed = asyncio.run(run({"ready": 0.95, "clarify": 0.05}))
    assert malformed.selected_id == "clarify" and malformed.response is None


def response(choice="material_review", probabilities=None, **changes):
    return {
        "model": "jev-1.13.0",
        "answers": {
            "next_step": {
                "type": "choice",
                "choice": choice,
                "probabilities": probabilities or {"delivery_review": 0.1, "material_review": 0.9},
                "confidence": 0.81,
            }
        },
        "usage": {"input_tokens": 200, "output_tokens": 25},
        **changes,
    }


def run_with(handler, **kwargs):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await choose_next_step(
                {"material_condition": "changed"},
                OPTIONS,
                "delivery_review",
                api_key="test-only-secret",
                client=client,
                **kwargs,
            )

    return asyncio.run(run())


@pytest.mark.parametrize("gateway", ["typesafe", "openrouter"])
def test_official_request_filters_options_and_records_version_without_secret(gateway):
    def handler(request):
        expected = (
            "https://openrouter.ai/api/v1/systemone"
            if gateway == "openrouter"
            else "https://api.typesafe.ai/v1/systemone"
        )
        assert str(request.url) == expected
        assert request.headers["Authorization"] == "Bearer test-only-secret"
        payload = json.loads(request.content)
        assert payload["model"] == "typesafe/jev-1.13"
        assert isinstance(payload["state"], str)
        assert set(payload["questions"]["next_step"]["criteria"]) == {
            "delivery_review",
            "material_review",
        }
        body = response()
        if gateway == "openrouter":
            body.update(id="gen-dec-test", provider="TypeSafe")
            body["usage"]["cost"] = 0.000014994
        return httpx.Response(200, json=body)

    run = run_with(handler, gateway=gateway, model="typesafe/jev-1.13")
    assert run.gateway == gateway
    assert run.provider == "jev" and run.status == "selected"
    assert run.selected_id == "material_review" and run.baseline_id == "delivery_review"
    assert run.model_version == "jev-1.13.0"
    assert run.request and run.response and run.input_sha256
    assert "test-only-secret" not in run.model_dump_json()


def test_missing_key_skips_network_and_low_confidence_keeps_baseline():
    run = asyncio.run(choose_next_step({}, OPTIONS, "delivery_review"))
    assert run.provider == "deterministic" and run.selected_id == "delivery_review"
    assert "not configured" in run.reason
    low = run_with(
        lambda request: httpx.Response(
            200, json=response(probabilities={"delivery_review": 0.45, "material_review": 0.55})
        )
    )
    assert low.status == "fallback" and low.selected_id == "delivery_review"
    assert low.response and low.model_version == "jev-1.13.0"
    assert "threshold" in low.reason


@pytest.mark.parametrize(
    "body",
    [
        response(choice="operate_machine"),
        response(probabilities={"delivery_review": 0.1, "material_review": 0.8}),
        response(choice="delivery_review"),
        response(probabilities={"delivery_review": 0.1, "material_review": 0.9, "injected": 0}),
        response(probabilities={"delivery_review": -0.1, "material_review": 1.1}),
        response(answers={"wrong_question": {}}),
    ],
)
def test_malformed_or_ineligible_decisions_fail_closed(body):
    run = run_with(lambda request: httpx.Response(200, json=body))
    assert run.status == "fallback" and run.selected_id == "delivery_review"
    assert run.response is None and "validation" in run.reason


def test_timeout_http_failure_and_input_limit_preserve_baseline():
    async def slow(request):
        await asyncio.sleep(1)
        return httpx.Response(200, json=response())

    timed = run_with(slow, timeout_seconds=0.005)
    assert timed.status == "fallback" and "timed out" in timed.reason
    failed = run_with(lambda request: httpx.Response(429, text="test-only-secret"))
    assert "HTTP 429" in failed.reason
    assert "test-only-secret" not in failed.model_dump_json()
    large = asyncio.run(choose_next_step("x" * 32_001, OPTIONS, "delivery_review"))
    assert "32 KB" in large.reason and large.request is None
    assert large.input_sha256


def test_invalid_local_eligibility_and_threshold_are_rejected_before_a_request():
    with pytest.raises(ValueError, match="baseline must be eligible"):
        asyncio.run(choose_next_step({}, OPTIONS, "operate_machine"))
    with pytest.raises(ValueError, match="threshold"):
        asyncio.run(choose_next_step({}, OPTIONS, "delivery_review", min_probability=float("nan")))
    one = asyncio.run(choose_next_step({}, OPTIONS[:1], "delivery_review", api_key="unused"))
    assert "Only one eligible" in one.reason and one.response is None
