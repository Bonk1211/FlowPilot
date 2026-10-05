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
    from flowpilot.incidents.routes import router as incident_router

    app.include_router(incident_router)
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


def saved_plan(client, current, plan_id):
    plans = client.get(f"/api/incidents/{current.id}/experiments", headers=HEADERS).json()
    return next(item for item in plans if item["id"] == plan_id)


def command_plan(client, current, plan, command, **fields):
    response = client.post(
        f"/api/incidents/{current.id}/experiments/{plan['id']}/{command}",
        json={"revision": plan["revision"], **fields},
        headers=HEADERS,
    )
    if command != "run":
        assert response.status_code == 200, response.text
        return response.json()
    # A run starts (202) and its conditions are saved by a background task, which the
    # test client completes before returning; a finished plan answers 200 unchanged.
    assert response.status_code in {200, 202}, response.text
    if response.status_code == 202:
        assert response.json()["status"] == "running"
    return saved_plan(client, current, plan["id"])


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


def single(current, hypothesis="restriction", check="restriction_review"):
    return {
        "hypothesis_ids": [hypothesis],
        "check_id": check,
        "repetitions": 1,
    }


def test_one_mechanism_plan_compares_with_its_own_baseline(client):
    current = incident()
    plan = propose(client, current, **single(current))
    assert propose(client, current, **single(current))["id"] == plan["id"]
    assert [row["baseline"] for row in plan["matrix"]] == [True, False, False]
    other = propose(client, current, **single(current, "unstable_delivery", "delivery_review"))
    assert other["id"] != plan["id"]
    mismatched = payload(current, **single(current, "unstable_delivery"))
    response = client.post(
        f"/api/incidents/{current.id}/experiments", json=mismatched, headers=EDITOR_HEADERS
    )
    assert response.status_code == 422
    done = command_plan(client, current, command_plan(client, current, plan, "approve"), "run")
    assert done["status"] == "completed"
    assert done["analysis"]["outcome"] == "simulated_difference"
    assert done["analysis"]["summary"].startswith("The toy mechanism responds")
    assert done["analysis"]["diagnostic_confirmation"] is False
    assert [event["action"] for event in done["history"]] == [
        "propose",
        "approve",
        "start",
        "complete",
    ]
    assert get_incident(current.id).observations == []


def test_conditions_are_saved_one_at_a_time_and_a_source_change_stops_the_run(client):
    from flowpilot.incidents import experiments

    current = incident()
    plan = command_plan(client, current, propose(client, current, **single(current)), "approve")
    started, work = experiments.start_run(
        current.id, plan["id"], experiments.ExperimentCommand(revision=plan["revision"]), "t"
    )
    assert work and started.status == "running" and started.results == []
    assert experiments.run_next_condition(current.id, plan["id"], "t") is False
    partway = saved_plan(client, current, plan["id"])
    assert partway["status"] == "running" and len(partway["results"]) == 1
    assert partway["run_heartbeat_at"] >= partway["run_started_at"]
    add_context(current)
    assert experiments.run_next_condition(current.id, plan["id"], "t") is True
    stopped = saved_plan(client, current, plan["id"])
    assert stopped["status"] == "withdrawn" and stopped["source_current"] is False
    assert len(stopped["results"]) == 1
    assert stopped["analysis"]["outcome"] == "inconclusive"
    assert "changed during the run" in stopped["history"][-1]["detail"]


def test_a_running_plan_is_never_run_twice_and_resumes_only_after_its_worker_stops(
    client, monkeypatch
):
    from flowpilot.incidents import experiments

    current = incident()
    plan = command_plan(client, current, propose(client, current, **single(current)), "approve")
    experiments.start_run(
        current.id, plan["id"], experiments.ExperimentCommand(revision=plan["revision"]), "t"
    )
    experiments.run_next_condition(current.id, plan["id"], "t")
    calls = []
    original = simulation.simulate
    monkeypatch.setattr(simulation, "simulate", lambda *a: calls.append(1) or original(*a))
    again = client.post(
        f"/api/incidents/{current.id}/experiments/{plan['id']}/run",
        json={"revision": plan["revision"]},
        headers=HEADERS,
    )
    assert again.status_code == 202 and again.json()["status"] == "running"
    assert calls == []  # The first worker still holds the run.
    monkeypatch.setattr(experiments, "LEASE_SECONDS", -1)
    resumed = command_plan(client, current, plan, "run")
    assert resumed["status"] == "completed" and len(calls) == 2
    assert [row["condition"] for row in resumed["results"]] == resumed["matrix"]


