"""Approved factorial experiments over a toy simulator, never physical machine settings."""

import hashlib
import json
import math
from datetime import UTC, datetime
from itertools import product
from statistics import mean
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from pydantic import Field, model_validator
from sqlalchemy import JSON, Integer, String, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from flowpilot.incidents import simulation
from flowpilot.incidents.access import Actor, require_permission
from flowpilot.incidents.diagnostic import SourcePassage, is_s932, search_sources
from flowpilot.incidents.models import Incident, IncidentEvidence, IncidentObservation
from flowpilot.incidents.service import (
    IncidentRecord,
    active_evidence,
    active_observations,
    database_operation,
    load_incident,
)
from flowpilot.incidents.simulation import (
    Scenario,
    SimulationParameters,
    SimulationRequest,
    SimulationRun,
)
from flowpilot.investigations.models import Contract
from flowpilot.persistence.database import Base

FactorName = Literal["severity", "delivery_ratio", "material_ratio"]
ResponseName = Literal["relative_mass", "coverage_fraction"]
DOMAIN = {"severity": (0.0, 1.0), "delivery_ratio": (0.8, 1.2), "material_ratio": (0.8, 1.2)}
CHECK_HYPOTHESIS = {
    "delivery_review": "unstable_delivery",
    "restriction_review": "restriction",
    "material_review": "material_condition",
}


class ExperimentFactor(Contract):
    name: FactorName
    levels: list[float] = Field(min_length=2, max_length=3)

    @model_validator(mode="after")
    def finite_allowed_levels(self):
        low, high = DOMAIN[self.name]
        if any(not math.isfinite(value) or not low <= value <= high for value in self.levels):
            raise ValueError(
                "Factor levels must be finite and inside the illustrative model domain."
            )
        if len(set(self.levels)) != len(self.levels):
            raise ValueError("Factor levels must be distinct.")
        self.levels = sorted(self.levels)
        return self


class ExperimentProposal(Contract):
    incident_revision: int = Field(ge=0)
    check_id: Literal["delivery_review", "restriction_review", "material_review"]
    hypothesis_ids: list[Scenario] = Field(min_length=1, max_length=3)
    factors: list[ExperimentFactor] = Field(min_length=1, max_length=3)
    controls: SimulationParameters = Field(default_factory=SimulationParameters)
    repetitions: int = Field(default=1, ge=1, le=3)
    response: ResponseName = "relative_mass"
    expected_discrimination: str = Field(
        default="Compare hypothetical response changes across the selected competing mechanisms.",
        min_length=1,
        max_length=2000,
        pattern=r"[\s\S]*\S[\s\S]*",
    )

    @model_validator(mode="after")
    def bounded_design(self):
        if len(set(self.hypothesis_ids)) != len(self.hypothesis_ids):
            raise ValueError("Hypothesis IDs must be distinct.")
        if len({factor.name for factor in self.factors}) != len(self.factors):
            raise ValueError("A factor may appear only once.")
        if CHECK_HYPOTHESIS[self.check_id] not in self.hypothesis_ids:
            raise ValueError("The selected check's hypothesis must be included in the comparison.")
        if planned_count(self) > 54:
            raise ValueError(
                "The complete plan, including baselines, must contain at most 54 runs."
            )
        return self


class ExperimentCommand(Contract):
    revision: int = Field(ge=1)


class ExperimentWithdrawal(ExperimentCommand):
    notes: str = Field(min_length=1, max_length=2000, pattern=r"[\s\S]*\S[\s\S]*")


class ExperimentCondition(Contract):
    index: int
    hypothesis_id: Scenario
    repetition: int
    baseline: bool
    parameters: SimulationParameters


class ExperimentResult(Contract):
    condition: ExperimentCondition
    response_mean: float
    contrast_from_baseline: float
    run: SimulationRun


class ExperimentEffect(Contract):
    hypothesis_id: Scenario
    factor: FactorName
    low_level: float
    high_level: float
    low_mean: float
    high_mean: float
    main_effect: float


class ExperimentAnalysis(Contract):
    outcome: Literal["simulated_difference", "inconclusive"]
    summary: str
    effects: list[ExperimentEffect]
    response_aggregation: Literal["arithmetic mean over all 13 normalized sequence positions"] = (
        "arithmetic mean over all 13 normalized sequence positions"
    )
    demonstration_contrast_threshold: float = 0.02
    threshold_validated_for_machine: Literal[False] = False
    diagnostic_confirmation: Literal[False] = False
    limitations: list[str]


