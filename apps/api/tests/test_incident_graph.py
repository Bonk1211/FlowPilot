"""Synthetic workflow checks; these are not real-machine diagnostic labels."""

import asyncio
import json
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from flowpilot.incidents import coordinator, diagnostic, graph, service
from flowpilot.incidents.models import (
    AnswerInvestigationAction,
    ConfirmInvestigationAction,
    InvestigationNode,
    RetryInvestigationAction,
    SimpleAction,
)
from flowpilot.settings import Settings
from test_incidents import act, replay
from test_incidents import client as incident_client

client = incident_client


def active(incident):
    graph = incident["investigation"]
    return next(node for node in graph["nodes"] if node["id"] == graph["active_node_id"])


def answer(client, incident, value=None, **kwargs):
    return act(
        client,
        incident,
        "answer_investigation",
        answer_id=f"ANS-{uuid4()}",
        node_id=active(incident)["id"],
        choice=value,
        **kwargs,
    )


def test_root_saved_answer_branches_selection_reload_and_correction(client):
    incident = act(client, replay(client), "analyze")
    root = active(incident)
    assert len(incident["investigation"]["nodes"]) == 1
    assert root["target_fact"] == "frequency"
    assert root["question_type"] == "when"
    legacy = {key: value for key, value in root.items() if key != "question_type"}
    assert InvestigationNode.model_validate(legacy).question_type == "when"
    assert (
        InvestigationNode.model_validate({**root, "question_type": "unclassified"}).question_type
        == "unclassified"
    )
    incident = answer(client, incident, "intermittent")
    saved = incident["investigation"]["answers"][0]
    children = [
        node for node in incident["investigation"]["nodes"] if node["parent_id"] == root["id"]
    ]
    assert 1 <= len(children) <= 3
    assert all(node["parent_answer_id"] == saved["id"] for node in children)
    assert active(incident)["target_fact"] == "pressure_trend"
    assert {node["target_fact"]: node["question_type"] for node in children} == {
        "pressure_trend": "what",
        "comparability": "verification",
        "material": "which",
    }
    assert sum(node["status"] == "active" for node in incident["investigation"]["nodes"]) == 1
    node_ids = {node["id"] for node in incident["investigation"]["nodes"]}
    incident = act(client, incident, "retry_investigation")
    assert {node["id"] for node in incident["investigation"]["nodes"]} == node_ids
    assert len(incident["investigation"]["nodes"]) == len(node_ids)
    alternative = next(node for node in children if node["status"] == "proposed")
    selected = act(client, incident, "select_investigation", node_id=alternative["id"])
    assert active(selected)["id"] == alternative["id"]
    assert len(selected["investigation"]["answers"]) == 1
    assert client.get(f"/api/incidents/{selected['id']}").json() == selected
    repeated = act(client, selected, "analyze")
    assert repeated["investigation"] == selected["investigation"]
    corrected = act(
        client,
        repeated,
        "answer_investigation",
        answer_id=f"ANS-{uuid4()}",
        node_id=root["id"],
        choice="sudden",
        supersedes_id=saved["id"],
    )
    assert active(corrected)["target_fact"] == "material_condition"
    assert corrected["investigation"]["answers"][0] == saved
    assert all(
        node["status"] == "superseded"
        for node in corrected["investigation"]["nodes"]
        if node["id"] in {child["id"] for child in children}
    )
    observations = service.active_observations(service.get_incident(corrected["id"]))
    assert [item.result for item in observations] == ["sudden"]


def test_replaced_evidence_supersedes_dependent_answers_and_retains_originals(client):
    incident = answer(client, act(client, replay(client), "analyze"), "intermittent")
    original_answers = incident["investigation"]["answers"]
    original_nodes = incident["investigation"]["nodes"]
    incident = act(
        client,
        incident,
        "correct_evidence",
        evidence_id="image-good",
        reason="Correct the original image association.",
        replacement={
            "id": "image-good-v2",
            "kind": "image",
            "role": "last_good",
            "label": "Corrected reference image",
            "source_ref": "replay:corrected-image",
            "synthetic": True,
            "values": {"coverage": "uniform"},
        },
    )
    assert incident["investigation"]["answers"] == original_answers
    assert all(node["status"] == "superseded" for node in incident["investigation"]["nodes"])
    incident = act(client, incident, "analyze")
    assert active(incident)["target_fact"] == "frequency"
    saved = service.get_incident(incident["id"])
    assert graph.current_answers(saved) == []
    assert service.active_observations(saved) == []
    assert all(
        node["status"] == "superseded"
        for node in incident["investigation"]["nodes"]
        if node["id"] in {original["id"] for original in original_nodes}
    )


