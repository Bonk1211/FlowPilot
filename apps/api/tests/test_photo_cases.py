"""Photo evidence must preserve workflow and provenance boundaries."""

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from fastapi.testclient import TestClient
from flowpilot import cases
from flowpilot.golden import load_golden_scenario
from flowpilot.main import create_app
from flowpilot.settings import ROOT
from flowpilot.vision import VisionAssessment


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'photo-cases.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")

    def load(assessment_id):
        if assessment_id not in ("normal", "incomplete", "coarse", "other-model"):
            raise HTTPException(404, "Photo assessment not found.")
        normal = assessment_id == "normal"
        return VisionAssessment(
            assessment_id=assessment_id,
            image_url=f"/api/vision/assessments/{assessment_id}/image",
            heatmap_url=f"/api/vision/assessments/{assessment_id}/heatmap",
            width=100,
            height=100,
            model_id="different" if assessment_id == "other-model" else "test-model",
            preprocessing_id="test-roi",
            raw_score=1.0 if normal else 3.0,
            threshold=2.0,
            result="within_reference" if normal else "anomaly",
            passed=normal,
            timestamp="2026-09-19T00:00:00+00:00",
        )

    monkeypatch.setattr(cases, "load_assessment", load)
    with TestClient(create_app()) as result:
        yield result


def create(client, assessment="incomplete"):
    response = client.post(
        "/api/investigations",
        json={
            "report": "Operator observed an irregular spray pattern",
            "assessment_id": assessment,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def act(client, case, action, **kwargs):
    result = client.post(
        f"/api/investigations/{case['investigation']['id']}/actions",
        json={
            "revision": case["revision"],
            "action": action,
            **kwargs,
        },
    )
    assert result.status_code == 200, result.text
    return result.json()


def diagnosed(client, assessment="incomplete"):
    case = create(client, assessment)
    for answer in ["continuous", "yes", "no", "unknown", "unknown"]:
        case = act(client, case, "answer", question_id=case["next_question"]["id"], value=answer)
    return act(client, case, "diagnose")


def corrected(client):
    case = diagnosed(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    return act(client, case, "complete_action", confirmed=True)


def test_photo_result_is_not_a_root_cause_or_defect_classifier(client):
    case = create(client)
    evidence = case["investigation"]["evidence"]
    assert {item["key"] for item in evidence} == {"operator_report", "visual_anomaly_detected"}
    assert evidence[-1]["source_type"] == "model_inference"
    assert case["ranking"] == []
    case = act(client, case, "answer", question_id="frequency", value="intermittent")
    symptom = next(e for e in case["investigation"]["evidence"] if e["key"] == "coarse_deposits")
    assert symptom["source_type"] == "technician_input"
    assert symptom["source_ref"] == "question:frequency"


def test_normal_photo_does_not_suppress_operator_investigation(client):
    case = diagnosed(client, "normal")
    assert case["diagnosis_supported"]
    assert case["investigation"]["state"] == "inspection_recommended"


def test_source_validation_and_unknown_assessment(client):
    assert (
        client.post(
            "/api/investigations",
            json={
                "report": "Issue",
                "sample_id": "incomplete",
                "assessment_id": "normal",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/investigations",
            json={
                "report": "Issue",
                "assessment_id": "missing",
            },
        ).status_code
        == 404
    )


def test_photo_verification_needs_normal_image_and_recovery_checks(client):
    case = corrected(client)
    checks = load_golden_scenario().recovery_checks.model_dump(mode="json")
    case = act(client, case, "verify", assessment_id="coarse", checks=checks)
    assert case["investigation"]["state"] == "corrective_action_completed"
    case = act(client, case, "verify", assessment_id="normal")
    assert case["investigation"]["state"] == "corrective_action_completed"
    case = act(client, case, "verify", assessment_id="normal", checks=checks)
    assert case["investigation"]["state"] == "verification_passed"
    case = act(client, case, "resolve", confirmed=True)
    assert "reference range" in case["summary"]["verification"]
    assert client.get(f"/api/investigations/{case['investigation']['id']}").json() == case


@pytest.mark.parametrize("values", [{"sample_id": "normal"}, {"assessment_id": "other-model"}])
def test_photo_verification_cannot_bypass_model_comparability(client, values):
    case = corrected(client)
    path = f"/api/investigations/{case['investigation']['id']}"
    response = client.post(
        path + "/actions",
        json={
            "revision": case["revision"],
            "action": "verify",
            **values,
            "checks": load_golden_scenario().recovery_checks.model_dump(mode="json"),
        },
    )
    assert response.status_code == 409
    assert client.get(path).json() == case


def test_corrected_symptom_retires_derived_operator_evidence(client):
    case = diagnosed(client)
    item = next(e for e in case["investigation"]["evidence"] if e["key"] == "frequency")
    case = act(
        client,
        case,
        "correct_evidence",
        evidence_id=item["id"],
        operation="edit",
        value="intermittent",
        reason="Correct the observed symptom",
        confirmed=True,
    )
    active = [e for e in case["investigation"]["evidence"] if e["verification_state"] != "rejected"]
    assert not any(e["key"] == "incomplete_coverage" for e in active)
    assert any(e["key"] == "coarse_deposits" for e in active)
    assert case["next_question"]["id"] == "intermittent"


def test_rejecting_model_output_preserves_independent_operator_symptoms(client):
    case = diagnosed(client)
    item = next(
        e for e in case["investigation"]["evidence"] if e["source_type"] == "model_inference"
    )
    case = act(
        client,
        case,
        "correct_evidence",
        evidence_id=item["id"],
        operation="reject",
        reason="Wrong reference for this photo",
        confirmed=True,
    )
    assert case["diagnosis_supported"]
    assert any(
        e["key"] == "incomplete_coverage" and e["verification_state"] == "verified"
        for e in case["investigation"]["evidence"]
    )


@pytest.mark.parametrize("edit_existing", [False, True])
def test_unknown_symptom_does_not_invent_defect_evidence(client, edit_existing):
    case = create(client)
    if edit_existing:
        case = act(client, case, "answer", question_id="frequency", value="intermittent")
        item = next(e for e in case["investigation"]["evidence"] if e["key"] == "frequency")
        case = act(
            client,
            case,
            "correct_evidence",
            evidence_id=item["id"],
            operation="edit",
            value="unknown",
            reason="Observation unavailable",
            confirmed=True,
        )
    else:
        case = act(client, case, "answer", question_id="frequency", value="unknown")
    active = [e for e in case["investigation"]["evidence"] if e["verification_state"] != "rejected"]
    assert not any(e["key"] in ("coarse_deposits", "incomplete_coverage") for e in active)
