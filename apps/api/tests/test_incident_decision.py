import asyncio
import json

import httpx
import pytest
from flowpilot.incidents.decision import DecisionOption, choose_next_step

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


def test_official_request_filters_options_and_records_version_without_secret():
    def handler(request):
        assert str(request.url) == "https://api.typesafe.ai/v1/systemone"
        assert request.headers["Authorization"] == "Bearer test-only-secret"
        payload = json.loads(request.content)
        assert isinstance(payload["state"], str)
        assert set(payload["questions"]["next_step"]["criteria"]) == {
            "delivery_review",
            "material_review",
        }
        return httpx.Response(200, json=response())

    run = run_with(handler)
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
