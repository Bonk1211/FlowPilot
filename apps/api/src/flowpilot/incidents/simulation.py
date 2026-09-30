"""Illustrative synthetic subsystem responses and a small held-out regression evaluation.

The equations below are invented demonstration assumptions, not S932 physics or calibration.
"""

from datetime import UTC, datetime
from functools import lru_cache
from itertools import combinations_with_replacement
from typing import Literal
from uuid import uuid4

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field

from flowpilot.incidents.access import Actor, require_permission
from flowpilot.investigations.models import Contract

Scenario = Literal["restriction", "unstable_delivery", "material_condition"]
MODEL_VERSION = "s932-illustrative-surrogate-1"
FIXTURE_VERSION = "synthetic-flux-fixture-1"
SCENARIOS = ("restriction", "unstable_delivery", "material_condition")
COMPONENTS = {
    "restriction": ["pickup_tube", "feed_tube", "fluid_qd", "nozzle"],
    "unstable_delivery": ["bfs_bottle", "bfs_air", "pickup_tube", "fluid_qd"],
    "material_condition": ["bfs_bottle", "feed_tube", "dj2200_valve", "nozzle"],
}
ASSUMPTIONS = [
    "All model inputs, coefficients and training targets are invented development fixtures.",
    "Relative mass compares output to an arbitrary synthetic reference, not measured milligrams.",
    "Coverage fraction is an illustrative scalar; it does not reconstruct an actual spray image.",
    "Restriction and material resistance grow along the sequence; delivery instability oscillates.",
    "Delivery, valve-actuation and atomizing-air paths are distinct; "
    "only a toy delivery response is modelled.",
]
LIMITS = [
    "No real-machine training, calibration or validation has been performed.",
    "A synthetic held-out pass does not approve diagnosis, operating settings, repair or release.",
    "Evidence references identify incident context only; "
    "parameters are not inferred sensor measurements.",
    "Use only severity 0–1 and delivery/material ratios 0.8–1.2; no extrapolation is supported.",
    "Geometry, material rheology, atomization, temperatures and valve dynamics are not calibrated.",
]
UNITS = {
    "severity": "dimensionless illustrative fault strength",
    "delivery_ratio": "dimensionless relative to synthetic delivery reference",
    "material_ratio": "dimensionless relative to synthetic material resistance reference",
    "position": "normalized sequence position, not elapsed seconds",
    "relative_mass": "dimensionless relative to synthetic deposited-mass reference",
    "coverage_fraction": "dimensionless fraction, 0–1",
}


class SimulationParameters(Contract):
    severity: float = Field(default=0.7, ge=0, le=1, allow_inf_nan=False)
    delivery_ratio: float = Field(default=1, ge=0.8, le=1.2, allow_inf_nan=False)
    material_ratio: float = Field(default=1, ge=0.8, le=1.2, allow_inf_nan=False)


class SimulationRequest(Contract):
    scenario: Scenario
    parameters: SimulationParameters = Field(default_factory=SimulationParameters)
    evidence_ids: list[str] = Field(default_factory=list, max_length=100)
    revision: int | None = Field(default=None, ge=0)


class SimulationPoint(Contract):
    step: int
    position: float
    relative_mass: float
    coverage_fraction: float
    learned_relative_mass: float
    learned_coverage_fraction: float


class SimulationRun(Contract):
    id: str
    incident_id: str
    source_revision: int
    scenario: Scenario
    model_version: str = MODEL_VERSION
    fixture_version: str = FIXTURE_VERSION
    domain: Literal["synthetic_only"] = "synthetic_only"
    status: Literal["simulated"] = "simulated"
    approved_for_diagnosis: Literal[False] = False
    parameters: SimulationParameters
    units: dict[str, str]
    points: list[SimulationPoint]
    component_ids: list[str]
    evidence_ids: list[str]
    assumptions: list[str]
    validity_limits: list[str]
    created_at: str


class ErrorMetrics(Contract):
    relative_mass_mae: float
    coverage_fraction_mae: float
    relative_mass_max_error: float
    coverage_fraction_max_error: float


class SyntheticEvaluation(Contract):
    training_incident_ids: list[str]
    heldout_incident_ids: list[str]
    training_condition_ids: list[str]
    heldout_condition_ids: list[str]
    training_samples: int
    heldout_samples: int
    split_method: str
    training_metrics: ErrorMetrics
    heldout_metrics: ErrorMetrics
    constant_baseline_heldout_metrics: ErrorMetrics
    per_scenario_heldout_metrics: dict[str, ErrorMetrics]
    accepted_error_tolerance: dict[str, float]
    synthetic_acceptance_passed: bool
    real_machine_validated: Literal[False] = False


class SimulationDemo(Contract):
    model_version: str = MODEL_VERSION
    fixture_version: str = FIXTURE_VERSION
    status: Literal["simulated"] = "simulated"
    domain: Literal["synthetic_only"] = "synthetic_only"
    approved_for_diagnosis: Literal[False] = False
    method: str
    input_domain: dict[str, list[float]]
    equations: dict[str, str]
    assumptions: list[str]
    validity_limits: list[str]
    evaluation: SyntheticEvaluation
    scenarios: list[SimulationRun]