class ExperimentEvent(Contract):
    action: Literal["propose", "approve", "start", "complete", "withdraw"]
    actor: str
    timestamp: str
    detail: str


class IncidentExperiment(Contract):
    id: str
    revision: int = 1
    plan_revision: Literal[1] = 1
    incident_id: str
    source_incident_revision: int
    source_fingerprint: str
    source_current: bool = True
    source_evidence: list[IncidentEvidence]
    source_observations: list[IncidentObservation]
    proposal: ExperimentProposal
    source_passage: SourcePassage
    domain: Literal["synthetic_only"] = "synthetic_only"
    synthetic: Literal[True] = True
    physical_execution_allowed: Literal[False] = False
    model_version: str
    fixture_version: str
    prerequisites: list[str]
    responsible_role: Literal["authorized mock-experiment reviewer"] = (
        "authorized mock-experiment reviewer"
    )
    analysis_plan: Literal[
        "factorial main effects and contrasts against a per-hypothesis baseline"
    ] = "factorial main effects and contrasts against a per-hypothesis baseline"
    stopping_conditions: list[str]
    matrix: list[ExperimentCondition]
    status: Literal["proposed", "approved", "running", "completed", "withdrawn"] = "proposed"
    approved_by: str | None = None
    approved_at: str | None = None
    run_started_at: str | None = None
    # Updated as each condition is saved; a run that stops updating can be resumed.
    run_heartbeat_at: str | None = None
    results: list[ExperimentResult] = Field(default_factory=list)
    analysis: ExperimentAnalysis | None = None
    history: list[ExperimentEvent]


class ExperimentRecord(Base):
    __tablename__ = "incident_experiments"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    incident_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    proposal_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


def timestamp():
    return datetime.now(UTC).isoformat()


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def source_fingerprint(incident: Incident):
    return fingerprint(
        {
            "configuration": incident.configuration,
            "mode": incident.mode,
            "evidence": [item.model_dump(mode="json") for item in active_evidence(incident)],
            "observations": [
                item.model_dump(mode="json") for item in active_observations(incident)
            ],
        }
    )


def planned_count(proposal: ExperimentProposal):
    return len(proposal.hypothesis_ids) * (
        math.prod(len(factor.levels) for factor in proposal.factors) * proposal.repetitions + 1
    )


def build_matrix(proposal: ExperimentProposal) -> list[ExperimentCondition]:
    matrix = []
    for hypothesis in proposal.hypothesis_ids:
        matrix.append(
            ExperimentCondition(
                index=len(matrix) + 1,
                hypothesis_id=hypothesis,
                repetition=0,
                baseline=True,
                parameters=proposal.controls,
            )
        )
        for levels in product(*(factor.levels for factor in proposal.factors)):
            parameters = proposal.controls.model_dump()
            parameters.update(
                {factor.name: value for factor, value in zip(proposal.factors, levels, strict=True)}
            )
            for repetition in range(1, proposal.repetitions + 1):
                matrix.append(
                    ExperimentCondition(
                        index=len(matrix) + 1,
                        hypothesis_id=hypothesis,
                        repetition=repetition,
                        baseline=False,
                        parameters=SimulationParameters(**parameters),
                    )
                )
    return matrix


def load_plan(session, incident_id: str, plan_id: str):
    row = session.get(ExperimentRecord, plan_id)
    if row is None or row.incident_id != incident_id:
        raise HTTPException(404, "Mock experiment not found for this incident.")
    return IncidentExperiment.model_validate(row.payload)


def ensure_mock(incident: Incident):
    if incident.mode not in {"synthetic", "replay"} or not is_s932(incident.configuration):
        raise HTTPException(422, "Mock experiments require an S932 synthetic or replay incident.")
    if any(not item.synthetic for item in incident.evidence) or any(
        not item.synthetic for item in incident.observations
    ):
        raise HTTPException(422, "The complete incident package must be explicitly synthetic.")


def current_source(plan: IncidentExperiment, incident: Incident):
    return (
        plan.source_fingerprint == source_fingerprint(incident)
        and plan.model_version == simulation.MODEL_VERSION
        and plan.fixture_version == simulation.FIXTURE_VERSION
    )


def save_plan(session, plan: IncidentExperiment, expected_revision: int):
    result = session.execute(
        update(ExperimentRecord)
        .where(
            ExperimentRecord.id == plan.id,
            ExperimentRecord.revision == expected_revision,
        )
        .values(revision=plan.revision, payload=plan.model_dump(mode="json"))
    )
    if result.rowcount != 1:
        raise HTTPException(409, "Experiment changed; reload before continuing.")


