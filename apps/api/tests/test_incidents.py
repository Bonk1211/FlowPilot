import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from flowpilot.incidents import diagnostic, service
from flowpilot.incidents.routes import router
from flowpilot.settings import ROOT


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'incidents.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


def replay(client, trigger="event-001"):
    response = client.post("/api/incidents/replay", json={"trigger_id": trigger})
    assert response.status_code == 201, response.text
    return response.json()


def act(client, incident, action, role="technician", **values):
    response = client.post(
        f"/api/incidents/{incident['id']}/actions",
        json={"revision": incident["revision"], "action": action, **values},
        headers={"X-Incident-Role": role},
    )
    assert response.status_code == 200, response.text
    return response.json()


def analyzed(client):
    incident = act(client, replay(client), "advance_replay")
    return act(client, incident, "analyze")


def test_demo_knowledge_capture_preserves_open_incident_and_is_idempotent(client):
    incident = replay(client)
    evidence = [item for item in incident["evidence"] if item["status"] == "collected"]
    payload = {
        "action": "capture_knowledge",
        "revision": incident["revision"],
        "knowledge_id": "KN-demo-finding",
        "title": "Coverage comparison needs material context",
        "summary": "Keep the before/after sources together while material history is checked.",
        "evidence_ids": [item["id"] for item in evidence],
    }
    path = f"/api/incidents/{incident['id']}/actions"
    response = client.post(path, json=payload)
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["status"] == incident["status"]
    assert saved["closure"] is None and saved["learning"] is None
    assert saved["handoff"] == incident["handoff"]
    finding = saved["captured_knowledge"][0]
    assert finding["status"] == "draft" and finding["demo"] is True
    assert finding["source_revision"] == incident["revision"]
    assert finding["source_refs"] == [item["source_ref"] for item in evidence]
    assert saved["history"][-1]["action"] == "capture_knowledge"
    assert client.get(f"/api/incidents/{incident['id']}").json() == saved
    assert client.post(path, json=payload).json() == saved
    assert client.post(path, json={**payload, "summary": "Different content"}).status_code == 409
    assert client.post(path, json={**payload, "knowledge_id": "KN-stale"}).status_code == 409


@pytest.mark.parametrize("evidence_ids", [[], ["unknown-source"], ["machine-log-pending"]])
def test_demo_knowledge_capture_requires_collected_incident_sources(client, evidence_ids):
    incident = replay(client)
    response = client.post(
        f"/api/incidents/{incident['id']}/actions",
        json={
            "action": "capture_knowledge",
            "revision": incident["revision"],
            "knowledge_id": "KN-bad-source",
            "title": "Draft finding",
            "summary": "A note.",
            "evidence_ids": evidence_ids,
        },
    )
    assert response.status_code == 422
    assert client.get(f"/api/incidents/{incident['id']}").json() == incident


