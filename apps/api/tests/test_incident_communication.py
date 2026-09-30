import hashlib
import json
import smtplib

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from flowpilot.incidents.communication import (
    CommunicationSendRequest,
    router,
    send_communication,
)
from flowpilot.incidents.models import EditHandoffAction, EscalateAction, SimpleAction
from flowpilot.incidents.replay import replay_request
from flowpilot.incidents.service import act, create_incident
from flowpilot.settings import ROOT

TOKEN = "isolated-test-communication-token-1234567890"
VIEW_TOKEN = "isolated-test-view-only-token-123456789012345"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'communications.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "configured")
    monkeypatch.setenv(
        "FLOWPILOT_INCIDENT_PRINCIPALS",
        json.dumps(
            [
                {
                    "subject": "test:authorized-sender",
                    "token_sha256": hashlib.sha256(TOKEN.encode()).hexdigest(),
                    "permissions": ["view", "edit", "send_email"],
                },
                {
                    "subject": "test:viewer",
                    "token_sha256": hashlib.sha256(VIEW_TOKEN.encode()).hexdigest(),
                    "permissions": ["view"],
                },
            ]
        ),
    )
    monkeypatch.setenv("FLOWPILOT_INCIDENT_EMAIL_RECIPIENTS", '["engineer@example.test"]')
    monkeypatch.setenv("FLOWPILOT_INCIDENT_SMTP_HOST", "smtp.example.test")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_SMTP_FROM", "flowpilot@example.test")
    monkeypatch.setenv("FLOWPILOT_INCIDENT_SMTP_STARTTLS", "true")
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def smtp(monkeypatch):
    state = {"mode": "accepted", "connections": 0, "data_calls": 0, "tls": 0}

    class FakeSMTP:
        def __init__(self, host, port, timeout, **kwargs):
            state["connections"] += 1
            assert host == "smtp.example.test"
            assert timeout <= 10
            if state["mode"] == "connect_failure":
                raise OSError("Test connection failure; no network used")

        def ehlo(self):
            return 250, b"fake hello"

        def starttls(self, context):
            assert context.check_hostname
            state["tls"] += 1

        def login(self, username, password):
            return 235, b"fake auth"

        def mail(self, sender):
            return 250, b"sender accepted"

        def rcpt(self, recipient):
            assert recipient == "engineer@example.test"
            return (550, b"rejected") if state["mode"] == "recipient_failure" else (250, b"ok")

        def data(self, payload):
            state["data_calls"] += 1
            state["payload"] = payload
            if callback := state.get("during_data"):
                callback()
            if state["mode"] == "ambiguous":
                raise smtplib.SMTPServerDisconnected("Connection lost after data")
            if state["mode"] == "data_rejected":
                raise smtplib.SMTPDataError(550, b"explicit test rejection")
            return 250, b"accepted into fake queue"

        def close(self):
            pass

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
    return state


def incident():
    return create_incident(replay_request("communication-test-001"))


def test_mock_handoff_states_never_call_mail_transport(client, smtp):
    current = incident()
    base = f"/api/incidents/{current.id}/communications"
    request = {"incident_revision": current.revision, "draft_version": current.handoff.version}
    response = client.post(base + "/mock", json=request, headers=HEADERS)
    assert response.status_code == 200, response.text
    message = response.json()
    assert message["transport"] == "mock" and message["status"] == "approved"
    assert client.post(base + "/mock", json=request, headers=HEADERS).json() == message
    assert (
        client.post(
            base + f"/{message['id']}/send", json={"revision": 1}, headers=HEADERS
        ).status_code
        == 403
    )
    for status in ["failed", "accepted", "delivered", "acknowledged"]:
        response = client.post(
            base + f"/{message['id']}/mock-event",
            json={
                "revision": message["revision"],
                "status": status,
            },
            headers=HEADERS,
        )
        assert response.status_code == 200, response.text
        message = response.json()
        assert message["status"] == status and message["transport"] == "mock"
    assert len(message["attempts"]) == 2 and len(message["receipts"]) == 2
    assert smtp["connections"] == 0
    assert (
        client.post(
            base + f"/{message['id']}/mock-event",
            json={"revision": message["revision"], "status": "accepted"},
            headers=HEADERS,
        ).status_code
        == 422
    )
    real = approve(client, current)
    assert (
        client.post(
            base + f"/{real['id']}/mock-event",
            json={"revision": real["revision"], "status": "accepted"},
            headers=HEADERS,
        ).status_code
        == 403
    )