def test_raw_text_stays_saved_without_invented_observations(client):
    incident = act(client, replay(client), "analyze")
    incident = answer(client, incident, text="It seems odd, maybe sometimes")
    assert incident["observations"] == []
    original = incident["investigation"]["answers"][0]
    assert original["text"] == "It seems odd, maybe sometimes"
    assert original["status"] == "clarification"
    assert active(incident)["clarification_for"] == original["id"]
    incident = answer(client, incident, "unknown")
    assert incident["observations"][-1]["result"] == "unknown"
    assert active(incident)["target_fact"] != "frequency"


def test_answer_is_durable_before_analysis_and_duplicate_submission_is_idempotent(
    client, monkeypatch
):
    incident = act(client, replay(client), "analyze")
    node = active(incident)
    original_assess = service.assess

    def analyze(saved):
        durable = service.get_incident(saved.id)
        assert durable.investigation.answers[-1].choice == "continuous"
        original_assess(saved)

    monkeypatch.setattr(service, "assess", analyze)
    action = {
        "action": "answer_investigation",
        "revision": incident["revision"],
        "answer_id": f"ANS-{uuid4()}",
        "node_id": node["id"],
        "choice": "continuous",
    }
    url = f"/api/incidents/{incident['id']}/actions"
    response = client.post(url, json=action)
    assert response.status_code == 200, response.text
    assert client.post(url, json=action).json() == response.json()
    assert client.post(url, json={**action, "choice": "sudden"}).status_code == 409


def test_late_expansion_cannot_override_a_corrected_answer(client):
    incident = act(client, replay(client), "analyze")
    saved = service.act(
        incident["id"],
        AnswerInvestigationAction(
            action="answer_investigation",
            revision=incident["revision"],
            answer_id=f"ANS-{uuid4()}",
            node_id=active(incident)["id"],
            choice="intermittent",
        ),
    )
    coordinator.schedule_incident(saved)

    def concurrent(work):
        service.assess(work)
        current = service.get_incident(work.id)
        service.act(
            work.id,
            AnswerInvestigationAction(
                action="answer_investigation",
                revision=current.revision,
                answer_id=f"ANS-{uuid4()}",
                node_id=saved.investigation.answers[-1].node_id,
                choice="sudden",
                supersedes_id=saved.investigation.answers[-1].id,
            ),
        )

    assert coordinator.process_next_job("analysis", concurrent).state == "superseded"
    current = service.get_incident(saved.id)
    assert len(current.investigation.nodes) == 1
    current = service.act(current.id, SimpleAction(action="analyze", revision=current.revision))
    assert active(current.model_dump(mode="json"))["target_fact"] == "material_condition"


def assess_locally(incident):
    incident.assessment = diagnostic.analyze(
        [item.model_dump(mode="json") for item in service.active_evidence(incident)],
        [item.model_dump(mode="json") for item in service.active_observations(incident)],
        incident.configuration,
    )