def test_saved_gemini_assessment_and_history_load_without_breaking_incident_list(client):
    incident = analyzed(client)
    incident["assessment"]["provider"] = "gemini"
    incident["assessment_history"][0]["assessment"]["provider"] = "gemini"

    def save(session):
        session.get(service.IncidentRecord, incident["id"]).payload = incident

    service.database_operation(save)
    detail = client.get(f"/api/incidents/{incident['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["assessment"]["provider"] == "gemini"
    assert detail.json()["assessment_history"][0]["assessment"]["provider"] == "gemini"
    assert detail.json()["evidence"] == incident["evidence"]
    listing = client.get("/api/incidents")
    assert listing.status_code == 200, listing.text
    assert listing.json()[0]["id"] == incident["id"]


def test_partial_creation_deduplicates_without_diagnosis_or_machine_assumptions(
    client, monkeypatch
):
    def forbidden(*args):
        raise AssertionError("Creation must not wait for diagnosis")

    monkeypatch.setattr(diagnostic, "analyze", forbidden)
    incident = replay(client)
    assert replay(client) == incident
    assert len(client.get("/api/incidents").json()) == 1
    assert incident["assessment"] is None
    assert incident["handoff"]["status"] == "draft"
    assert incident["handoff"]["version"] == 1
    assert "PM record unavailable" in incident["handoff"]["body"]
    assert "Diagnosis is pending" in incident["handoff"]["body"]
    assert incident["disposition"] == "not_assessed"
    assert {e["status"] for e in incident["evidence"]} == {"collected", "pending", "unavailable"}
    assert all(e["integrity_ref"] and e["ingested_at"] for e in incident["evidence"])
    assert client.get(f"/api/incidents/{incident['id']}").json() == incident


def test_manual_import_validates_associations_and_reused_trigger_content(client):
    body = {"trigger_id": "manual-01", "symptom": "Coverage decline"}
    incident = client.post("/api/incidents", json=body).json()
    assert client.post("/api/incidents", json=body).json()["id"] == incident["id"]
    assert client.post("/api/incidents", json={**body, "symptom": "Changed"}).status_code == 409
    evidence = {
        "id": "test",
        "kind": "context",
        "role": "context",
        "label": "Imported note",
        "source_ref": "upload:note-01",
        "tool_id": "OTHER-TOOL",
    }
    assert (
        client.post(
            "/api/incidents", json={"trigger_id": "manual-02", "evidence": [evidence]}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/incidents",
            json={"trigger_id": "manual-03", "evidence": [{**evidence, "id": "../../unsafe"}]},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/incidents",
            json={
                "trigger_id": "manual-04",
                "evidence": [{**evidence, "values": {"blob": "a" * 32001}}],
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/incidents",
            json={
                "trigger_id": "manual-05",
                "evidence": [{**evidence, "image_url": "javascript:alert(1)"}],
            },
        ).status_code
        == 422
    )


def test_progressive_sources_cas_and_human_draft_versions(client):
    initial = replay(client)
    edited = act(client, initial, "edit_handoff", body="Engineer note: review material first.")
    collected = act(client, edited, "advance_replay")
    assert collected["handoff"] == edited["handoff"]
    assert len(collected["handoff_history"]) == 3
    assert collected["handoff_history"][-1]["source_revision"] == collected["revision"]
    assert collected["evidence"][0] == initial["evidence"][0]
    assert any(e["supersedes_id"] == "machine-log-pending" for e in collected["evidence"])
    assert any(e["status"] == "unavailable" for e in collected["evidence"])
    refreshed = act(client, collected, "refresh_handoff")
    assert [d["version"] for d in refreshed["handoff_history"]] == [1, 2, 3, 4]
    assert refreshed["handoff"]["body"] == edited["handoff"]["body"]
    stale = client.post(
        f"/api/incidents/{initial['id']}/actions",
        json={"revision": initial["revision"], "action": "analyze"},
    )
    assert stale.status_code == 409


def test_result_changes_rank_and_correction_invalidates_dependent_result(client):
    incident = analyzed(client)
    before = incident["assessment"]
    assert len(before["hypotheses"]) == 3
    incident = act(
        client, incident, "record_result", check_id="delivery_review", result="supported"
    )
    assert incident["assessment"]["hypotheses"][0]["id"] == "unstable_delivery"
    assert incident["observations"][0]["evidence_ids"]
    assert len(incident["assessment_history"]) == 2
    original = next(e for e in incident["evidence"] if e["id"] == "machine-log-collected")
    replacement = {
        key: value
        for key, value in original.items()
        if key
        not in {
            "ingested_at",
            "integrity_ref",
            "supersedes_id",
            "correction_reason",
            "raw_integrity_ref",
        }
    }
    replacement.update(id="log-corrected", values={"mass_trend": "falling"})
    incident = act(
        client,
        incident,
        "correct_evidence",
        evidence_id=original["id"],
        replacement=replacement,
        reason="Pressure channel association was wrong.",
    )
    assert incident["assessment"] is None
    assert len(incident["assessment_history"]) == 2
    assert original in incident["evidence"]
    incident = act(client, incident, "analyze")
    assert not any(h["status"] == "supported" for h in incident["assessment"]["hypotheses"])
    assert len(incident["observations"]) == 1  # Original recorded result remains auditable.


def test_unknown_and_contradiction_remain_unconfirmed_and_operational_results_blocked(client):
    incident = analyzed(client)
    incident = act(
        client, incident, "record_result", check_id="question_material", result="unknown"
    )
    material = next(
        field for field in incident["assessment"]["discovery"] if field["id"] == "question_material"
    )
    assert material["status"] == "unknown"
    incident = act(
        client, incident, "record_result", check_id="delivery_review", result="contradicted"
    )
    delivery = next(
        h for h in incident["assessment"]["hypotheses"] if h["id"] == "unstable_delivery"
    )
    assert delivery["status"] == "contradicted"
    assert incident["assessment"]["next_step"]["id"] != "delivery_review"
    assert incident["assessment"]["fallback"]
    for extra in [
        {"check_id": "restriction_review", "result": "supported", "synthetic": False},
        {"check_id": "restriction_review", "result": "supported", "evidence_ids": ["missing"]},
        {"check_id": "turn_valve_on", "result": "yes"},
    ]:
        assert (
            client.post(
                f"/api/incidents/{incident['id']}/actions",
                json={"revision": incident["revision"], "action": "record_result", **extra},
            ).status_code
            == 422
        )


def test_inconclusive_closure_review_export_and_late_evidence_withdrawal(client):
    incident = analyzed(client)
    close = {
        "outcome": "inconclusive",
        "notes": "Missing material history.",
        "reviewer": "Engineer A",
    }
    assert (
        client.post(
            f"/api/incidents/{incident['id']}/actions",
            json={"action": "close", "revision": incident["revision"], **close},
        ).status_code
        == 403
    )
    incident = act(client, incident, "close", role="engineer", **close)
    assert incident["closure"]["conclusion"] is None
    assert incident["learning"]["status"] == "candidate"
    assert incident["disposition"] == "not_assessed"
    incident = act(
        client,
        incident,
        "review_learning",
        role="engineer",
        reviewer="Engineer B",
        decision="approve",
        notes="Reviewed as an unresolved replay example.",
    )
    assert incident["learning"]["status"] == "published"
    source_fingerprint = incident["learning"]["source_fingerprint"]
    export = client.get(f"/api/incidents/{incident['id']}/report.md")
    assert export.status_code == 200
    assert "No cause confirmed" in export.text
    assert "Source versions and applicability" in export.text
    assert "s932-defects: S932-CONSOLIDATED" in export.text
    assert "operational instructions allowed: False" in export.text
    assert "image-good" in export.text and "PM record unavailable" in export.text
    assert f"-r{incident['revision']}.md" in export.headers["Content-Disposition"]
    incident = act(
        client,
        incident,
        "add_evidence",
        evidence={
            "id": "late-note",
            "kind": "context",
            "role": "context",
            "label": "Late material note",
            "source_ref": "import:note-02",
            "values": {"material": "new batch reported"},
        },
    )
    assert incident["status"] == "investigating"
    assert incident["closure"] is None and len(incident["closure_history"]) == 1
    assert incident["learning"]["status"] == "withdrawn"
    assert incident["learning"]["source_fingerprint"] == source_fingerprint
    assert incident["learning"]["reviews"][-1]["reviewer"] == "system"
    incident = act(client, incident, "close", role="engineer", **close)
    assert len(incident["learning_history"]) == 1
    assert incident["learning_history"][0]["reviews"][0]["reviewer"] == "Engineer B"


def test_conflicting_repeat_checks_preserve_both_observations_and_block_supported_closure(client):
    incident = analyzed(client)
    incident = act(
        client, incident, "record_result", check_id="delivery_review", result="supported"
    )
    incident = act(
        client, incident, "record_result", check_id="delivery_review", result="contradicted"
    )
    delivery = next(
        item for item in incident["assessment"]["hypotheses"] if item["id"] == "unstable_delivery"
    )
    assert delivery["status"] == "inconclusive"
    assert delivery["supporting_evidence"] and delivery["conflicting_evidence"]
    assert all(item["supersedes_id"] is None for item in incident["observations"])
    response = client.post(
        f"/api/incidents/{incident['id']}/actions",
        headers={"X-Incident-Role": "engineer"},
        json={
            "revision": incident["revision"],
            "action": "close",
            "outcome": "supported",
            "reviewer": "Demo engineer",
            "notes": "These results conflict.",
            "conclusion": "Delivery instability",
        },
    )
    assert response.status_code == 422


def test_late_analysis_cannot_overwrite_concurrent_evidence(client, monkeypatch):
    incident = replay(client)
    original_analyze = diagnostic.analyze

    def concurrent_analysis(*args):
        current = service.get_incident(incident["id"])
        from flowpilot.incidents.models import EscalateAction

        service.act(
            current.id,
            EscalateAction(
                action="escalate", revision=current.revision, notes="Concurrent engineer request."
            ),
        )
        return original_analyze(*args)

    monkeypatch.setattr(diagnostic, "analyze", concurrent_analysis)
    response = client.post(
        f"/api/incidents/{incident['id']}/actions",
        json={"action": "analyze", "revision": incident["revision"]},
    )
    assert response.status_code == 409
    saved = client.get(f"/api/incidents/{incident['id']}").json()
    assert saved["escalated"]
    assert saved["assessment"] is None


def test_manual_analysis_and_new_observations_preserve_escalation(client):
    incident = act(client, analyzed(client), "escalate", notes="Engineer review requested.")
    incident = act(client, incident, "analyze")
    assert incident["escalated"] and incident["status"] == "review"
    assert incident["waiting_for"] == "engineer"
    incident = act(
        client, incident, "record_result", check_id="question_material", result="unknown"
    )
    assert incident["assessment"] is not None
    assert incident["escalated"] and incident["status"] == "review"
    assert incident["waiting_for"] == "engineer"


def test_saved_report_includes_mini_doe_comparisons(client):
    incident = analyzed(client)
    report = service.report_markdown(service.get_incident(incident["id"]))
    assert "Suggested mini DOE / troubleshooting comparisons" in report
    for check in incident["assessment"]["checks"]:
        plan = check["mini_experiment"]
        assert plan["baseline"] in report
        assert plan["comparison"] in report
        assert plan["repeat_plan"] in report
        assert check["measured_response"] in report
    assert "not completed tests or approved equipment operations" in report
