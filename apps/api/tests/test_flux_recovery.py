import copy
import json

import pytest
from flowpilot.cases import CaseRecord, database_operation
from flowpilot.golden import load_golden_scenario
from flowpilot.legacy_imaging import sample_measurement as legacy_measurement
from flowpilot.settings import fixture_path
from test_cases import act, client, create, diagnose  # noqa: F401


def corrected(client):  # noqa: F811
    case = diagnose(client)
    case = act(client, case, "inspect", outcome="obstruction_found")
    case = act(client, case, "confirm_observation", confirmed=True)
    return act(client, case, "complete_action", confirmed=True, corrective_action="nozzle_cleaning")


def checks():
    return load_golden_scenario().recovery_checks.model_dump()


@pytest.mark.parametrize(
    "fault",
    [
        "setup",
        "calibration",
        "weight",
        "pressure",
        "reference",
        "lane",
        "duplicate_lane",
        "missing_lane",
        "wrong_lanes",
        "subsequent_unknown",
        "four_trays",
        "unconfirmed",
    ],
)
def test_incomplete_recovery_cannot_resolve(client, fault):  # noqa: F811
    case = corrected(client)
    record = checks()
    simple = {
        "setup": "prompted_setup",
        "calibration": "calibration",
        "weight": "weight_within_limits",
        "pressure": "pressure_within_limits",
    }
    if fault in simple:
        record[simple[fault]] = "unknown"
    elif fault == "reference":
        record["limits_reference"] = " "
    elif fault == "lane":
        record["first_carriers"][1]["all_units_accepted"] = "fail"
    elif fault == "duplicate_lane":
        record["first_carriers"][1]["lane"] = "A"
    elif fault == "missing_lane":
        record["first_carriers"].pop()
    elif fault == "wrong_lanes":
        record["expected_lanes"] = ["A"]
        record["first_carriers"].pop()
    elif fault == "subsequent_unknown":
        record["subsequent_required"] = "unknown"
    elif fault == "four_trays":
        record.update(subsequent_required="yes", subsequent_trays_accepted=4)
    else:
        record["confirmed"] = False
    case = act(client, case, "verify", sample_id="normal", checks=record)
    assert case["verification"]["passed"]  # Good pixels alone cannot resolve.
    assert case["investigation"]["state"] == "corrective_action_completed"
    response = client.post(
        f"/api/investigations/{case['investigation']['id']}/actions",
        json=dict(action="resolve", revision=case["revision"], confirmed=True),
    )
    assert response.status_code == 409


def test_two_calibration_failures_persist_and_block_retry(client):  # noqa: F811
    case = corrected(client)
    record = checks()
    record["calibration"] = "fail"
    for _ in range(2):
        case = act(client, case, "verify", sample_id="normal", checks=record)
    path = f"/api/investigations/{case['investigation']['id']}"
    assert client.get(path).json()["calibration_failures"] == 2
    assert case["calibration_attempts"] == 2
    assert case["escalated"]
    response = client.post(
        path + "/actions",
        json=dict(action="verify", revision=case["revision"], sample_id="normal", checks=checks()),
    )
    assert response.status_code == 409
    assert client.get(path).json() == case


def test_passing_weight_does_not_hide_bad_atomization_and_five_trays_pass(client):  # noqa: F811
    case = corrected(client)
    case = act(client, case, "verify", sample_id="coarse", checks=checks())
    assert case["investigation"]["state"] == "corrective_action_completed"
    record = checks()
    record.update(subsequent_required="yes", subsequent_trays_accepted=5)
    case = act(client, case, "verify", sample_id="normal", checks=record)
    case = act(client, case, "resolve", confirmed=True)
    assert case["investigation"]["state"] == "resolved"
    assert "cleaning" in case["summary"]["corrective_action"]


@pytest.mark.parametrize(
    "sample,answers,expected",
    [
        ("incomplete", ["continuous", "yes", "no", "unknown", "unknown"], "fluid_path_restriction"),
        ("coarse", ["intermittent", "yes", "no", "unknown", "unknown"], "atomization_fault"),
        (
            "incomplete",
            ["continuous", "unknown", "unstable", "unknown", "unknown"],
            "fluid_supply_fault",
        ),
        ("shifted", ["continuous", "unknown", "no", "unknown", "yes"], "alignment_fault"),
        ("incomplete", ["continuous", "unknown", "no", "yes", "unknown"], "material_condition"),
    ],
)
def test_five_cause_signatures(client, sample, answers, expected):  # noqa: F811
    case = create(client, sample)
    for answer in answers:
        case = act(client, case, "answer", question_id=case["next_question"]["id"], value=answer)
    case = act(client, case, "diagnose")
    assert case["ranking"][0]["hypothesis_id"] == expected
    assert not any(c["confirmed"] for c in case["ranking"])


def test_legacy_payload_is_readable_unchanged_and_rejects_every_action(client):  # noqa: F811
    old = json.loads(fixture_path("v1/golden-scenario.json").read_text(encoding="utf-8"))
    raw = dict(
        investigation=old["investigation"],
        revision=7,
        rules_version="1.0",
        measurement=legacy_measurement("undersized").model_dump(),
        verification=legacy_measurement("normal").model_dump(),
        ranking=next(s for s in old["snapshots"] if s["id"] == "summary")["ranking"],
        findings=old["findings"],
        procedure=old["procedure_steps"],
        timeline=old["snapshots"][-1]["timeline"],
        summary=old["summary"],
        diagnosis_supported=True,
    )
    original = copy.deepcopy(raw)
    case_id = raw["investigation"]["id"]
    database_operation(lambda session: session.add(CaseRecord(id=case_id, revision=7, payload=raw)))
    path = f"/api/investigations/{case_id}"
    loaded = client.get(path).json()
    assert loaded["scenario_version"] == "1.0"
    for key, value in original.items():
        assert loaded[key] == value
    for action in [
        dict(action="diagnose"),
        dict(action="answer", question_id="frequency", value="continuous"),
        dict(action="attach_log", log=dict(text="", sourceName="empty.log")),
        dict(action="inspect", outcome="obstruction_found"),
        dict(action="confirm_observation", confirmed=True),
        dict(action="complete_action", confirmed=True),
        dict(action="resolve", confirmed=True),
        dict(action="verify", sample_id="normal", checks=checks()),
        dict(
            action="correct_evidence",
            evidence_id="EV-IMAGE",
            operation="reject",
            reason="Do not mutate history",
            confirmed=True,
        ),
    ]:
        response = client.post(path + "/actions", json=dict(revision=7, **action))
        assert response.status_code == 409, response.text
    stored = database_operation(lambda session: session.get(CaseRecord, case_id).payload)
    assert stored == original