def test_provider_handoff_requires_confirmation_and_uses_filtered_candidates(client):
    incident = act(client, replay(client), "analyze")
    saved = service.act(
        incident["id"],
        AnswerInvestigationAction(
            action="answer_investigation",
            revision=incident["revision"],
            answer_id=f"ANS-{uuid4()}",
            node_id=active(incident)["id"],
            text="The pattern is intermittent",
        ),
    )
    calls = []

    async def generate(payload, schema):
        calls.append(schema.__name__)
        if schema.__name__ == "AnswerInterpretation":
            return {
                "target_fact": "frequency",
                "value": "intermittent",
                "supporting_spans": ["intermittent"],
                "ambiguities": [],
            }
        candidate = payload["fact_definitions"]["timing"]
        candidate.update(
            id="new_question",
            evidence_ids=["image-good"],
            prompt="Do the existing records align the pressure change with affected samples?",
        )
        return {"candidates": [candidate], "preferred_id": "new_question"}

    tasks = []

    def decision(request):
        data = json.loads(request.content)
        task = next(iter(data["questions"]))
        tasks.append(task)
        options = data["questions"][task]["criteria"]
        selected = {
            "answer_readiness": "ready",
            "next_step": "generated_timing",
            "question_type": "when",
        }[task]
        assert selected in options
        return httpx.Response(
            200,
            json={
                "model": "jev-test",
                "usage": {"input_tokens": 1, "output_tokens": 1},
                "answers": {
                    task: {
                        "type": "choice",
                        "choice": selected,
                        "confidence": 0.1,
                        "probabilities": {key: 1.0 if key == selected else 0.0 for key in options},
                    }
                },
            },
        )

    settings = Settings(
        reasoning_enabled=True,
        incident_jev_enabled=True,
        jev_gateway="typesafe",
        jev_api_key="test-key",
    )
    assess_locally(saved)
    asyncio.run(
        graph.advance(
            saved,
            coordinator.input_fingerprint(saved),
            Settings(reasoning_enabled=False, incident_jev_enabled=False),
        )
    )
    clarification_id = saved.investigation.active_node_id
    service.apply_action(
        saved,
        RetryInvestigationAction(action="retry_investigation", revision=saved.revision),
    )

    async def advance(selector=None):
        assess_locally(saved)
        async with httpx.AsyncClient(transport=httpx.MockTransport(decision)) as http:
            await graph.advance(
                saved,
                coordinator.input_fingerprint(saved),
                settings,
                generate,
                http,
                selector=selector,
            )

    asyncio.run(advance())
    raw = saved.investigation.answers[-1]
    assert raw.status == "pending" and raw.proposed.value == "intermittent"
    assert saved.observations == [] and saved.investigation.active_node_id is None
    assert (
        next(node for node in saved.investigation.nodes if node.id == clarification_id).status
        == "superseded"
    )
    assert tasks == ["answer_readiness"] and calls == ["AnswerInterpretation"]
    asyncio.run(advance())  # Reload / unchanged input never repeats provider work.
    assert calls == ["AnswerInterpretation"]
    service.apply_action(
        saved,
        ConfirmInvestigationAction(
            action="confirm_investigation",
            revision=saved.revision,
            answer_id=raw.id,
            value="intermittent",
        ),
    )
    assert saved.observations[-1].result == "intermittent"
    gemini_only = saved.model_copy(deep=True)
    asyncio.run(advance())
    assert calls == ["AnswerInterpretation", "AdaptiveQuestions"]
    assert tasks == ["answer_readiness", "next_step", "question_type"]
    assert active(saved.model_dump(mode="json"))["target_fact"] == "timing"
    classified = active(saved.model_dump(mode="json"))
    assert classified["question_type"] == "when"
    assert classified["classification"]["task"] == "question_type"
    assert classified["classification"]["provider"] == "jev"
    assert InvestigationNode.model_validate(classified).model_dump(mode="json") == classified
    asyncio.run(advance())
    assert tasks == ["answer_readiness", "next_step", "question_type"]
    assert (
        saved.investigation.expansions[-1].decision.response.answers["next_step"].confidence == 0.1
    )
    assert saved.investigation.expansions[-1].generation.thinking == "medium"
    saved = gemini_only
    tasks.clear()
    asyncio.run(advance("gemini"))
    assert tasks == []
    assert active(saved.model_dump(mode="json"))["classification"]["provider"] == "deterministic"


@pytest.mark.parametrize("invalid", ["physical", "citation", "known", "prerequisite", "meaning"])
def test_generated_candidates_are_filtered_before_selection(client, invalid):
    saved = service.get_incident(act(client, replay(client), "analyze")["id"])
    assess_locally(saved)

    async def generate(payload, schema):
        candidate = payload["fact_definitions"]["timing"]
        candidate["evidence_ids"] = ["image-good"]
        if invalid == "physical":
            candidate["prompt"] = "Adjust pressure to 3 bar and compare existing logs?"
        elif invalid == "citation":
            candidate["source_refs"] = ["invented-manual"]
        elif invalid == "known":
            candidate["target_fact"] = "coverage"
        elif invalid == "prerequisite":
            candidate["prerequisites"] = ["invented_measurement"]
        else:
            candidate["choices"][0]["value"] = "confirmed_root_cause"
        return {"candidates": [candidate], "preferred_id": candidate["id"]}

    candidates, preferred, run = asyncio.run(
        diagnostic.generate_questions(
            saved,
            graph.baseline_candidates(saved)[0],
            coordinator.input_fingerprint(saved),
            generate,
            Settings(reasoning_enabled=True),
        )
    )
    assert candidates == [] and preferred is None
    assert run.status == "fallback" and run.rejected_count == 1


def test_structured_answers_skip_interpretation_and_shared_rules_consume_confirmed_fact(client):
    incident = act(client, replay(client), "analyze")
    incident = answer(client, incident, "intermittent")
    incident = answer(client, incident, "unstable")
    assert all(
        item["interpretation_run"] is None and item["readiness"] is None
        for item in incident["investigation"]["answers"]
    )
    assert incident["assessment"]["hypotheses"][0]["id"] == "unstable_delivery"
    assert any(
        item["evidence_id"] == incident["observations"][-1]["id"]
        for item in incident["assessment"]["hypotheses"][0]["supporting_evidence"]
    )