def fixture_response(scenario: Scenario, parameters: SimulationParameters):
    """13 synthetic sequence positions; these numbers are not machine sensor readings."""
    position = np.linspace(0, 1, 13)
    severity = parameters.severity
    nominal = parameters.delivery_ratio / parameters.material_ratio
    if scenario == "restriction":
        mass = nominal * (1 - 0.65 * severity * position)
    elif scenario == "unstable_delivery":
        mass = nominal * (1 - 0.45 * severity * (0.5 + 0.5 * np.sin(6 * np.pi * position)))
    else:
        mass = nominal / (1 + 0.8 * severity * position)
    coverage = np.clip(0.98 * np.sqrt(mass), 0, 1)
    return position, np.column_stack((mass, coverage))


def features(parameters: SimulationParameters, positions):
    raw = np.column_stack(
        (
            np.full(len(positions), parameters.delivery_ratio),
            np.full(len(positions), parameters.material_ratio),
            np.full(len(positions), parameters.severity),
            positions,
            np.sin(6 * np.pi * positions),
        )
    )
    return np.column_stack(
        (
            np.ones(len(positions)),
            raw,
            *[
                raw[:, left] * raw[:, right]
                for left, right in combinations_with_replacement(range(5), 2)
            ],
        )
    )


def synthetic_samples(split: Literal["train", "heldout"]):
    """Incident and complete operating-condition groups are separated before fitting."""
    if split == "train":
        conditions = [
            (d, m) for d in (0.8, 1.0, 1.2) for m in (0.8, 1.0, 1.2) if (d, m) != (1.0, 1.0)
        ]
        severities = (0, 0.25, 0.5, 0.75, 1)
    else:
        conditions = [(0.9, 1.1), (1.0, 1.0), (1.1, 0.9)]
        severities = (0.15, 0.45, 0.85)
    samples = []
    for scenario in SCENARIOS:
        for delivery, material in conditions:
            condition_id = f"delivery-{delivery:.2f}_material-{material:.2f}"
            for severity in severities:
                parameters = SimulationParameters(
                    severity=severity,
                    delivery_ratio=delivery,
                    material_ratio=material,
                )
                positions, targets = fixture_response(scenario, parameters)
                samples.append(
                    {
                        "incident_id": f"{split}-{scenario}-{condition_id}-severity-{severity:.2f}",
                        "condition_id": condition_id,
                        "scenario": scenario,
                        "features": features(parameters, positions),
                        "targets": targets,
                    }
                )
    return samples


def clip_predictions(predictions):
    return np.column_stack((np.clip(predictions[:, 0], 0, 1.5), np.clip(predictions[:, 1], 0, 1)))


def metrics(targets, predictions) -> ErrorMetrics:
    error = np.abs(targets - predictions)
    return ErrorMetrics(
        relative_mass_mae=float(error[:, 0].mean()),
        coverage_fraction_mae=float(error[:, 1].mean()),
        relative_mass_max_error=float(error[:, 0].max()),
        coverage_fraction_max_error=float(error[:, 1].max()),
    )


@lru_cache(maxsize=1)
def fit_fixture_models():
    # ponytail: tiny built-in dataset fit once; real calibration needs a separate reviewed dataset.
    training, heldout = synthetic_samples("train"), synthetic_samples("heldout")
    coefficients, baselines = {}, {}
    train_targets, train_predictions, test_targets, test_predictions, baseline_predictions = (
        [],
        [],
        [],
        [],
        [],
    )
    per_scenario = {}
    for scenario in SCENARIOS:
        train = [item for item in training if item["scenario"] == scenario]
        test = [item for item in heldout if item["scenario"] == scenario]
        x_train = np.vstack([item["features"] for item in train])
        y_train = np.vstack([item["targets"] for item in train])
        x_test = np.vstack([item["features"] for item in test])
        y_test = np.vstack([item["targets"] for item in test])
        coefficient, *_ = np.linalg.lstsq(x_train, y_train, rcond=None)
        coefficients[scenario] = coefficient
        baselines[scenario] = y_train.mean(axis=0)
        predicted = clip_predictions(x_test @ coefficient)
        train_targets.append(y_train)
        train_predictions.append(clip_predictions(x_train @ coefficient))
        test_targets.append(y_test)
        test_predictions.append(predicted)
        baseline_predictions.append(np.tile(baselines[scenario], (len(y_test), 1)))
        per_scenario[scenario] = metrics(y_test, predicted)
    heldout_metrics = metrics(np.vstack(test_targets), np.vstack(test_predictions))
    baseline_metrics = metrics(np.vstack(test_targets), np.vstack(baseline_predictions))
    tolerance = {"relative_mass_mae": 0.08, "coverage_fraction_mae": 0.06}
    evaluation = SyntheticEvaluation(
        training_incident_ids=[item["incident_id"] for item in training],
        heldout_incident_ids=[item["incident_id"] for item in heldout],
        training_condition_ids=sorted({item["condition_id"] for item in training}),
        heldout_condition_ids=sorted({item["condition_id"] for item in heldout}),
        training_samples=sum(len(item["targets"]) for item in training),
        heldout_samples=sum(len(item["targets"]) for item in heldout),
        split_method="Entire incidents and operating-condition pairs held out before fitting; "
        "held-out severity levels also differ. All samples come from one toy generator.",
        training_metrics=metrics(np.vstack(train_targets), np.vstack(train_predictions)),
        heldout_metrics=heldout_metrics,
        constant_baseline_heldout_metrics=baseline_metrics,
        per_scenario_heldout_metrics=per_scenario,
        accepted_error_tolerance=tolerance,
        synthetic_acceptance_passed=(
            heldout_metrics.relative_mass_mae <= tolerance["relative_mass_mae"]
            and heldout_metrics.coverage_fraction_mae <= tolerance["coverage_fraction_mae"]
            and heldout_metrics.relative_mass_mae < baseline_metrics.relative_mass_mae
            and heldout_metrics.coverage_fraction_mae < baseline_metrics.coverage_fraction_mae
        ),
    )
    return coefficients, evaluation


