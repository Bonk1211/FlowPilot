import hashlib
import json

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from flowpilot.incidents.knowledge import applicable_sources, router
from flowpilot.settings import ROOT


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'sources.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "demo")
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


def content(document="TEST-ONLY-SOURCE", revision="test-r1", authority="controlled_procedure"):
    # Isolated test data; nothing is seeded into the application or represented as a real manual.
    return {
        "document_id": document,
        "document_revision": revision,
        "title": "Synthetic registry acceptance fixture",
        "configurations": ["TEST S932 CONFIG"],
        "authority": authority,
        "original_ref": "test-fixture:controlled-source.txt",
        "original_sha256": hashlib.sha256(b"test-only original").hexdigest(),
        "passages": [{"id": "scope", "section": "1", "page": "1", "text": "Exact text.\n\n"}],
    }


def create(client, body=None):
    response = client.post("/api/incident-knowledge", json=body or content())
    assert response.status_code == 201, response.text
    return response.json()


def review(client, source, decision="publish"):
    response = client.post(
        f"/api/incident-knowledge/{source['id']}/reviews",
        json={
            "revision": source["revision"],
            "decision": decision,
            "notes": "Reviewed isolated test fixture; no actual machine procedure.",
        },
        headers={"X-Incident-Role": "engineer"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_source_revision_preserves_exact_text_and_is_immutable(client):
    source = create(client)
    assert source["content"]["passages"][0]["text"] == "Exact text.\n\n"
    assert source["status"] == "draft"
    assert source["submitted_by"] == "demo:technician"
    assert create(client) == source
    altered = content()
    altered["passages"][0]["text"] = "Changed text"
    response = client.post("/api/incident-knowledge", json=altered)
    assert response.status_code == 409
    new_revision = create(client, content(revision="test-r2"))
    assert new_revision["id"] != source["id"]
    assert client.get(f"/api/incident-knowledge/{source['id']}").json() == source
    assert len(client.get("/api/incident-knowledge").json()) == 2
    assert not applicable_sources("TEST S932 CONFIG")[0].operational_allowed


def test_publication_requires_permission_original_integrity_and_current_revision(client):
    missing_original = content()
    missing_original["original_sha256"] = None
    source = create(client, missing_original)
    payload = {"revision": source["revision"], "decision": "publish", "notes": "Review"}
    path = f"/api/incident-knowledge/{source['id']}/reviews"
    assert client.post(path, json=payload).status_code == 403
    assert (
        client.post(path, json=payload, headers={"X-Incident-Role": "engineer"}).status_code == 422
    )
    source = create(client, content(revision="test-r2"))
    published = review(client, source)
    assert published["status"] == "published"
    assert published["content_digest"] == source["content_digest"]
    assert published["reviews"][0]["actor"] == "demo:engineer"
    assert (
        client.post(
            f"/api/incident-knowledge/{source['id']}/reviews",
            json=payload,
            headers={"X-Incident-Role": "engineer"},
        ).status_code
        == 409
    )
    matches = applicable_sources(" test   s932 config ", "exact text")
    assert len(matches) == 2
    assert matches[0].operational_allowed
    assert matches[0].approval_status == "approved"
    assert not applicable_sources("OTHER CONFIG")[0].operational_allowed
    assert not applicable_sources("")[0].operational_allowed
    assert applicable_sources("TEST S932 CONFIG", "no-matching-phrase") == []


def test_reviewed_secondary_material_cannot_become_operational(client):
    for authority in ["secondary_summary", "example"]:
        body = content(document=f"TEST-{authority}", authority=authority)
        body["original_sha256"] = None
        source = review(client, create(client, body))
        assert source["status"] == "published"
    passages = applicable_sources("TEST S932 CONFIG")
    assert len(passages) == 2
    assert all(item.approval_status == "reviewed_reference" for item in passages)
    assert all(not item.operational_allowed for item in passages)
    body["authority"] = "controlled_procedure"
    assert client.post("/api/incident-knowledge", json=body).status_code == 409


def test_conflict_blocks_both_sources_and_retains_resolution_and_withdrawal_history(client):
    first = review(client, create(client))
    second = review(client, create(client, content(document="TEST-OTHER-SOURCE")))
    response = client.post(
        "/api/incident-knowledge/conflicts",
        json={
            "source_ids": [first["id"], second["id"]],
            "description": "These test passages disagree about the same condition.",
        },
    )
    assert response.status_code == 201, response.text
    conflict = response.json()
    passages = applicable_sources("TEST S932 CONFIG")
    assert all(not item.operational_allowed for item in passages)
    assert all(item.approval_status == "conflicted" for item in passages)
    assert all(item.conflict_ids == [conflict["id"]] for item in passages)
    assert (
        client.post(
            f"/api/incident-knowledge/{first['id']}/reviews",
            json={
                "revision": first["revision"],
                "decision": "publish",
                "notes": "Try ignoring conflict",
            },
            headers={"X-Incident-Role": "engineer"},
        ).status_code
        == 422
    )
    path = f"/api/incident-knowledge/conflicts/{conflict['id']}/reviews"
    payload = {"revision": 1, "decision": "resolve", "notes": "Test scope difference resolved."}
    assert client.post(path, json=payload).status_code == 403
    response = client.post(path, json=payload, headers={"X-Incident-Role": "engineer"})
    assert response.status_code == 200, response.text
    assert response.json()["reviews"][0]["actor"] == "demo:engineer"
    assert all(item.operational_allowed for item in applicable_sources("TEST S932 CONFIG"))
    assert (
        client.post(path, json=payload, headers={"X-Incident-Role": "engineer"}).status_code == 409
    )
    withdrawn = review(client, first, "withdraw")
    assert len(withdrawn["reviews"]) == 2
    assert withdrawn["content"] == first["content"]
    result = next(
        item for item in applicable_sources("TEST S932 CONFIG") if item.source_id == first["id"]
    )
    assert result.approval_status == "withdrawn"
    assert not result.operational_allowed
    response = client.post(
        path,
        json={"revision": 2, "decision": "reopen", "notes": "New conflicting context in test."},
        headers={"X-Incident-Role": "engineer"},
    )
    assert response.status_code == 200
    assert len(response.json()["reviews"]) == 2
    assert all(not item.operational_allowed for item in applicable_sources("TEST S932 CONFIG"))


def test_configured_auth_ignores_spoofed_role_and_records_authenticated_reviewer(
    client, monkeypatch
):
    token = "test-only-token-for-source-review-123456789"
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "configured")
    monkeypatch.setenv(
        "FLOWPILOT_INCIDENT_PRINCIPALS",
        json.dumps(
            [
                {
                    "subject": "test:knowledge-owner",
                    "token_sha256": hashlib.sha256(token.encode()).hexdigest(),
                    "permissions": ["view", "edit", "publish_knowledge"],
                }
            ]
        ),
    )
    assert (
        client.get("/api/incident-knowledge", headers={"X-Incident-Role": "engineer"}).status_code
        == 401
    )
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/api/incident-knowledge", json=content(), headers=headers)
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["submitted_by"] == "test:knowledge-owner"
    response = client.post(
        f"/api/incident-knowledge/{source['id']}/reviews",
        json={
            "revision": source["revision"],
            "decision": "publish",
            "notes": "Authenticated test review",
        },
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["reviews"][0]["actor"] == "test:knowledge-owner"


def test_empty_configuration_duplicate_passage_and_unknown_conflict_rejected(client):
    malformed = content()
    malformed["configurations"] = [" "]
    assert client.post("/api/incident-knowledge", json=malformed).status_code == 422
    malformed = content()
    malformed["passages"] *= 2
    assert client.post("/api/incident-knowledge", json=malformed).status_code == 422
    source = create(client)
    assert (
        client.post(
            "/api/incident-knowledge/conflicts",
            json={
                "source_ids": [source["id"], "missing"],
                "description": "No missing source allowed",
            },
        ).status_code
        == 404
    )
    assert client.get("/api/incident-knowledge/conflicts").json() == []