def withdraw_stale(session, plan: IncidentExperiment, incident: Incident, actor: str):
    if current_source(plan, incident):
        return False
    previous_revision = plan.revision
    plan.source_current = False
    plan.status = "withdrawn"
    plan.revision += 1
    plan.history.append(
        ExperimentEvent(
            action="withdraw",
            actor=actor,
            timestamp=timestamp(),
            detail="Evidence, observations or model changed; propose and approve a new plan.",
        )
    )
    save_plan(session, plan, previous_revision)
    return True


def propose(incident_id: str, request: ExperimentProposal, actor: str):
    def create(session):
        incident = load_incident(session, incident_id)
        if incident.revision != request.incident_revision:
            raise HTTPException(409, "Incident changed; reload before proposing the experiment.")
        ensure_mock(incident)
        source = source_fingerprint(incident)
        identity = fingerprint([incident_id, source, request.model_dump(mode="json")])
        existing = session.scalar(
            select(ExperimentRecord).where(ExperimentRecord.proposal_key == identity)
        )
        if existing:
            return IncidentExperiment.model_validate(existing.payload)
        passage = next(
            item
            for item in search_sources(configuration=incident.configuration)
            if item.id == "s932-replay"
        )
        plan = IncidentExperiment(
            id=f"DOE-{uuid4().hex[:12]}",
            incident_id=incident_id,
            source_incident_revision=incident.revision,
            source_fingerprint=source,
            source_evidence=active_evidence(incident),
            source_observations=active_observations(incident),
            proposal=request,
            source_passage=passage,
            model_version=simulation.MODEL_VERSION,
            fixture_version=simulation.FIXTURE_VERSION,
            matrix=build_matrix(request),
            prerequisites=[
                "Synthetic incident evidence only; no physical execution is available.",
                "Review the fixed matrix, input domain and source/model limitations.",
                "Obtain separate authorization for this mock plan before execution.",
            ],
            stopping_conditions=[
                "Stop if the incident evidence or observations change.",
                "Stop on a model/domain error; preserve partial responses as inconclusive.",
                "Execute the approved matrix once; never search until a desired result appears.",
            ],
            history=[
                ExperimentEvent(
                    action="propose",
                    actor=actor,
                    timestamp=timestamp(),
                    detail="Immutable synthetic factorial plan proposed.",
                )
            ],
        )
        session.add(
            ExperimentRecord(
                id=plan.id,
                incident_id=incident_id,
                proposal_key=identity,
                revision=1,
                payload=plan.model_dump(mode="json"),
            )
        )
        session.flush()
        return plan

    try:
        return database_operation(create)
    except IntegrityError:
        return database_operation(create)


def analyze_results(plan: IncidentExperiment, incomplete: bool = False):
    effects = []
    for hypothesis in plan.proposal.hypothesis_ids:
        rows = [
            row
            for row in plan.results
            if row.condition.hypothesis_id == hypothesis and not row.condition.baseline
        ]
        for factor in plan.proposal.factors:
            low, high = min(factor.levels), max(factor.levels)
            low_values = [
                row.response_mean
                for row in rows
                if getattr(row.condition.parameters, factor.name) == low
            ]
            high_values = [
                row.response_mean
                for row in rows
                if getattr(row.condition.parameters, factor.name) == high
            ]
            if low_values and high_values:
                effects.append(
                    ExperimentEffect(
                        hypothesis_id=hypothesis,
                        factor=factor.name,
                        low_level=low,
                        high_level=high,
                        low_mean=mean(low_values),
                        high_mean=mean(high_values),
                        main_effect=mean(high_values) - mean(low_values),
                    )
                )
    single = len(plan.proposal.hypothesis_ids) == 1
    spreads = []
    for factor in plan.proposal.factors:
        values = [effect.main_effect for effect in effects if effect.factor == factor.name]
        if len(values) == len(plan.proposal.hypothesis_ids):
            # One mechanism is compared with its own baseline; several with each other.
            spreads.append(abs(values[0]) if single else max(values) - min(values))
    different = not incomplete and any(value > 0.02 for value in spreads)
    if single:
        summary = (
            "The toy mechanism responds to the tested factor in this fixed matrix. "
            "This does not identify the incident's cause."
            if different
            else "This matrix does not establish a distinguishable simulated response. "
            "No cause is confirmed."
        )
    else:
        summary = (
            "The toy mechanisms produce different main effects in this fixed matrix. "
            "This does not identify the incident's cause."
            if different
            else "This matrix does not establish a complete distinguishable simulated response. "
            "No cause is confirmed."
        )
    return ExperimentAnalysis(
        outcome="simulated_difference" if different else "inconclusive",
        effects=effects,
        summary=summary,
        limitations=[
            "All factors, controls, coefficients and responses are dimensionless mock values.",
            "The 0.02 contrast threshold is a demonstration choice, not a machine tolerance.",
            "Repeated runs are deterministic; they do not estimate physical variability "
            "or statistical significance.",
            "Main effects summarize this fixed matrix; interactions and extrapolation "
            "are not validated.",
            "Source PRD passages describe a prototype and cannot authorize equipment operations.",
        ],
    )