@pytest.mark.parametrize("selector", ["auto", "gemini", "baseline"])
def test_gemini_preference_reaches_active_question_with_correct_provenance(client, selector):
    incident = act(client, replay(client), "analyze")
    saved = service.get_incident(incident["id"])
    service.apply_action(
        saved,
        AnswerInvestigationAction(
            action="answer_investigation",
            revision=saved.revision,
            answer_id=f"ANS-{uuid4()}",
            node_id=active(incident)["id"],
            choice="intermittent",
        ),
    )
    assess_locally(saved)

    async def generate(payload, schema):
        pressure = payload["fact_definitions"]["pressure_trend"]
        pressure.update(
            id="context_pressure",
            evidence_ids=["image-good"],
            prompt="Do archived pressure records show stability or variability?",
        )
        timing = payload["fact_definitions"]["timing"]
        timing.update(
            id="context_timing",
            evidence_ids=["image-good"],
            prompt="Do existing logs align delivery changes with the affected trays?",
        )
        return {"candidates": [pressure, timing], "preferred_id": timing["id"]}

    asyncio.run(
        graph.advance(
            saved,
            coordinator.input_fingerprint(saved),
            Settings(
                _env_file=None,
                reasoning_enabled=True,
                incident_jev_enabled=False,
                incident_question_selector=selector,
            ),
            generate,
        )
    )
    chosen = active(saved.model_dump(mode="json"))
    run = saved.investigation.expansions[-1].decision
    if selector == "baseline":
        assert chosen["target_fact"] == "pressure_trend"
        assert chosen["prompt"] == "Do archived pressure records show stability or variability?"
        assert run.provider == "deterministic"
    else:
        assert chosen["target_fact"] == "timing"
        assert run.provider == "gemini" and run.gateway == "gemini"
        assert run.adapter_version == "s932-gemini-questions-2"
        assert run.response is None and run.request is None
        assert run.selected_id == "generated_timing"
    assert saved.investigation.expansions[-1].generation.model == "gemini-3.8-flash"


def test_question_provider_receives_supported_schema_and_dedicated_model(client, monkeypatch):
    from google import genai

    saved = service.get_incident(act(client, replay(client), "analyze")["id"])
    assess_locally(saved)
    candidate = graph.question_for("timing", saved.assessment).model_dump(mode="json")
    candidate["evidence_ids"] = ["image-good"]

    class Provider:
        aio = property(lambda self: self)
        models = property(lambda self: self)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def generate_content(self, **request):
            assert request["model"] == "gemini-3.8-flash"
            schema = request["config"].response_json_schema
            assert "maxItems" not in schema["properties"]["candidates"]
            assert (
                "maxLength" not in schema["$defs"]["InvestigationQuestion"]["properties"]["prompt"]
            )
            assert request["config"].thinking_config.thinking_level == "MEDIUM"
            return SimpleNamespace(
                text=json.dumps({"candidates": [candidate], "preferred_id": candidate["id"]}),
                model_version="gemini-3.8-flash-test",
            )

    monkeypatch.setattr(genai, "Client", lambda **_: Provider())
    candidates, preferred, run = asyncio.run(
        diagnostic.generate_questions(
            saved,
            graph.baseline_candidates(saved)[0],
            coordinator.input_fingerprint(saved),
            settings=Settings(
                _env_file=None,
                reasoning_enabled=True,
                gemini_api_key="test-key",
                gemini_model="gemini-3.5-flash-lite",
                incident_rag_enabled=False,
            ),
        )
    )
    assert len(candidates) == 1 and preferred == "generated_timing"
    assert run.status == "validated" and run.model_version == "gemini-3.8-flash-test"


def test_rejected_preferred_question_reports_selection_fallback(client):
    saved = service.get_incident(act(client, replay(client), "analyze")["id"])
    assess_locally(saved)

    async def generate(payload, schema):
        invalid = payload["fact_definitions"]["pressure_trend"]
        invalid.update(
            prompt="Adjust pressure to 3 bar and compare existing logs?",
            evidence_ids=["image-good"],
        )
        valid = payload["fact_definitions"]["timing"]
        valid["evidence_ids"] = ["image-good"]
        return {"candidates": [invalid, valid], "preferred_id": invalid["id"]}

    candidates, preferred, run = asyncio.run(
        diagnostic.generate_questions(
            saved,
            graph.baseline_candidates(saved)[0],
            coordinator.input_fingerprint(saved),
            generate,
            Settings(_env_file=None, reasoning_enabled=True),
        )
    )
    assert len(candidates) == 1 and preferred is None
    assert run.status == "fallback" and run.rejected_count == 1
    assert "preferred question failed" in run.fallback_reason