def approve(client, current):
    response = client.post(
        f"/api/incidents/{current.id}/communications/approvals",
        json={
            "incident_revision": current.revision,
            "draft_version": current.handoff.version,
            "recipients": ["engineer@example.test"],
        },
        headers=HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()


def send(client, current, communication):
    response = client.post(
        f"/api/incidents/{current.id}/communications/{communication['id']}/send",
        json={"revision": communication["revision"]},
        headers=HEADERS,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_approval_is_immutable_idempotent_and_never_sends(client, smtp):
    current = incident()
    communication = approve(client, current)
    assert approve(client, current) == communication
    assert communication["subject"] == current.handoff.subject
    assert communication["body"] == current.handoff.body
    assert communication["approved_by"] == "test:authorized-sender"
    assert communication["status"] == "approved" and communication["attempts"] == []
    assert smtp["connections"] == 0
    listing = client.get(f"/api/incidents/{current.id}/communications", headers=HEADERS)
    assert listing.json() == [communication]


def test_send_claim_is_durable_and_accepted_is_not_delivered(client, smtp):
    current = incident()
    communication = approve(client, current)

    def concurrent_send():
        result = send_communication(
            current.id,
            communication["id"],
            CommunicationSendRequest(revision=1),
            "test:second-sender",
        )
        assert result.status == "sending"

    smtp["during_data"] = concurrent_send
    accepted = send(client, current, communication)
    assert accepted["status"] == "accepted"
    assert accepted["receipts"] == []
    assert accepted["attempts"][0]["retryable"] is False
    assert "Delivery remains unverified" in accepted["attempts"][0]["detail"]
    assert smtp["connections"] == 1 and smtp["data_calls"] == 1 and smtp["tls"] == 1
    assert b"Message-ID:" in smtp["payload"]
    assert send(client, current, communication) == accepted  # Repeat original HTTP request safely.
    assert smtp["data_calls"] == 1
    assert approve(client, current)["id"] == accepted["id"]


@pytest.mark.parametrize("failure", ["connect_failure", "recipient_failure", "data_rejected"])
def test_definite_rejection_can_be_explicitly_retried(client, smtp, failure):
    current = incident()
    communication = approve(client, current)
    smtp["mode"] = failure
    failed = send(client, current, communication)
    assert failed["status"] == "failed"
    assert failed["attempts"][0]["retryable"]
    assert failed["attempts"][0]["finished_at"]
    smtp["mode"] = "accepted"
    accepted = send(client, current, failed)
    assert accepted["status"] == "accepted"
    assert [item["status"] for item in accepted["attempts"]] == ["failed", "accepted"]
    assert accepted["snapshot_sha256"] == communication["snapshot_sha256"]


def test_ambiguous_post_data_failure_never_retries(client, smtp):
    current = incident()
    communication = approve(client, current)
    smtp["mode"] = "ambiguous"
    unknown = send(client, current, communication)
    assert unknown["status"] == "unknown"
    assert unknown["attempts"][0]["retryable"] is False
    assert "Do not retry" in unknown["attempts"][0]["detail"]
    smtp["mode"] = "accepted"
    assert send(client, current, unknown) == unknown
    assert smtp["connections"] == 1 and smtp["data_calls"] == 1


def test_receipts_are_attributed_and_cannot_fabricate_delivery_before_submission(client, smtp):
    current = incident()
    communication = approve(client, current)
    path = f"/api/incidents/{current.id}/communications/{communication['id']}/receipts"
    payload = {
        "revision": 1,
        "status": "delivered",
        "reference": "test:mail-service/receipt-1",
        "notes": "Delivery receipt checked in isolated test.",
    }
    assert client.post(path, json=payload, headers=HEADERS).status_code == 422
    accepted = send(client, current, communication)
    payload["revision"] = accepted["revision"]
    response = client.post(path, json=payload, headers=HEADERS)
    assert response.status_code == 200, response.text
    delivered = response.json()
    assert delivered["status"] == "delivered"
    assert delivered["receipts"][0]["actor"] == "test:authorized-sender"
    assert delivered["attempts"][0]["status"] == "accepted"
    response = client.post(
        path,
        json={
            **payload,
            "revision": delivered["revision"],
            "status": "acknowledged",
            "reference": "test:engineer-reply",
        },
        headers=HEADERS,
    )
    assert response.status_code == 200
    acknowledged = response.json()
    assert [receipt["status"] for receipt in acknowledged["receipts"]] == [
        "delivered",
        "acknowledged",
    ]
    assert (
        client.post(
            path,
            json={**payload, "revision": acknowledged["revision"], "status": "unknown"},
            headers=HEADERS,
        ).status_code
        == 422
    )
    assert send(client, current, communication)["status"] == "acknowledged"
    assert smtp["data_calls"] == 1


def test_stale_approvals_and_sends_require_current_review(client, smtp):
    current = incident()
    communication = approve(client, current)
    updated = act(
        current.id,
        EscalateAction(
            action="escalate", revision=current.revision, notes="Additional engineer context"
        ),
    )
    response = client.post(
        f"/api/incidents/{current.id}/communications/approvals",
        json={
            "incident_revision": current.revision,
            "draft_version": current.handoff.version,
            "recipients": ["engineer@example.test"],
        },
        headers=HEADERS,
    )
    assert response.status_code == 409
    response = client.post(
        f"/api/incidents/{current.id}/communications/{communication['id']}/send",
        json={"revision": communication["revision"]},
        headers=HEADERS,
    )
    assert response.status_code == 409
    assert smtp["connections"] == 0
    assert approve(client, updated)["id"] != communication["id"]


def test_preserved_human_draft_requires_review_of_new_evidence(client, smtp):
    current = incident()
    edited = act(
        current.id,
        EditHandoffAction(
            action="edit_handoff",
            revision=current.revision,
            body="Engineer-authored note retained verbatim.",
        ),
    )
    changed = act(current.id, SimpleAction(action="advance_replay", revision=edited.revision))
    assert changed.handoff.body == edited.handoff.body
    response = client.post(
        f"/api/incidents/{changed.id}/communications/approvals",
        json={
            "incident_revision": changed.revision,
            "draft_version": changed.handoff.version,
            "recipients": ["engineer@example.test"],
        },
        headers=HEADERS,
    )
    assert response.status_code == 409
    reviewed = act(
        current.id,
        EditHandoffAction(
            action="edit_handoff", revision=changed.revision, body=changed.handoff.body
        ),
    )
    assert approve(client, reviewed)["body"] == edited.handoff.body
    assert smtp["connections"] == 0


def test_allowlist_auth_and_demo_mode_prevent_unapproved_delivery(client, smtp, monkeypatch):
    current = incident()
    path = f"/api/incidents/{current.id}/communications/approvals"
    payload = {"incident_revision": 0, "draft_version": 1, "recipients": ["engineer@example.test"]}
    assert (
        client.post(path, json=payload, headers={"X-Incident-Role": "engineer"}).status_code == 401
    )
    assert (
        client.post(
            path, json=payload, headers={"Authorization": f"Bearer {VIEW_TOKEN}"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            path, json={**payload, "recipients": ["unknown@example.test"]}, headers=HEADERS
        ).status_code
        == 422
    )
    assert (
        client.post(
            path,
            json={**payload, "recipients": ["engineer@example.test\r\nBCC:a@b.test"]},
            headers=HEADERS,
        ).status_code
        == 422
    )
    communication = approve(client, current)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_EMAIL_RECIPIENTS", "[]")
    response = client.post(
        f"/api/incidents/{current.id}/communications/{communication['id']}/send",
        json={"revision": 1},
        headers=HEADERS,
    )
    assert response.status_code == 422
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "demo")
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as denied:
        send_communication(
            current.id, communication["id"], CommunicationSendRequest(revision=1), "demo:engineer"
        )
    assert denied.value.status_code == 403
    assert smtp["connections"] == 0