def with_mass_record(current):
    return act(
        current.id,
        AddEvidenceAction(
            action="add_evidence",
            revision=current.revision,
            evidence=EvidenceInput(
                id="mass-log",
                kind="log",
                role="machine_log",
                label="Falling mass",
                source_ref="test:mass",
                synthetic=True,
                values={
                    "mass_trend": "falling",
                    "samples": [{"mass_mg": value} for value in (12.0, 11.1, 10.3, 9.2)],
                    "units": {"mass": "mg"},
                },
            ),
        ),
    )


def run_single(client, current, hypothesis, check):
    plan = propose(client, current, **single(current, hypothesis, check))
    return command_plan(client, current, command_plan(client, current, plan, "approve"), "run")


def test_findings_compare_the_simulated_shape_with_the_records(client):
    current = with_mass_record(incident())
    restriction = run_single(client, current, "restriction", "restriction_review")
    unstable = run_single(client, current, "unstable_delivery", "delivery_review")
    (consistent,) = restriction["analysis"]["findings"]
    assert consistent["outcome"] == "consistent"
    assert consistent["label"] == "Simulated · consistent with the records"
    assert consistent["simulated_shape"] == "monotonic"
    assert consistent["suggested_check_id"] == "restriction_review"
    assert consistent["diagnostic_confirmation"] is False
    assert all(item["met"] for item in consistent["criteria"])
    assert "does not confirm fluid-path restriction" in consistent["summary"]
    assert "12.0 → 11.1 → 10.3 → 9.2 mg" in consistent["summary"]
    (opposite,) = unstable["analysis"]["findings"]
    assert opposite["outcome"] == "conflicts"
    assert opposite["simulated_shape"] == "oscillating"
    assert "does not rule the explanation out" in opposite["summary"]
    for finding in (consistent, opposite):
        assert "most likely" not in finding["summary"]
    # Without any shape record the simulation cannot be compared.
    other = create_incident(replay_request("doe-test-no-shape"))
    bare = run_single(client, other, "material_condition", "material_review")
    assert bare["analysis"]["findings"][0]["outcome"] == "not_distinguishable"


def test_only_a_current_consistent_finding_returns_and_nothing_becomes_evidence(client):
    current = with_mass_record(incident())
    before = get_incident(current.id)
    plan = run_single(client, current, "restriction", "restriction_review")
    other = run_single(client, current, "unstable_delivery", "delivery_review")
    path = f"/api/incidents/{current.id}/experiments"

    def send(item, decision, hypothesis):
        return client.post(
            f"{path}/{item['id']}/handback",
            json={"revision": item["revision"], "decision": decision, "hypothesis_id": hypothesis},
            headers=EDITOR_HEADERS,
        )

    returned = send(plan, "return", "restriction")
    assert returned.status_code == 200, returned.text
    body = returned.json()
    assert [item["decision"] for item in body["handbacks"]] == ["return"]
    assert body["handbacks"][0]["suggested_check_id"] == "restriction_review"
    assert body["history"][-1]["action"] == "return"
    # Asking again changes nothing.
    assert send(body, "return", "restriction").json()["revision"] == body["revision"]
    assert send(other, "return", "unstable_delivery").status_code == 409
    set_aside = send(other, "set_aside", "unstable_delivery")
    assert set_aside.status_code == 200
    assert set_aside.json()["handbacks"][0]["decision"] == "set_aside"
    after = get_incident(current.id)
    assert after.evidence == before.evidence and after.observations == before.observations
    assert after.assessment == before.assessment and after.revision == before.revision
    # Once the evidence changes, a finding can no longer be returned.
    fresh = run_single(client, current, "material_condition", "material_review")
    add_context(after)
    assert send(fresh, "return", "material_condition").status_code == 409


