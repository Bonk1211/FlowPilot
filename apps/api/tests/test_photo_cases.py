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


def intake_payload(coarse=False, with_log=True):
    slug = "coarse-deposits" if coarse else "incomplete-coverage"
    branch = "intermittent" if coarse else "continuous"
    observations = {
        "frequency": {"value": branch},
        branch: {"value": "yes"},
        "change": {"value": "no"},
        "temperature": {"value": "unknown"},
        "service": {"value": "unknown"},
    }
    context = {"observations": observations, "notes": "Visible spray defect after this board."}
    if with_log:
        context.update(
            {
                "log": {
                    "text": (ROOT / f"fixtures/logs/synthetic-{slug}.log").read_text(),
                    "sourceName": f"synthetic-{slug}.log",
                },
                "board_id": "203" if coarse else "103",
                "log_confirmed": True,
            }
        )
        observations[branch]["source"] = "machine_log"
        observations["change"]["source"] = "machine_log"
    return {
        "report": "Visible spray defect",
        "assessment_id": "coarse" if coarse else "incomplete",
        "context": context,
    }


@pytest.mark.parametrize("coarse", [False, True])
def test_combined_intake_saves_ranked_case_and_provenance_once(client, coarse):
    payload = intake_payload(coarse)
    response = client.post("/api/investigations", json=payload)
    assert response.status_code == 201, response.text
    case = response.json()
    assert case["questions_complete"] and case["next_question"] is None
    assert case["ranking"][0]["hypothesis_id"] == (
        "atomization_fault" if coarse else "fluid_path_restriction"
    )
    assert not any(cause["confirmed"] for cause in case["ranking"])
    branch = "intermittent" if coarse else "continuous"
    evidence = [e for e in case["investigation"]["evidence"] if e["key"] == branch]
    assert len(evidence) == 1 and evidence[0]["source_type"] == "machine_log"
    assert "#L" in evidence[0]["source_ref"]
    assert case["revision"] > 0
    saved = client.get(f"/api/investigations/{case['investigation']['id']}").json()
    assert saved == case
    # Optimistic locking still works after the batched creation.
    inspected = act(client, case, "inspect", outcome="obstruction_found")
    assert inspected["pending_outcome"] == "obstruction_found"


def test_combined_intake_without_log_and_unknown_observations(client):
    payload = intake_payload(with_log=False)
    for choice in payload["context"]["observations"].values():
        choice["value"] = "unknown"
    response = client.post("/api/investigations", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["log"] is None
    assert not any(
        e["key"] == "coarse_deposits" for e in response.json()["investigation"]["evidence"]
    )


@pytest.mark.parametrize(
    "problem", ["unconfirmed", "wrong_board", "invented", "missing", "conflict", "extra"]
)
def test_invalid_intake_is_atomic_and_cannot_trust_client_suggestions(client, problem):
    payload = intake_payload()
    context = payload["context"]
    if problem == "unconfirmed":
        context["log_confirmed"] = False
    if problem == "wrong_board":
        context["board_id"] = "101"
    if problem == "invented":
        context["observations"]["change"]["value"] = "unstable"
    if problem == "missing":
        del context["observations"]["service"]
    if problem == "extra":
        context["observations"]["intermittent"] = {"value": "yes"}
    if problem == "conflict":
        context["observations"]["continuous"] = {"value": "no", "source": "technician_input"}
    response = client.post("/api/investigations", json=payload)
    assert response.status_code == 422, response.text
    assert client.get("/api/investigations").json() == []


def test_conflict_resolution_keeps_both_sources_but_only_selected_answer_scores(client):
    payload = intake_payload()
    payload["context"]["observations"]["continuous"] = {
        "value": "no",
        "source": "technician_input",
        "reason": "Independent reweighing was stable.",
    }
    response = client.post("/api/investigations", json=payload)
    assert response.status_code == 201, response.text
    case = response.json()
    assert case["answers"]["continuous"] == "no"
    assert case["intake"]["signals"]["continuous"]["answer"] == "yes"
    assert any(e["key"] == "evidence_resolution" for e in case["investigation"]["evidence"])
    assert not any(c["weight"] == 25 for cause in case["ranking"] for c in cause["contributions"])


def test_rejecting_raw_weight_retires_derived_log_answer(client):
    result = client.post("/api/investigations", json=intake_payload())
    case = result.json()
    raw = next(e for e in case["investigation"]["evidence"] if e["key"] == "flux_weight_result")
    revised = act(
        client,
        case,
        "correct_evidence",
        evidence_id=raw["id"],
        operation="reject",
        reason="Scale measurement invalid",
        confirmed=True,
    )
    assert revised["next_question"]["id"] == "continuous"
    assert "continuous" not in revised["answers"]
    assert revised["ranking"] == []
    assert all(
        e["verification_state"] == "rejected"
        for e in revised["investigation"]["evidence"]
        if e["key"] == "continuous"
    )
