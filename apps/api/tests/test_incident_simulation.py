import numpy as np
import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from flowpilot.incidents import service, simulation
from flowpilot.incidents.models import CreateIncident
from flowpilot.incidents.replay import replay_request
from flowpilot.settings import ROOT
from pydantic import ValidationError


def test_three_mechanisms_produce_distinct_labelled_synthetic_responses():
    runs = [
        simulation.simulate(simulation.SimulationRequest(scenario=scenario))
        for scenario in simulation.SCENARIOS
    ]
    assert len({tuple(point.relative_mass for point in run.points) for run in runs}) == 3
    restriction, delivery, material = runs
    assert restriction.points[-1].relative_mass < restriction.points[0].relative_mass
    assert material.points[-1].relative_mass < material.points[0].relative_mass
    delivery_mass = [point.relative_mass for point in delivery.points]
    assert any(left < right for left, right in zip(delivery_mass, delivery_mass[1:]))
    assert any(left > right for left, right in zip(delivery_mass, delivery_mass[1:]))
    for run in runs:
        assert run.status == "simulated" and run.domain == "synthetic_only"
        assert not run.approved_for_diagnosis
        assert len(run.points) == 13 and run.assumptions and run.validity_limits
        assert all(0 <= point.coverage_fraction <= 1 for point in run.points)
        assert all(0 <= point.learned_coverage_fraction <= 1 for point in run.points)


def test_model_fit_holds_out_incidents_and_conditions_and_beats_constant_baseline():
    coefficients, evaluation = simulation.fit_fixture_models()
    assert set(coefficients) == set(simulation.SCENARIOS)
    assert not set(evaluation.training_incident_ids) & set(evaluation.heldout_incident_ids)
    assert not set(evaluation.training_condition_ids) & set(evaluation.heldout_condition_ids)
    assert evaluation.training_samples == 1560 and evaluation.heldout_samples == 351
    assert evaluation.heldout_metrics.relative_mass_mae < (
        evaluation.constant_baseline_heldout_metrics.relative_mass_mae
    )
    assert evaluation.heldout_metrics.coverage_fraction_mae < (
        evaluation.constant_baseline_heldout_metrics.coverage_fraction_mae
    )
    assert evaluation.synthetic_acceptance_passed and not evaluation.real_machine_validated


def test_heldout_targets_cannot_change_fitted_coefficients(monkeypatch):
    original = {key: value.copy() for key, value in simulation.fit_fixture_models()[0].items()}
    samples = simulation.synthetic_samples

    def changed_heldout(split):
        records = samples(split)
        if split == "heldout":
            for record in records:
                record["targets"] = record["targets"] * 10
        return records

    monkeypatch.setattr(simulation, "synthetic_samples", changed_heldout)
    simulation.fit_fixture_models.cache_clear()
    try:
        fitted, evaluation = simulation.fit_fixture_models()
        for key in original:
            np.testing.assert_array_equal(fitted[key], original[key])
        assert not evaluation.synthetic_acceptance_passed
    finally:
        simulation.fit_fixture_models.cache_clear()


@pytest.mark.parametrize(
    "parameters",
    [
        {"severity": 1.01},
        {"delivery_ratio": 2},
        {"material_ratio": 0.5},
        {"severity": float("nan")},
        {"delivery_ratio": float("inf")},
    ],
)
def test_parameters_cannot_extrapolate_outside_fixture_domain(parameters):
    with pytest.raises(ValidationError):
        simulation.SimulationParameters(**parameters)


def test_simulation_api_preserves_diagnosis_and_rejects_missing_or_stale_context(
    tmp_path, monkeypatch
):
    url = f"sqlite:///{tmp_path / 'simulation.db'}"
    monkeypatch.setenv("FLOWPILOT_DATABASE_URL", url)
    monkeypatch.setenv("FLOWPILOT_INCIDENT_AUTH_MODE", "demo")
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    incident = service.create_incident(replay_request("simulation-replay"))
    app = FastAPI()
    app.include_router(simulation.router)
    with TestClient(app) as client:
        card = client.get("/api/incident-simulation/demo")
        assert card.status_code == 200
        assert card.json()["approved_for_diagnosis"] is False
        assert len(card.json()["scenarios"]) == 3
        endpoint = f"/api/incidents/{incident.id}/simulation"
        body = {
            "scenario": "restriction",
            "evidence_ids": ["image-good"],
            "revision": incident.revision,
        }
        assert (
            client.post(endpoint, json=body, headers={"X-Incident-Role": "viewer"}).status_code
            == 403
        )
        assert (
            client.post(endpoint, json={**body, "evidence_ids": ["pm-unavailable"]}).status_code
            == 422
        )
        assert (
            client.post(endpoint, json={**body, "approved_for_diagnosis": True}).status_code == 422
        )
        response = client.post(endpoint, json=body)
        assert response.status_code == 200, response.text
        run = response.json()
        saved = service.get_incident(incident.id)
        assert len(saved.simulations) == 1 and saved.simulations[0].id == run["id"]
        assert saved.assessment == incident.assessment
        assert saved.evidence == incident.evidence and saved.observations == incident.observations
        assert saved.status == incident.status and saved.disposition == "not_assessed"
        assert run["source_revision"] == incident.revision
        assert client.post(endpoint, json=body).status_code == 409
        other = service.create_incident(
            CreateIncident(trigger_id="other", configuration="TCB bonder")
        )
        assert (
            client.post(
                f"/api/incidents/{other.id}/simulation", json={"scenario": "restriction"}
            ).status_code
            == 422
        )
