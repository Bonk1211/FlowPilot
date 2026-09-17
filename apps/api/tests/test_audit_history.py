import copy

import pytest
from flowpilot.cases import CaseRecord, database_operation
from test_cases import act, client, diagnose  # noqa: F401
from test_corrections import correction
from test_flux_recovery import corrected


def test_history_preserves_scores_evidence_and_correction_invalidation(client):  # noqa: F811
    case = diagnose(client)
    first = copy.deepcopy(case["diagnostic_history"][0])
    assert first["ranking"][0]["score"] == 40
    assert first["reasoning"]["mode"] == "cached"
    assert case["timeline"][-1]["diagnostic_revision"] == first["revision"]
    assert case["timeline"][-1]["timestamp"] == first["timestamp"]
    case = act(
        client,
        case,
        "correct_evidence",
        **correction(case, "frequency", operation="edit", value="intermittent"),
    )
    assert case["diagnostic_history"][0] == first
    assert case["diagnostic_history"][-1]["ranking"] == []
    assert case["diagnostic_history"][-1]["trigger"] == "correct_evidence"
    old_answer = next(e for e in first["evidence"] if e["key"] == "frequency")
    assert old_answer["verification_state"] == "verified"
    retired = next(e for e in case["investigation"]["evidence"] if e["id"] == old_answer["id"])
    assert retired["verification_state"] == "rejected"
    for answer in ["yes", "no", "unknown", "unknown"]:
        case = act(client, case, "answer", question_id=case["next_question"]["id"], value=answer)
    case = act(client, case, "diagnose")
    assert case["diagnostic_history"][-1]["ranking"][0]["hypothesis_id"] == "atomization_fault"
    assert len(case["diagnostic_history"]) == 3
    assert client.get(f"/api/investigations/{case['investigation']['id']}").json() == case


@pytest.mark.parametrize("outcome", ["obstruction_found", "no_obstruction_found"])
def test_confirmation_preserves_preinspection_result(client, outcome):  # noqa: F811
    case = diagnose(client)
    first = copy.deepcopy(case["diagnostic_history"][0])
    case = act(client, case, "inspect", outcome=outcome)
    case = act(client, case, "confirm_observation", confirmed=True)
    assert len(case["diagnostic_history"]) == 2
    assert case["diagnostic_history"][0] == first
    last = case["diagnostic_history"][-1]
    assert last["ranking"] == case["ranking"]
    assert last["findings"] == case["findings"]
    assert last["evidence"] == case["investigation"]["evidence"]
    assert last["revision"] == case["revision"]
    assert any(e["value"] == outcome for e in last["evidence"])
    response = client.post(
        f"/api/investigations/{case['investigation']['id']}/actions",
        json={"action": "confirm_observation", "confirmed": True, "revision": 0},
    )
    assert response.status_code == 409
    assert client.get(f"/api/investigations/{case['investigation']['id']}").json() == case


def test_history_captures_final_live_findings_then_fallback(client, monkeypatch):  # noqa: F811
    from flowpilot.diagnosis.reasoning import enrich
    from flowpilot.settings import Settings
    from test_reasoning import result

    async def generate(role, payload, schema):
        return result(role, payload)

    async def live(case):
        await enrich(case, Settings(reasoning_enabled=True), generate)

    monkeypatch.setattr("flowpilot.cases.enrich", live)
    case = diagnose(client)
    original = copy.deepcopy(case["diagnostic_history"][0])
    assert original["findings_mode"] == "live"
    assert original["findings"] == case["findings"]
    assert original["reasoning"]["critic"]["accepted"]

    async def fallback(case):
        await enrich(case, Settings(reasoning_enabled=False))

    monkeypatch.setattr("flowpilot.cases.enrich", fallback)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    assert case["diagnostic_history"][0] == original
    assert case["diagnostic_history"][-1]["findings_mode"] == "cached_templates"
    assert case["diagnostic_history"][-1]["reasoning"]["fallback_reason"]


def test_old_v2_get_is_read_only_and_next_action_retains_only_known_baseline(client):  # noqa: F811
    old = diagnose(client)
    old.pop("diagnostic_history")
    for entry in old["timeline"]:
        entry.pop("diagnostic_revision", None)
    case_id = old["investigation"]["id"]

    def replace(session):
        session.get(CaseRecord, case_id).payload = copy.deepcopy(old)

    database_operation(replace)
    loaded = client.get(f"/api/investigations/{case_id}").json()
    assert loaded["diagnostic_history"] == []
    assert database_operation(lambda session: session.get(CaseRecord, case_id).payload) == old
    updated = act(client, loaded, "inspect", outcome="obstruction_found")
    assert len(updated["diagnostic_history"]) == 1
    baseline = updated["diagnostic_history"][0]
    assert baseline["trigger"] == "retained_baseline"
    assert baseline["ranking"] == old["ranking"]
    assert baseline["revision"] == old["revision"]


def test_resolution_notes_validate_and_persist_without_altering_history(client):  # noqa: F811
    case = corrected(client)
    case = act(client, case, "verify", sample_id="normal")
    history = copy.deepcopy(case["diagnostic_history"])
    path = f"/api/investigations/{case['investigation']['id']}"
    invalid = client.post(
        path + "/actions",
        json={
            "action": "resolve",
            "revision": case["revision"],
            "confirmed": True,
            "notes": "x" * 2001,
        },
    )
    assert invalid.status_code == 422
    assert client.get(path).json() == case

    case = act(
        client,
        case,
        "resolve",
        confirmed=True,
        notes="  Simulated follow-up\nBoth lanes accepted.  ",
    )
    assert case["summary"]["notes"] == "Simulated follow-up\nBoth lanes accepted."
    assert case["diagnostic_history"] == history
    assert client.get(path).json() == case


def test_concurrent_revision_conflict_does_not_commit_a_snapshot(client, monkeypatch):  # noqa: F811
    case = diagnose(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case_id = case["investigation"]["id"]
    path = f"/api/investigations/{case_id}"
    before = copy.deepcopy(case)

    async def concurrent_write(_case):
        def update(session):
            record = session.get(CaseRecord, case_id)
            payload = copy.deepcopy(record.payload)
            payload["revision"] += 1
            record.revision = payload["revision"]
            record.payload = payload

        database_operation(update)

    monkeypatch.setattr("flowpilot.cases.enrich", concurrent_write)
    response = client.post(
        path + "/actions",
        json={"action": "confirm_observation", "confirmed": True, "revision": case["revision"]},
    )
    assert response.status_code == 409
    after = client.get(path).json()
    assert after["diagnostic_history"] == before["diagnostic_history"]
    assert after["timeline"] == before["timeline"]
    assert after["investigation"]["state"] == "inspection_recommended"


def test_default_reasoning_budget_fits_demo_target(monkeypatch):
    from flowpilot.settings import Settings

    monkeypatch.delenv("FLOWPILOT_REASONING_TIMEOUT_SECONDS", raising=False)
    assert Settings(_env_file=None).reasoning_timeout_seconds == 12