def simulate(
    request: SimulationRequest,
    incident_id: str = "SYNTHETIC-DEMO",
    source_revision: int = 0,
) -> SimulationRun:
    coefficients, _ = fit_fixture_models()
    positions, targets = fixture_response(request.scenario, request.parameters)
    predicted = clip_predictions(
        features(request.parameters, positions) @ coefficients[request.scenario]
    )
    return SimulationRun(
        id=f"SIM-{uuid4().hex[:12]}",
        incident_id=incident_id,
        source_revision=source_revision,
        scenario=request.scenario,
        parameters=request.parameters,
        units=UNITS,
        points=[
            SimulationPoint(
                step=index,
                position=float(position),
                relative_mass=float(target[0]),
                coverage_fraction=float(target[1]),
                learned_relative_mass=float(learned[0]),
                learned_coverage_fraction=float(learned[1]),
            )
            for index, (position, target, learned) in enumerate(
                zip(positions, targets, predicted, strict=True)
            )
        ],
        component_ids=COMPONENTS[request.scenario],
        evidence_ids=list(dict.fromkeys(request.evidence_ids)),
        assumptions=ASSUMPTIONS,
        validity_limits=LIMITS,
        created_at=datetime.now(UTC).isoformat(),
    )


router = APIRouter(tags=["illustrative incident simulation"])


@router.get("/api/incident-simulation/demo", response_model=SimulationDemo)
def demo(actor: Actor = Depends(require_permission("view"))):
    _, evaluation = fit_fixture_models()
    return SimulationDemo(
        method="Separate second-degree polynomial least-squares surrogates per scenario, "
        "fitted using numpy on an explicit synthetic response generator.",
        input_domain={
            "severity": [0, 1],
            "delivery_ratio": [0.8, 1.2],
            "material_ratio": [0.8, 1.2],
        },
        equations={
            "restriction": "relative_mass = delivery/material × (1 − 0.65 × severity × position)",
            "unstable_delivery": "relative_mass = delivery/material × "
            "(1 − 0.45 × severity × (0.5 + 0.5 sin(6π position)))",
            "material_condition": "relative_mass = delivery / "
            "(material × (1 + 0.8 × severity × position))",
            "coverage": "coverage_fraction = clip(0.98 × sqrt(relative_mass), 0, 1)",
        },
        assumptions=ASSUMPTIONS,
        validity_limits=LIMITS,
        evaluation=evaluation,
        scenarios=[simulate(SimulationRequest(scenario=scenario)) for scenario in SCENARIOS],
    )


@router.post("/api/incidents/{incident_id}/simulation", response_model=SimulationRun)
def record_simulation(
    incident_id: str,
    request: SimulationRequest,
    actor: Actor = Depends(require_permission("edit")),
):
    from flowpilot.incidents import service
    from flowpilot.incidents.diagnostic import is_s932
    from flowpilot.incidents.models import IncidentEvent

    incident = service.get_incident(incident_id)
    if not is_s932(incident.configuration):
        raise HTTPException(422, "This illustrative subsystem is scoped to an S932 incident.")
    if len(incident.simulations) >= 100:
        raise HTTPException(
            422, "The prototype supports at most 100 saved simulations per incident."
        )
    if request.revision is not None and request.revision != incident.revision:
        raise HTTPException(409, "Incident changed; reload before recording a simulation.")
    collected = {
        item.id for item in service.active_evidence(incident) if item.status == "collected"
    }
    if not set(request.evidence_ids) <= collected:
        raise HTTPException(422, "Simulation context must reference active collected evidence.")
    run = simulate(request, incident.id, incident.revision)
    previous_revision = incident.revision
    incident.simulations.append(run)
    incident.revision += 1
    incident.updated_at = service.now()
    incident.history.append(
        IncidentEvent(
            revision=incident.revision,
            action="record_simulation",
            timestamp=incident.updated_at,
            detail=f"Recorded {run.id}: {run.scenario}; synthetic only, not diagnostic evidence.",
            actor=actor.subject,
        )
    )
    service.save_incident(incident, previous_revision, actor.subject)
    return run
