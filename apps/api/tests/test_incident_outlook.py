import base64
import hashlib
import json
import time
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from flowpilot.incidents import outlook
from flowpilot.incidents.models import EditHandoffAction
from flowpilot.incidents.replay import replay_request
from flowpilot.incidents.service import act, create_incident
from flowpilot.main import create_app
from flowpilot.settings import ROOT

TOKEN = "outlook-test-editor-token-123456789012345"
OTHER = "outlook-test-other-token-1234567890123456"
VIEWER = "outlook-test-viewer-token-123456789012345"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'outlook.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "configured")
    monkeypatch.setenv("FLOWPILOT_REASONING_ENABLED", "false")
    monkeypatch.setenv("FLOWPILOT_OUTLOOK_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("FLOWPILOT_OUTLOOK_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("FLOWPILOT_OUTLOOK_TENANT", "common")
    monkeypatch.setenv(
        "FLOWPILOT_OUTLOOK_REDIRECT_URI", "http://localhost:5173/api/incident-outlook/callback"
    )
    monkeypatch.setenv("FLOWPILOT_INCIDENT_EXTERNAL_DATA_POLICY", "synthetic_only")
    monkeypatch.setenv(
        "FLOWPILOT_INCIDENT_PRINCIPALS",
        json.dumps(
            [
                {
                    "subject": token,
                    "token_sha256": hashlib.sha256(token.encode()).hexdigest(),
                    "permissions": ["view", "edit"] if token != VIEWER else ["view"],
                }
                for token in [TOKEN, OTHER, VIEWER]
            ]
        ),
    )
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    outlook.sessions.clear()
    with TestClient(create_app(), base_url="http://localhost") as client:
        yield client
    outlook.sessions.clear()


@pytest.fixture
def microsoft(monkeypatch):
    calls = []
    state = {"mode": "ok", "calls": calls}

    def request(method, url, **kwargs):
        calls.append((method, url, kwargs))
        assert kwargs["timeout"] == 15
        if url.endswith("/token"):
            return httpx.Response(
                200, json={"access_token": "private-test-token", "expires_in": 3600}
            )
        assert kwargs["headers"]["Authorization"] == "Bearer private-test-token"
        if "/me?" in url:
            return httpx.Response(200, json={"mail": "owner@example.test"})
        assert method == "POST" and url == f"{outlook.GRAPH}/me/messages"
        if state["mode"] == "timeout":
            raise httpx.ReadTimeout("test timeout")
        if state["mode"] == "denied":
            return httpx.Response(403, json={"error": {"message": "private upstream detail"}})
        if state["mode"] == "expired":
            return httpx.Response(401)
        if state["mode"] == "server_error":
            return httpx.Response(503)
        if state["mode"] == "bad_link":
            link = "https://attacker.example/draft"
        else:
            link = "https://outlook.office.com/mail/drafts/id/test-draft"
        return httpx.Response(201, json={"id": "test-draft", "isDraft": True, "webLink": link})

    monkeypatch.setattr(outlook.httpx, "request", request)
    return state


def start_connect(client):
    response = client.post("/api/incident-outlook/connect", headers=HEADERS)
    assert response.status_code == 200
    return parse_qs(urlsplit(response.json()["authorization_url"]).query)


def connect(client):
    query = start_connect(client)
    response = client.get(
        "/api/incident-outlook/callback", params={"state": query["state"][0], "code": "test-code"}
    )
    assert response.status_code == 200
    return query


def draft_request(client):
    incident = create_incident(replay_request("outlook-test"))
    body = {"incident_revision": incident.revision, "draft_version": incident.handoff.version}
    return incident, f"/api/incident-outlook/drafts/{incident.id}", body


def test_sign_in_uses_pkce_cookie_and_callback_without_bearer_auth(client, microsoft):
    query = start_connect(client)
    assert "Mail.Send" not in query["scope"][0]
    assert "Mail.ReadWrite" in query["scope"][0]
    assert query["code_challenge_method"] == ["S256"]
    session = outlook.sessions[client.cookies[outlook.COOKIE]]
    expected = base64.urlsafe_b64encode(hashlib.sha256(session.verifier.encode()).digest())
    assert query["code_challenge"] == [expected.decode().rstrip("=")]
    assert (
        client.get("/api/incident-outlook/callback", params={"state": "wrong"}).status_code == 400
    )
    with TestClient(create_app(), base_url="http://localhost") as stranger:
        assert (
            stranger.get(
                "/api/incident-outlook/callback",
                params={"state": query["state"][0], "code": "stolen"},
            ).status_code
            == 400
        )
    assert microsoft["calls"] == []
    callback = client.get(
        "/api/incident-outlook/callback", params={"state": query["state"][0], "code": "test-code"}
    )
    assert callback.status_code == 200
    assert callback.headers["cache-control"] == "no-store"
    assert "private-test-token" not in callback.text
    assert (
        client.get(
            "/api/incident-outlook/callback",
            params={"state": query["state"][0], "code": "test-code"},
        ).status_code
        == 400
    )
    status = client.get("/api/incident-outlook", headers=HEADERS)
    assert status.json() == {"configured": True, "connected": True, "email": "owner@example.test"}
    assert "private-test-token" not in status.text


def test_saved_draft_uses_current_message_and_repeat_click_does_not_duplicate(client, microsoft):
    connect(client)
    incident, path, body = draft_request(client)
    body["recipients"] = ["engineer@EXAMPLE.test"]
    first = client.post(path, json=body, headers=HEADERS)
    assert first.status_code == 200
    assert first.json()["web_link"].startswith("https://outlook.office.com/")
    assert client.post(path, json=body, headers=HEADERS).json() == first.json()
    graph_calls = [call for call in microsoft["calls"] if call[1].endswith("/messages")]
    assert len(graph_calls) == 1
    assert graph_calls[0][2]["json"] == {
        "subject": incident.handoff.subject,
        "body": {"contentType": "Text", "content": incident.handoff.body},
        "toRecipients": [{"emailAddress": {"address": "engineer@example.test"}}],
    }
    updated = act(
        incident.id,
        EditHandoffAction(action="edit_handoff", revision=incident.revision, body="Reviewed edit"),
    )
    assert client.post(path, json=body, headers=HEADERS).status_code == 409
    result = client.post(
        path,
        json={"incident_revision": updated.revision, "draft_version": updated.handoff.version},
        headers=HEADERS,
    )
    assert result.status_code == 200
    assert microsoft["calls"][-1][2]["json"]["body"]["content"] == "Reviewed edit"
    assert microsoft["calls"][-1][2]["json"]["toRecipients"] == []


def test_mailbox_session_is_scoped_to_identity_and_browser(client, microsoft):
    connect(client)
    _, path, body = draft_request(client)
    assert client.post(path, json=body).status_code == 401
    assert (
        client.post(path, json=body, headers={"Authorization": f"Bearer {VIEWER}"}).status_code
        == 403
    )
    assert (
        client.post(path, json=body, headers={"Authorization": f"Bearer {OTHER}"}).status_code
        == 401
    )
    with TestClient(create_app(), base_url="http://localhost") as stranger:
        assert stranger.post(path, json=body, headers=HEADERS).status_code == 401
    assert client.post("/api/incident-outlook/disconnect", headers=HEADERS).status_code == 200
    assert client.post(path, json=body, headers=HEADERS).status_code == 401


@pytest.mark.parametrize("mode", ["timeout", "server_error", "bad_link"])
def test_uncertain_creation_cannot_be_blindly_retried(client, microsoft, mode):
    connect(client)
    _, path, body = draft_request(client)
    microsoft["mode"] = mode
    assert client.post(path, json=body, headers=HEADERS).status_code == 502
    assert client.post(path, json=body, headers=HEADERS).status_code == 409
    assert len([call for call in microsoft["calls"] if call[1].endswith("/messages")]) == 1


def test_rejected_draft_can_be_retried_but_expired_token_requires_connection(client, microsoft):
    connect(client)
    _, path, body = draft_request(client)
    microsoft["mode"] = "denied"
    result = client.post(path, json=body, headers=HEADERS)
    assert result.status_code == 502 and "private upstream detail" not in result.text
    microsoft["mode"] = "ok"
    assert client.post(path, json=body, headers=HEADERS).status_code == 200
    body["recipients"] = ["different@example.test"]
    microsoft["mode"] = "expired"
    assert client.post(path, json=body, headers=HEADERS).status_code == 502
    assert not client.get("/api/incident-outlook", headers=HEADERS).json()["connected"]
    assert client.post(path, json=body, headers=HEADERS).status_code == 401


def test_validation_policy_and_expiry_prevent_external_requests(client, microsoft, monkeypatch):
    connect(client)
    incident, path, body = draft_request(client)
    count = len(microsoft["calls"])
    for addresses in [["bad"], ["one@example.test", "one@example.test"], ["bad\r\n@example.test"]]:
        assert (
            client.post(path, json={**body, "recipients": addresses}, headers=HEADERS).status_code
            == 422
        )
    assert (
        client.post(path, json={**body, "incident_revision": 999}, headers=HEADERS).status_code
        == 409
    )
    monkeypatch.setenv("FLOWPILOT_INCIDENT_EXTERNAL_DATA_POLICY", "disabled")
    assert client.post(path, json=body, headers=HEADERS).status_code == 403
    monkeypatch.setenv("FLOWPILOT_INCIDENT_EXTERNAL_DATA_POLICY", "synthetic_only")
    incident.evidence[0].synthetic = False
    monkeypatch.setattr(outlook, "load_incident", lambda db, id: incident)
    assert client.post(path, json=body, headers=HEADERS).status_code == 403
    assert len(microsoft["calls"]) == count
    session = outlook.sessions[client.cookies[outlook.COOKIE]]
    session.expires_at = time.time() - 1
    assert not client.get("/api/incident-outlook", headers=HEADERS).json()["connected"]
    assert client.post(path, json=body, headers=HEADERS).status_code == 401


def test_unconfigured_connector_and_view_only_connect_are_rejected(client, monkeypatch):
    assert (
        client.post(
            "/api/incident-outlook/connect", headers={"Authorization": f"Bearer {VIEWER}"}
        ).status_code
        == 403
    )
    monkeypatch.setenv("FLOWPILOT_OUTLOOK_CLIENT_ID", "")
    assert not client.get("/api/incident-outlook", headers=HEADERS).json()["configured"]
    assert client.post("/api/incident-outlook/connect", headers=HEADERS).status_code == 503