def approve_plan(incident_id: str, plan_id: str, request: ExperimentCommand, actor: str):
    def approve(session):
        incident = load_incident(session, incident_id)
        plan = load_plan(session, incident_id, plan_id)
        if plan.revision != request.revision:
            raise HTTPException(409, "Experiment changed; reload before approval.")
        if plan.status != "proposed":
            raise HTTPException(409, "Only a proposed mock plan can be approved.")
        if withdraw_stale(session, plan, incident, actor):
            return plan, True
        ensure_mock(incident)
        plan.revision += 1
        plan.status, plan.approved_by, plan.approved_at = "approved", actor, timestamp()
        plan.history.append(
            ExperimentEvent(
                action="approve",
                actor=actor,
                timestamp=timestamp(),
                detail="Approved only for the stored synthetic matrix.",
            )
        )
        save_plan(session, plan, request.revision)
        return plan, False

    plan, stale = database_operation(approve)
    if stale:
        raise HTTPException(409, "Source changed; the old plan was withdrawn. Propose a new plan.")
    return plan


LEASE_SECONDS = 30


def lease_expired(plan: IncidentExperiment):
    beat = plan.run_heartbeat_at or plan.run_started_at
    if beat is None:
        return True
    return (datetime.now(UTC) - datetime.fromisoformat(beat)).total_seconds() > LEASE_SECONDS


def start_run(incident_id: str, plan_id: str, request: ExperimentCommand, actor: str):
    """Move an approved plan to running. Returns the plan and whether work should start."""

    def start(session):
        incident = load_incident(session, incident_id)
        plan = load_plan(session, incident_id, plan_id)
        if plan.status == "completed":
            ensure_mock(incident)
            plan.source_current = current_source(plan, incident)
            return plan, False, False
        if plan.status == "running":
            # Never a second run: an unfinished one resumes only after its worker stopped.
            return plan, lease_expired(plan), False
        if plan.revision != request.revision or plan.status != "approved":
            raise HTTPException(409, "Approve the current mock plan before execution.")
        if withdraw_stale(session, plan, incident, actor):
            return plan, False, True
        ensure_mock(incident)
        result = session.execute(
            update(IncidentRecord)
            .where(
                IncidentRecord.id == incident_id,
                IncidentRecord.revision == incident.revision,
            )
            .values(revision=incident.revision)
        )
        if result.rowcount != 1:
            raise HTTPException(409, "Incident changed before execution; reload and review.")
        previous = plan.revision
        plan.revision += 1
        plan.status = "running"
        plan.run_started_at = plan.run_heartbeat_at = timestamp()
        plan.history.append(
            ExperimentEvent(
                action="start",
                actor=actor,
                timestamp=plan.run_started_at,
                detail="Started the approved mock matrix; each condition is saved as it finishes.",
            )
        )
        save_plan(session, plan, previous)
        return plan, True, False

    plan, work, stale = database_operation(start)
    if stale:
        raise HTTPException(409, "Source changed; the old plan was withdrawn without executing.")
    return plan, work


def finish_run(session, plan: IncidentExperiment, actor: str, reason: str | None):
    plan.analysis = analyze_results(plan, incomplete=reason is not None)
    plan.status = "withdrawn" if reason else "completed"
    plan.history.append(
        ExperimentEvent(
            action="withdraw" if reason else "complete",
            actor=actor,
            timestamp=timestamp(),
            detail=reason or "Executed the approved mock matrix once; diagnosis remains unchanged.",
        )
    )
    previous = plan.revision
    plan.revision += 1
    save_plan(session, plan, previous)


