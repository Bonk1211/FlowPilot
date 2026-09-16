import json

import pytest
from flowpilot.cases import Case, CaseRecord, database_operation
from sqlalchemy import update
from test_cases import act, client, diagnose  # noqa: F401


def correction(case, key, **kwargs):
    item = next(
        e
        for e in case["investigation"]["evidence"]
        if e["key"] == key and e["verification_state"] != "rejected"
    )
    return {
        "evidence_id": item["id"],
        "operation": "reject",
        "reason": "Technician review",
        "confirmed": True,
        **kwargs,
    }


def test_edit_retires_old_branch_and_records_original_values(client):  # noqa: F811
    case = diagnose(client)
    case = act(
        client,
        case,
        "correct_evidence",
        **correction(case, "frequency", operation="edit", value="intermittent"),
    )
    assert case["answers"] == {"frequency": "intermittent"}
    assert case["next_question"]["id"] == "intermittent"
    assert case["ranking"] == []
    assert case["recommendation"] is None
    old = [e for e in case["investigation"]["evidence"] if e["verification_state"] == "rejected"]
    assert {e["key"] for e in old} == {
        "frequency",
        "continuous",
        "change",
        "temperature",
        "service",
    }
    history = json.loads(case["timeline"][-1]["description"].removeprefix("Evidence correction: "))
    assert history["before"]["value"] == "continuous"
    assert history["before"]["verification_state"] == "verified"
    for answer in ["yes", "no", "unknown", "unknown"]:
        case = act(client, case, "answer", question_id=case["next_question"]["id"], value=answer)
    case = act(client, case, "diagnose")
    assert case["ranking"][0]["hypothesis_id"] == "trapped_air_bubble"
    assert case["reasoning"]["evidence_revision"] == case["revision"]


def test_image_rejection_retires_derived_score_and_pending_inspection(client):  # noqa: F811
    case = diagnose(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "correct_evidence", **correction(case, "mean_dot_diameter_px"))
    assert not case["diagnosis_supported"]
    assert case["pending_outcome"] is None
    assert case["recommendation"] is None
    retired = {
        e["id"] for e in case["investigation"]["evidence"] if e["verification_state"] == "rejected"
    }
    assert len(retired) == 2
    assert not any(c["evidence_id"] in retired for r in case["ranking"] for c in r["contributions"])


@pytest.mark.parametrize("outcome", ["obstruction_found", "no_obstruction_found"])
def test_both_confirmed_outcomes_lock_corrections(client, outcome):  # noqa: F811
    case = diagnose(client)
    case = act(client, case, "inspect", outcome=outcome)
    case = act(client, case, "confirm_observation", confirmed=True)
    response = client.post(
        f"/api/investigations/{case['investigation']['id']}/actions",
        json={
            "action": "correct_evidence",
            "revision": case["revision"],
            **correction(case, "operator_report"),
        },
    )
    assert response.status_code == 409


@pytest.mark.parametrize(
    "changes", [{"confirmed": False}, {"reason": " "}, {"operation": "edit", "value": "42"}]
)
def test_invalid_corrections_do_not_change_storage(client, changes):  # noqa: F811
    case = diagnose(client)
    path = f"/api/investigations/{case['investigation']['id']}"
    response = client.post(
        path + "/actions",
        json={
            "action": "correct_evidence",
            "revision": case["revision"],
            **correction(case, "undersized", **changes),
        },
    )
    assert response.status_code == 422
    assert client.get(path).json() == case


def test_slow_reasoning_cannot_overwrite_newer_revision(client, monkeypatch):  # noqa: F811
    case = diagnose(client)
    path = f"/api/investigations/{case['investigation']['id']}"

    async def concurrent_edit(candidate):
        # This separate write succeeds because reasoning holds no database transaction.
        newer = Case.model_validate(case)
        newer.revision += 1
        newer.investigation.title = "Concurrent update"
        database_operation(
            lambda session: session.execute(
                update(CaseRecord)
                .where(CaseRecord.id == newer.investigation.id)
                .values(revision=newer.revision, payload=newer.model_dump(mode="json"))
            )
        )

    monkeypatch.setattr("flowpilot.cases.enrich", concurrent_edit)
    response = client.post(
        path + "/actions",
        json={
            "action": "correct_evidence",
            "revision": case["revision"],
            **correction(case, "operator_report", operation="edit", value="Slow update"),
        },
    )
    assert response.status_code == 409
    assert client.get(path).json()["investigation"]["title"] == "Concurrent update"


def test_legacy_case_has_safe_reasoning_defaults(client):  # noqa: F811
    case = diagnose(client)
    case.pop("reasoning")
    restored = Case.model_validate(case)
    assert restored.reasoning is None


def test_live_metadata_and_reviewed_findings_survive_read_without_provider(client, monkeypatch):  # noqa: F811
    from flowpilot.diagnosis.reasoning import enrich
    from flowpilot.settings import Settings
    from test_reasoning import result

    calls = []

    async def generate(role, payload, schema):
        calls.append(role)
        return result(role, payload)

    async def live(case):
        await enrich(case, Settings(reasoning_enabled=True), generate)

    monkeypatch.setattr("flowpilot.cases.enrich", live)
    case = diagnose(client)
    assert case["findings_mode"] == "live"
    path = f"/api/investigations/{case['investigation']['id']}"
    assert client.get(path).json() == case
    assert len(calls) == 3
