import hashlib
import json

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from flowpilot.incidents import simulation
from flowpilot.incidents.experiments import ExperimentFactor, router
from flowpilot.incidents.models import AddEvidenceAction, EvidenceInput
from flowpilot.incidents.replay import replay_request
from flowpilot.incidents.service import act, create_incident, get_incident
from flowpilot.settings import ROOT
from pydantic import ValidationError

TOKEN = "test-only-mock-doe-reviewer-token-1234567890"
EDITOR_TOKEN = "test-only-mock-doe-editor-token-123456789012"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
EDITOR_HEADERS = {"Authorization": f"Bearer {EDITOR_TOKEN}"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'experiments.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "configured")
    monkeypatch.setenv(
        "FLOWPILOT_INCIDENT_PRINCIPALS",
        json.dumps(
            [
                {
                    "subject": "test:reviewer",
                    "token_sha256": hashlib.sha256(TOKEN.encode()).hexdigest(),
                    "permissions": ["view", "edit", "authorize_test"],
                },
                {
                    "subject": "test:editor",
                    "token_sha256": hashlib.sha256(EDITOR_TOKEN.encode()).hexdigest(),
                    "permissions": ["view", "edit"],
                },
            ]
        ),
    )
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


def incident():
    return create_incident(replay_request("doe-test-001"))


def payload(current, **changes):
    return {
        "incident_revision": current.revision,
        "check_id": "restriction_review",
        "hypothesis_ids": ["restriction", "unstable_delivery", "material_condition"],
        "factors": [{"name": "severity", "levels": [0.2, 0.8]}],
        "controls": {"severity": 0.7, "delivery_ratio": 1, "material_ratio": 1},
        "repetitions": 2,
        "response": "relative_mass",
        **changes,
    }


def propose(client, current, **changes):
    response = client.post(
        f"/api/incidents/{current.id}/experiments",
        json=payload(current, **changes),
        headers=EDITOR_HEADERS,
    )
    assert response.status_code == 201, response.text
    return response.json()


def command_plan(client, current, plan, command, **fields):
    response = client.post(
        f"/api/incidents/{current.id}/experiments/{plan['id']}/{command}",
        json={"revision": plan["revision"], **fields},
        headers=HEADERS,
    )
    assert response.status_code == 200, response.text
    return response.json()


def add_context(current, synthetic=True):
    return act(
        current.id,
        AddEvidenceAction(
            action="add_evidence",
            revision=current.revision,
            evidence=EvidenceInput(
                id="changed-context",
                kind="context",
                role="context",
                label="Changed test context",
                source_ref="test:context",
                synthetic=synthetic,
                values={"material": "new context"},
            ),
        ),
    )


def test_plan_is_complete_immutable_source_bound_and_idempotent(client):
    current = incident()
    plan = propose(client, current)
    assert propose(client, current) == plan
    assert plan["plan_revision"] == 1 and plan["status"] == "proposed"
    assert len(plan["matrix"]) == 15  # 3 hypotheses × (2 levels × 2 repetitions + 1 baseline).
    assert [row["index"] for row in plan["matrix"]] == list(range(1, 16))
    assert sum(row["baseline"] for row in plan["matrix"]) == 3
    assert plan["source_passage"]["authority"] == "prototype_specification"
    assert plan["source_passage"]["operational_allowed"] is False
    assert plan["physical_execution_allowed"] is False
    assert plan["source_evidence"] == [item.model_dump(mode="json") for item in current.evidence]
    assert len(plan["source_evidence"]) == len(current.evidence)
    assert plan["prerequisites"] and plan["stopping_conditions"]
    assert all(row["parameters"]["delivery_ratio"] == 1 for row in plan["matrix"])


def test_authorization_then_exact_matrix_once_without_diagnostic_confirmation(client, monkeypatch):
    current = incident()
    plan = propose(client, current)
    run_path = f"/api/incidents/{current.id}/experiments/{plan['id']}/run"
    assert client.post(run_path, json={"revision": 1}, headers=EDITOR_HEADERS).status_code == 409
    approve_path = f"/api/incidents/{current.id}/experiments/{plan['id']}/approve"
    assert (
        client.post(approve_path, json={"revision": 1}, headers=EDITOR_HEADERS).status_code == 403
    )
    approved = command_plan(client, current, plan, "approve")
    assert approved["approved_by"] == "test:reviewer"
    calls = []
    original = simulation.simulate

    def counted(*args):
        calls.append(args[0].parameters.model_dump())
        return original(*args)

    monkeypatch.setattr(simulation, "simulate", counted)
    completed = command_plan(client, current, approved, "run")
    assert completed["status"] == "completed"
    assert len(calls) == len(completed["matrix"]) == len(completed["results"]) == 15
    assert [row["condition"] for row in completed["results"]] == completed["matrix"]
    assert all(len(row["run"]["points"]) == 13 for row in completed["results"])
    assert completed["analysis"]["outcome"] == "simulated_difference"
    assert completed["analysis"]["diagnostic_confirmation"] is False
    assert completed["analysis"]["threshold_validated_for_machine"] is False
    assert command_plan(client, current, approved, "run") == completed
    assert len(calls) == 15
    saved = get_incident(current.id)
    assert saved.revision == current.revision and saved.assessment == current.assessment
    assert saved.observations == []


def test_inconclusive_response_is_retained_without_searching_for_better_settings(client):
    current = incident()
    plan = propose(
        client,
        current,
        controls={"severity": 0, "delivery_ratio": 1, "material_ratio": 1},
        factors=[{"name": "delivery_ratio", "levels": [0.8, 1.2]}],
        repetitions=1,
    )
    approved = command_plan(client, current, plan, "approve")
    result = command_plan(client, current, approved, "run")
    assert result["status"] == "completed"
    assert result["analysis"]["outcome"] == "inconclusive"
    assert len(result["results"]) == 9
    assert result["proposal"] == plan["proposal"]
    assert all(
        abs(row["contrast_from_baseline"]) < 1e-12
        for row in result["results"]
        if row["condition"]["baseline"]
    )


@pytest.mark.parametrize("change_before", ["approve", "run"])
def test_evidence_change_withdraws_old_approval_without_executing(
    client, monkeypatch, change_before
):
    current = incident()
    plan = propose(client, current)
    if change_before == "run":
        plan = command_plan(client, current, plan, "approve")
    changed = add_context(current)

    def forbidden(*args):
        raise AssertionError("A stale plan must not execute")

    monkeypatch.setattr(simulation, "simulate", forbidden)
    response = client.post(
        f"/api/incidents/{current.id}/experiments/{plan['id']}/{change_before}",
        json={"revision": plan["revision"]},
        headers=HEADERS,
    )
    assert response.status_code == 409
    saved = client.get(f"/api/incidents/{current.id}/experiments", headers=HEADERS).json()[0]
    assert saved["status"] == "withdrawn" and saved["source_current"] is False
    assert saved["results"] == [] and saved["source_fingerprint"] == plan["source_fingerprint"]
    assert saved["history"][-1]["action"] == "withdraw"
    assert propose(client, changed)["id"] != plan["id"]


def test_partial_model_failure_stops_and_retains_original_conditions(client, monkeypatch):
    current = incident()
    plan = command_plan(client, current, propose(client, current), "approve")
    original = simulation.simulate
    count = 0

    def fail_third(*args):
        nonlocal count
        count += 1
        if count == 3:
            raise ValueError("Synthetic test simulator failure")
        return original(*args)

    monkeypatch.setattr(simulation, "simulate", fail_third)
    result = command_plan(client, current, plan, "run")
    assert result["status"] == "withdrawn"
    assert result["analysis"]["outcome"] == "inconclusive"
    assert len(result["results"]) == 2 and count == 3
    assert result["matrix"] == plan["matrix"]
    assert (
        client.post(
            f"/api/incidents/{current.id}/experiments/{plan['id']}/run",
            json={"revision": result["revision"]},
            headers=HEADERS,
        ).status_code
        == 409
    )
    assert count == 3


def test_limits_reject_physical_parameters_nonfinite_and_excessive_runs(client):
    current = incident()
    path = f"/api/incidents/{current.id}/experiments"
    for change in [
        {"factors": [{"name": "pressure_bar", "levels": [1, 2]}]},
        {"factors": [{"name": "delivery_ratio", "levels": [0.7, 1.2]}]},
        {"factors": [{"name": "severity", "levels": [0.1, 0.1]}]},
        {"repetitions": 4},
        {"controls": {"severity": 0.7, "delivery_ratio": 2, "material_ratio": 1}},
        {
            "factors": [
                {"name": name, "levels": levels}
                for name, levels in [
                    ("severity", [0, 0.5, 1]),
                    ("delivery_ratio", [0.8, 1, 1.2]),
                    ("material_ratio", [0.8, 1, 1.2]),
                ]
            ],
            "repetitions": 3,
        },
    ]:
        assert (
            client.post(path, json=payload(current, **change), headers=HEADERS).status_code == 422
        )
    for value in [float("nan"), float("inf"), float("-inf")]:
        with pytest.raises(ValidationError):
            ExperimentFactor(name="severity", levels=[0, value])


def test_live_or_mixed_actual_data_is_not_executable_as_mock(client):
    current = incident()
    mixed = add_context(current, synthetic=False)
    assert (
        client.post(
            f"/api/incidents/{current.id}/experiments", json=payload(mixed), headers=HEADERS
        ).status_code
        == 422
    )
    request = replay_request("live-test-002")
    request.mode = "live"
    live = create_incident(request)
    assert (
        client.post(
            f"/api/incidents/{live.id}/experiments", json=payload(live), headers=HEADERS
        ).status_code
        == 422
    )


def test_completed_plan_keeps_historical_results_after_later_evidence_change(client):
    current = incident()
    approved = command_plan(client, current, propose(client, current), "approve")
    completed = command_plan(client, current, approved, "run")
    add_context(current)
    saved = client.get(f"/api/incidents/{current.id}/experiments", headers=HEADERS).json()[0]
    assert saved["status"] == "completed" and saved["source_current"] is False
    assert saved["results"] == completed["results"]
    assert command_plan(client, current, completed, "run")["results"] == completed["results"]