def run_next_condition(incident_id: str, plan_id: str, actor: str) -> bool:
    """Simulate and save one condition. Returns True when the run has ended."""

    def step(session):
        incident = load_incident(session, incident_id)
        plan = load_plan(session, incident_id, plan_id)
        if plan.status != "running":
            return True
        if not current_source(plan, incident):
            plan.source_current = False
            finish_run(
                session,
                plan,
                actor,
                "Evidence, observations or model changed during the run; "
                "partial responses retained as inconclusive.",
            )
            return True
        if len(plan.results) >= len(plan.matrix):
            finish_run(session, plan, actor, None)
            return True
        condition = plan.matrix[len(plan.results)]
        try:
            run = simulation.simulate(
                SimulationRequest(
                    scenario=condition.hypothesis_id,
                    parameters=condition.parameters,
                    evidence_ids=[
                        item.id for item in plan.source_evidence if item.status == "collected"
                    ],
                ),
                incident_id,
                plan.source_incident_revision,
            )
            response = mean(getattr(point, plan.proposal.response) for point in run.points)
            if not math.isfinite(response):
                raise ValueError("Non-finite simulated response")
        except Exception:
            # No automatic retry or new factor choices after a model failure.
            finish_run(
                session,
                plan,
                actor,
                "Simulator failed; partial responses retained as inconclusive.",
            )
            return True
        baseline = next(
            (
                row.response_mean
                for row in plan.results
                if row.condition.baseline and row.condition.hypothesis_id == condition.hypothesis_id
            ),
            response,
        )
        plan.results.append(
            ExperimentResult(
                condition=condition,
                response_mean=response,
                contrast_from_baseline=response - baseline,
                run=run,
            )
        )
        plan.run_heartbeat_at = timestamp()
        previous = plan.revision
        plan.revision += 1
        save_plan(session, plan, previous)
        return False

    return database_operation(step)


def continue_run(incident_id: str, plan_id: str, actor: str):
    """Background work: one saved condition per transaction until the run ends."""
    try:
        while not run_next_condition(incident_id, plan_id, actor):
            pass
    except HTTPException:
        # Another worker saved first (resumed run); it owns the remaining conditions.
        return


router = APIRouter(prefix="/api/incidents", tags=["mock factorial experiments"])
ViewActor = Annotated[Actor, Depends(require_permission("view"))]
EditActor = Annotated[Actor, Depends(require_permission("edit"))]
AuthorizeActor = Annotated[Actor, Depends(require_permission("authorize_test"))]


@router.get("/{incident_id}/experiments", response_model=list[IncidentExperiment])
def list_plans(incident_id: str, actor: ViewActor):
    def listing(session):
        incident = load_incident(session, incident_id)
        plans = [
            IncidentExperiment.model_validate(row.payload)
            for row in session.scalars(
                select(ExperimentRecord).where(ExperimentRecord.incident_id == incident_id)
            )
        ]
        for plan in plans:
            plan.source_current = current_source(plan, incident)
        return plans

    return database_operation(listing)


@router.post("/{incident_id}/experiments", response_model=IncidentExperiment, status_code=201)
def propose_plan(incident_id: str, request: ExperimentProposal, actor: EditActor):
    return propose(incident_id, request, actor.subject)


@router.post("/{incident_id}/experiments/{plan_id}/approve", response_model=IncidentExperiment)
def approve(incident_id: str, plan_id: str, request: ExperimentCommand, actor: AuthorizeActor):
    return approve_plan(incident_id, plan_id, request, actor.subject)


@router.post(
    "/{incident_id}/experiments/{plan_id}/run",
    response_model=IncidentExperiment,
    status_code=202,
)
def execute(
    incident_id: str,
    plan_id: str,
    request: ExperimentCommand,
    actor: EditActor,
    background: BackgroundTasks,
    response: Response,
):
    """Start the approved matrix; conditions are saved one by one in the background."""
    plan, work = start_run(incident_id, plan_id, request, actor.subject)
    if work:
        background.add_task(continue_run, incident_id, plan_id, actor.subject)
    if plan.status == "completed":
        response.status_code = 200
    return plan


@router.post("/{incident_id}/experiments/{plan_id}/withdraw", response_model=IncidentExperiment)
def withdraw(incident_id: str, plan_id: str, request: ExperimentWithdrawal, actor: AuthorizeActor):
    def revise(session):
        plan = load_plan(session, incident_id, plan_id)
        if plan.revision != request.revision:
            raise HTTPException(409, "Experiment changed; reload before withdrawal.")
        if plan.status == "completed":
            raise HTTPException(409, "Completed mock results are historical and cannot be erased.")
        plan.revision += 1
        plan.status = "withdrawn"
        plan.history.append(
            ExperimentEvent(
                action="withdraw", actor=actor.subject, timestamp=timestamp(), detail=request.notes
            )
        )
        save_plan(session, plan, request.revision)
        return plan

    return database_operation(revise)