def test_technician_readings_are_atomic_durable_and_feed_the_investigation(client, monkeypatch):
    from copy import deepcopy

    from flowpilot.incidents import diagnostic
    from flowpilot.incidents.models import EXPERIMENT_STEP_TITLES

    current = incident()
    plan = propose(client, current)
    plan = command_plan(client, current, plan, "approve")
    plan = command_plan(client, current, plan, "run")
    steps = [
        {"step_id": step_id, "notes": f"Observed {title.lower()}."}
        for step_id, title in EXPERIMENT_STEP_TITLES.items()
    ]
    steps[0] = {"step_id": "establish", "quantity": "Supply pressure", "value": 0, "unit": "bar"}
    steps[2] = {"step_id": "apart", "condition": "damaged", "notes": "O-ring split on one side."}
    body = {
        "action": "record_experiment",
        "revision": current.revision,
        "observation_id": "OBS-technician-test",
        "readings": {"plan_id": plan["id"], "hypothesis_id": "restriction", "steps": steps},
    }
    path = f"/api/incidents/{current.id}/actions"
    # Missing, duplicated, empty or incomplete readings cannot be partially committed.
    invalid_steps = [steps[:-1], [steps[0]] * 8]
    for replacement in [
        {"step_id": "establish", "notes": "   "},
        {"step_id": "establish", "quantity": "Pressure", "value": 0},
        {"step_id": "establish", "quantity": "Pressure", "notes": "Missing value"},
        {"step_id": "establish", "condition": "not_applicable"},
        {"step_id": "establish", "quantity": "Pressure", "value": "Infinity", "unit": "bar"},
    ]:
        invalid_steps.append([replacement, *steps[1:]])
    for invalid in invalid_steps:
        request = deepcopy(body)
        request["readings"]["steps"] = invalid
        assert client.post(path, json=request, headers=EDITOR_HEADERS).status_code == 422
    assert get_incident(current.id).observations == []
    # A plan from another incident is never a valid source.
    other = create_incident(replay_request("other-reading-incident"))
    response = client.post(f"/api/incidents/{other.id}/actions", json=body, headers=EDITOR_HEADERS)
    assert response.status_code == 404
    seen = []
    analyze = diagnostic.analyze

    def capture(evidence, observations, configuration):
        seen.extend(observations)
        return analyze(evidence, observations, configuration)

    monkeypatch.setattr(diagnostic, "analyze", capture)
    response = client.post(path, json=body, headers=EDITOR_HEADERS)
    assert response.status_code == 200, response.text
    saved = get_incident(current.id)
    observation = saved.observations[0]
    assert observation.synthetic is False
    assert observation.author == "test:editor"
    assert observation.experiment.steps[0].value == 0
    assert observation.experiment.steps[0].unit == "bar"
    assert observation.experiment.steps[2].condition == "damaged"
    assert "O-ring split on one side." in observation.notes
    assert len(observation.experiment.steps) == 8
    assert any(item["id"] == observation.id and item["experiment"]["steps"] for item in seen)
    assert saved.assessment is not None
    assert all(item.status != "supported" for item in saved.assessment.hypotheses)
    # A retry after a lost response returns the same record, even at the old revision.
    response = client.post(path, json=body, headers=EDITOR_HEADERS)
    assert response.status_code == 200, response.text
    assert len(get_incident(current.id).observations) == 1
    changed = deepcopy(body)
    changed["readings"]["steps"][2]["notes"] = "Changed after submission"
    assert client.post(path, json=changed, headers=EDITOR_HEADERS).status_code == 409
    report = client.get(f"/api/incidents/{current.id}/report.md", headers=EDITOR_HEADERS)
    assert "Supply pressure: 0 bar" in report.text
    assert "O-ring split on one side." in report.text
