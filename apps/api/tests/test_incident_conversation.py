import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from flowpilot.incidents import conversation, service
from flowpilot.incidents.conversation import ConversationRequest
from flowpilot.settings import Settings
from test_incidents import act, replay
from test_incidents import client as incident_client

client = incident_client


def send(client, incident, text, **values):
    response = client.post(
        f"/api/incidents/{incident['id']}/conversation",
        json={
            "revision": incident["revision"],
            "turn_id": f"TURN-{uuid4()}",
            "text": text,
            **values,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_conversation_confirm_off_spotlight_answer_and_reload(client):
    incident = act(client, replay(client), "analyze")
    root = incident["investigation"]["active_node_id"]
    pending = send(client, incident, "It is intermittent", input_mode="voice")
    assert pending["investigation"] == incident["investigation"]
    assert pending["conversation"][-1]["status"] == "pending"
    recorded = send(client, pending, "confirm", input_mode="voice")
    assert recorded["investigation"]["answers"][0]["confirmed_value"] == "intermittent"
    alternative = next(
        node for node in recorded["investigation"]["nodes"] if node["target_fact"] == "material"
    )
    proposed = send(client, recorded, "material flux", spotlight_node_id=root)
    assert proposed["conversation"][-1]["node_ids"] == [alternative["id"]]
    confirmed = send(client, proposed, "yes that's right")
    assert confirmed["investigation"]["answers"][-1]["node_id"] == alternative["id"]
    assert confirmed["investigation"]["answers"][-1]["confirmed_value"] == "flux"
    assert confirmed["conversation"][0]["text"] == "It is intermittent"
    assert client.get(f"/api/incidents/{incident['id']}").json() == confirmed
    report = client.get(f"/api/incidents/{incident['id']}/report.md").text
    assert "## Investigation conversation" in report
    assert "It is intermittent" in report


def test_ambiguity_cancel_idempotency_and_stale_confirmation(client):
    incident = act(client, replay(client), "analyze")
    uncertain = send(client, incident, "Maybe intermittent, or perhaps progressive")
    assert uncertain["conversation"][-1]["status"] == "clarification"
    assert not uncertain["investigation"]["answers"]
    pending = send(client, uncertain, "intermittent")
    cancelled = send(client, pending, "cancel")
    assert cancelled["conversation"][-1]["status"] == "cancelled"
    pending = send(client, cancelled, "sudden")
    changed = act(
        client,
        pending,
        "answer_investigation",
        answer_id=f"ANS-{uuid4()}",
        node_id=pending["investigation"]["active_node_id"],
        choice="intermittent",
    )
    stale = send(client, changed, "confirm")
    assert stale["conversation"][-1]["status"] == "clarification"
    assert "changed" in stale["conversation"][-1]["reply"]
    turn = stale["conversation"][-1]
    repeated = client.post(
        f"/api/incidents/{incident['id']}/conversation",
        json={
            "revision": 0,
            "turn_id": turn["id"],
            "text": turn["text"],
        },
    )
    assert repeated.json() == stale
    conflict = client.post(
        f"/api/incidents/{incident['id']}/conversation",
        json={
            "revision": stale["revision"],
            "turn_id": turn["id"],
            "text": "different",
        },
    )
    assert conflict.status_code == 409


def live_turn(incident, text, plan):
    async def generate(payload, schema):
        assert payload["utterance"] == text
        return plan

    return asyncio.run(
        conversation.converse(
            incident["id"],
            ConversationRequest(
                revision=incident["revision"],
                turn_id=f"TURN-{uuid4()}",
                text=text,
                input_mode="voice",
            ),
            "technician",
            Settings(reasoning_enabled=True, incident_external_data_policy="permitted"),
            generate,
        )
    ).model_dump(mode="json")


def test_semantic_multi_node_confirmation_and_discussion(client):
    incident = act(client, replay(client), "analyze")
    incident = send(client, send(client, incident, "intermittent"), "confirm")
    nodes = {node["target_fact"]: node for node in incident["investigation"]["nodes"]}
    text = "The before and after settings match. We're using flux."
    mappings = [
        {
            "node_id": nodes["comparability"]["id"],
            "choice": "comparable",
            "supporting_span": "The before and after settings match.",
        },
        {
            "node_id": nodes["material"]["id"],
            "choice": "flux",
            "supporting_span": "We're using flux.",
        },
    ]
    pending = live_turn(
        incident, text, {"intent": "answer", "reply": "Understood", "mappings": mappings}
    )
    assert pending["conversation"][-1]["status"] == "pending"
    confirmed = send(client, pending, "confirm", input_mode="voice")
    assert [answer["confirmed_value"] for answer in confirmed["investigation"]["answers"]][-2:] == [
        "comparable",
        "flux",
    ]
    discussed = live_turn(
        confirmed,
        "Could this be a restriction?",
        {
            "intent": "discuss",
            "reply": "A restriction remains possible; compare its existing evidence.",
        },
    )
    assert discussed["conversation"][-1]["status"] == "discussed"
    assert discussed["investigation"] == confirmed["investigation"]


@pytest.mark.parametrize("invalid", ["bad_id", "bad_choice", "invented_span", "uncertain"])
def test_invalid_semantic_mappings_never_record_facts(client, invalid):
    incident = act(client, replay(client, invalid), "analyze")
    mapping = {
        "node_id": incident["investigation"]["active_node_id"],
        "choice": "intermittent",
        "supporting_span": "comes and goes",
    }
    if invalid == "bad_id":
        mapping["node_id"] = "invented"
    elif invalid == "bad_choice":
        mapping["choice"] = "measurement_invented"
    elif invalid == "invented_span":
        mapping["supporting_span"] = "not in the transcript"
    result = live_turn(
        incident,
        "It comes and goes",
        {
            "intent": "answer",
            "reply": "Understood",
            "mappings": [mapping],
            "ambiguities": ["uncertain"] if invalid == "uncertain" else [],
        },
    )
    assert result["conversation"][-1]["status"] == "clarification"
    assert result["investigation"] == incident["investigation"]


def test_voice_token_auth_policy_provider_errors_and_secret_boundary(client, monkeypatch):
    incident = act(client, replay(client), "analyze")
    settings = Settings(
        elevenlabs_api_key="server-secret",
        incident_voice_enabled=True,
        incident_external_data_policy="permitted",
    )

    def provider(request):
        assert request.headers["xi-api-key"] == "server-secret"
        assert request.url.path == "/v1/single-use-token/realtime_scribe"
        return httpx.Response(200, json={"token": "short-lived-token"})

    token = asyncio.run(
        conversation.voice_token(
            incident["id"],
            settings,
            httpx.MockTransport(provider),
        )
    )
    assert token.model_dump() == {"token": "short-lived-token"}
    blocked = settings.model_copy(update={"incident_external_data_policy": "disabled"})
    with pytest.raises(HTTPException) as error:
        asyncio.run(conversation.voice_token(incident["id"], blocked))
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            conversation.voice_token(
                incident["id"],
                settings,
                httpx.MockTransport(lambda request: httpx.Response(401, text="server-secret")),
            )
        )
    assert error.value.status_code == 503
    assert "server-secret" not in str(error.value.detail)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "configured")
    response = client.post(f"/api/incidents/{incident['id']}/voice-token")
    assert response.status_code == 401
    response = client.post(
        f"/api/incidents/{incident['id']}/conversation",
        json={
            "revision": incident["revision"],
            "turn_id": f"TURN-{uuid4()}",
            "text": "confirm",
        },
    )
    assert response.status_code == 401


def test_voice_switch_and_provider_failure_keep_investigation_usable(client):
    incident = act(client, replay(client), "analyze")
    incident = send(client, send(client, incident, "intermittent"), "confirm")
    switched = send(client, incident, "switch to material", input_mode="voice")
    node = next(
        node
        for node in switched["investigation"]["nodes"]
        if node["id"] == switched["investigation"]["active_node_id"]
    )
    assert node["target_fact"] == "material"
    assert len(switched["investigation"]["answers"]) == 1
    assert service.get_incident(incident["id"]).conversation[-1].intent == "switch"
