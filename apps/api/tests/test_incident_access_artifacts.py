import asyncio
import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from flowpilot.incidents import diagnostic, service
from flowpilot.incidents.artifacts import ArtifactRecord
from flowpilot.incidents.service import database_operation
from flowpilot.main import create_app
from flowpilot.settings import ROOT, Settings


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'access.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    with TestClient(create_app()) as client:
        yield client


def principal(monkeypatch, permissions, subject="test:operator"):
    token = "isolated-test-only-credential-never-use-outside-tests"
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "configured")
    monkeypatch.setenv(
        "FLOWPILOT_INCIDENT_PRINCIPALS",
        json.dumps(
            [
                {
                    "subject": subject,
                    "token_sha256": hashlib.sha256(token.encode()).hexdigest(),
                    "permissions": permissions,
                }
            ]
        ),
    )
    return {"Authorization": f"Bearer {token}"}


def test_credentials_cannot_be_replaced_by_role_and_privileges_are_separate(client, monkeypatch):
    incident = client.post("/api/incidents/replay", json={"trigger_id": "access-1"}).json()
    path = f"/api/incidents/{incident['id']}"
    headers = principal(monkeypatch, ["view", "close"])
    discovery = client.get("/api/incident-access").json()
    assert discovery == {
        "mode": "configured",
        "subject": None,
        "permissions": [],
        "authenticated": False,
    }
    assert client.get(path, headers={"X-Incident-Role": "engineer"}).status_code == 401
    assert client.get("/api/cases").status_code == 401  # Old routes cannot expose data in pilot.
    assert client.get(path, headers=headers).status_code == 200
    assert (
        client.post("/api/incidents", json={"trigger_id": "forbidden"}, headers=headers).status_code
        == 403
    )
    closed = client.post(
        path + "/actions",
        headers=headers,
        json={
            "revision": 0,
            "action": "close",
            "outcome": "inconclusive",
            "notes": "Missing context",
            "reviewer": "forged identity",
        },
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["closure"]["reviewer"] == "test:operator"
    assert closed.json()["history"][-1]["actor"] == "test:operator"
    assert (
        client.post(
            path + "/actions",
            headers=headers,
            json={
                "revision": closed.json()["revision"],
                "action": "review_learning",
                "decision": "approve",
                "notes": "No publication permission",
                "reviewer": "test:operator",
            },
        ).status_code
        == 403
    )
    assert client.get("/api/incident-access/audit", headers=headers).status_code == 403
    headers = principal(monkeypatch, ["view", "manage_data"])
    audit = client.get("/api/incident-access/audit", headers=headers)
    assert audit.status_code == 200
    assert {401, 403, 200} <= {item["status_code"] for item in audit.json()}
    assert "isolated-test-only-credential" not in audit.text
    monkeypatch.setenv("FLOWPILOT_INCIDENT_PRINCIPALS", "[]")
    assert client.get(path, headers=headers).status_code == 401


def test_raw_original_integrity_attachment_deletion_and_provenance(client, monkeypatch):
    incident = client.post("/api/incidents/replay", json={"trigger_id": "original-1"}).json()
    path = f"/api/incidents/{incident['id']}"
    raw = b'{"source_event":"synthetic example"}\n'
    sha = hashlib.sha256(raw).hexdigest()
    args = {
        "content": raw,
        "headers": {"Content-Type": "application/json", "X-Content-SHA256": sha},
    }
    upload = client.post(path + "/artifacts?filename=export.json", **args)
    assert upload.status_code == 201, upload.text
    artifact = upload.json()
    assert client.post(path + "/artifacts?filename=export.json", **args).json() == artifact
    reference = path + f"/artifacts/{artifact['id']}"
    original = client.get(reference)
    assert original.content == raw and original.headers["X-Content-SHA256"] == sha
    other = client.post("/api/incidents/replay", json={"trigger_id": "original-2"}).json()
    assert client.get(f"/api/incidents/{other['id']}/artifacts/{artifact['id']}").status_code == 404
    attached = client.post(
        path + "/actions",
        json={
            "revision": incident["revision"],
            "action": "add_evidence",
            "evidence": {
                "id": "raw-log",
                "kind": "log",
                "role": "machine_log",
                "label": "Preserved log",
                "source_ref": "export.json",
                "artifact_id": artifact["id"],
                "synthetic": True,
            },
        },
    )
    assert attached.status_code == 200, attached.text
    assert attached.json()["evidence"][-1]["raw_integrity_ref"] == sha
    assert attached.json()["evidence"][-1]["integrity_ref"] != sha
    assert client.request("DELETE", reference, json={"reason": "test cleanup"}).status_code == 403
    headers = principal(monkeypatch, ["view", "manage_data"])
    removed = client.request(
        "DELETE", reference, json={"reason": "Owner requested deletion"}, headers=headers
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["status"] == "deleted"
    assert client.get(reference, headers=headers).status_code == 410
    saved = client.get(path, headers=headers).json()
    assert saved["evidence"][-1]["supersedes_id"] == "raw-log"
    assert saved["evidence"][-1]["status"] == "unavailable"
    assert saved["evidence"][-1]["raw_integrity_ref"] == sha
    assert saved["assessment"] is None
    assert "raw byte SHA-256" in client.get(path + "/report.md", headers=headers).text


def test_upload_limits_hash_mismatch_and_retention_preview(client, monkeypatch):
    incident = client.post("/api/incidents", json={"trigger_id": "bounded-file"}).json()
    path = f"/api/incidents/{incident['id']}/artifacts"
    assert (
        client.post(
            path + "?filename=file.json", content=b"example", headers={"X-Content-SHA256": "wrong"}
        ).status_code
        == 422
    )
    assert client.post(path + "?filename=../secret", content=b"example").status_code == 422
    assert (
        client.post(
            path + "?filename=bad.png",
            content=b"not an image",
            headers={"Content-Type": "image/png"},
        ).status_code
        == 422
    )
    monkeypatch.setenv("FLOWPILOT_INCIDENT_ARTIFACT_LIMIT_BYTES", "5")
    assert client.post(path + "?filename=large.bin", content=b"123456").status_code == 413
    artifact = client.post(path + "?filename=small.txt", content=b"12345").json()

    def expire(session):
        row = session.get(ArtifactRecord, artifact["id"])
        row.details = {
            **row.details,
            "expires_at": (datetime.now(UTC) - timedelta(seconds=1)).isoformat(),
        }

    database_operation(expire)
    headers = principal(monkeypatch, ["view", "manage_data"])
    assert client.get(path + "/" + artifact["id"], headers=headers).status_code == 410
    preview = client.post("/api/incident-artifacts/retention", headers=headers).json()
    assert preview == {"dry_run": True, "artifact_ids": [artifact["id"]]}
    assert (
        database_operation(lambda session: session.get(ArtifactRecord, artifact["id"]).content)
        == b"12345"
    )
    assert (
        client.post("/api/incident-artifacts/retention?dry_run=false", headers=headers).status_code
        == 200
    )
    assert (
        database_operation(lambda session: session.get(ArtifactRecord, artifact["id"]).content)
        is None
    )


def test_external_policy_blocks_real_or_unlabelled_data_even_with_model_keys():
    evidence = [{"id": "live-log", "status": "collected", "synthetic": False, "values": {}}]
    assessment = diagnostic.analyze(evidence, [], "S932")
    settings = Settings(
        _env_file=None,
        reasoning_enabled=True,
        gemini_api_key="test",
        incident_jev_enabled=True,
        jev_api_key="test",
    )

    async def forbidden(*args, **kwargs):
        raise AssertionError("Forbidden external call")

    asyncio.run(diagnostic.enrich_assessment(assessment, evidence, [], "S932", forbidden, settings))
    assert "data policy" in assessment.explanation.fallback_reason
    decision = asyncio.run(
        diagnostic.select_assessment_step(assessment, evidence, [], "S932", settings, forbidden)
    )
    assert "data policy" in decision.provider_status and decision.provider == "deterministic"
    assert diagnostic.analyze(evidence, [], "NOTS932").next_step.id == "configuration_review"


@pytest.fixture
def preserved_log(client):
    incident = client.post("/api/incidents/replay", json={"trigger_id": "linked-expiry"}).json()
    path = f"/api/incidents/{incident['id']}"
    artifact = client.post(
        path + "/artifacts?filename=synthetic-log.json",
        content=b'{"pressure_trend":"unstable","synthetic":true}',
        headers={"Content-Type": "application/json"},
    ).json()
    response = client.post(
        path + "/actions",
        json={
            "revision": incident["revision"],
            "action": "add_evidence",
            "evidence": {
                "id": "preserved-log",
                "kind": "log",
                "role": "machine_log",
                "label": "Synthetic pressure export",
                "source_ref": "synthetic-log.json",
                "artifact_id": artifact["id"],
                "synthetic": True,
                "values": {"pressure_trend": "unstable"},
            },
        },
    )
    assert response.status_code == 200, response.text
    return response.json(), artifact


def expire_original(artifact_id):
    def expire(session):
        row = session.get(ArtifactRecord, artifact_id)
        row.details = {
            **row.details,
            "expires_at": (datetime.now(UTC) - timedelta(seconds=1)).isoformat(),
        }

    database_operation(expire)


def test_expired_linked_original_blocks_approvals_and_withdraws_dependent_conclusions(
    client, preserved_log
):
    incident, artifact = preserved_log
    path = f"/api/incidents/{incident['id']}"

    def act(action, **values):
        nonlocal incident
        response = client.post(
            path + "/actions",
            headers={"X-Incident-Role": "engineer"},
            json={"action": action, "revision": incident["revision"], **values},
        )
        assert response.status_code == 200, response.text
        incident = response.json()

    act("analyze")
    act(
        "record_result",
        check_id="delivery_review",
        result="supported",
        evidence_ids=["preserved-log"],
    )
    act(
        "close",
        outcome="supported",
        conclusion="Synthetic delivery hypothesis supported in replay.",
        notes="This is a simulated result only.",
        reviewer="demo:engineer",
    )
    act("review_learning", reviewer="demo:engineer", decision="approve", notes="Replay only.")
    approved = client.post(
        path + "/communications/mock",
        json={
            "incident_revision": incident["revision"],
            "draft_version": incident["handoff"]["version"],
        },
    ).json()
    expire_original(artifact["id"])
    assert client.get(path + f"/artifacts/{artifact['id']}").status_code == 410
    # A failed approval transaction may roll back reconciliation; every retry must still block.
    for _ in range(2):
        assert (
            client.post(
                path + "/communications/mock",
                json={
                    "incident_revision": incident["revision"],
                    "draft_version": incident["handoff"]["version"],
                },
            ).status_code
            == 409
        )
    assert (
        client.post(
            path + f"/communications/{approved['id']}/mock-event",
            json={"revision": approved["revision"], "status": "accepted"},
        ).status_code
        == 409
    )

    before = incident
    incident = next(
        item for item in client.get("/api/incidents").json() if item["id"] == before["id"]
    )
    assert incident["assessment"] is None and incident["closure"] is None
    assert incident["closure_history"][-1] == before["closure"]
    assert incident["learning"]["status"] == "withdrawn"
    assert incident["assessment_history"] == before["assessment_history"]
    assert incident["observations"] == before["observations"]
    assert incident["history"][-1]["actor"] == "system:incident-retention"
    assert incident["history"][-1]["action"] == "original_unavailable"
    original = next(item for item in before["evidence"] if item["id"] == "preserved-log")
    assert original in incident["evidence"]
    assert incident["evidence"][-1]["supersedes_id"] == original["id"]
    assert incident["evidence"][-1]["status"] == "unavailable"
    assert client.get(path).json() == incident  # Reconciliation is idempotent.
    assert (
        database_operation(lambda session: session.get(ArtifactRecord, artifact["id"]).content)
        is None
    )
    act("analyze")
    assert not any(item["status"] == "supported" for item in incident["assessment"]["hypotheses"])
    assert "preserved-log" not in json.dumps(incident["assessment"])


def test_original_expiring_during_analysis_rejects_result_and_commits_invalidation(
    client, preserved_log, monkeypatch
):
    incident, artifact = preserved_log
    analyze = diagnostic.analyze

    def expires_during_analysis(*args):
        expire_original(artifact["id"])
        return analyze(*args)

    monkeypatch.setattr(diagnostic, "analyze", expires_during_analysis)
    response = client.post(
        f"/api/incidents/{incident['id']}/actions",
        json={"action": "analyze", "revision": incident["revision"]},
    )
    assert response.status_code == 409
    # Read raw persisted state: a later GET must not be necessary to invalidate the source.
    persisted = database_operation(
        lambda session: session.get(service.IncidentRecord, incident["id"]).payload
    )
    assert persisted["assessment"] is None and not persisted["assessment_history"]
    assert persisted["revision"] == incident["revision"] + 1
    assert persisted["evidence"][-1]["status"] == "unavailable"
    assert persisted["history"][-1]["action"] == "original_unavailable"
