"""Shared, precomputed M0 storyboard. This is not a workflow execution engine."""

from typing import Literal

from pydantic import Field, model_validator

from flowpilot.diagnosis.models import AgentFinding
from flowpilot.ingestion.models import IngestionResult
from flowpilot.investigations.models import Contract, Investigation, InvestigationState
from flowpilot.procedures.models import ProcedureStep
from flowpilot.settings import fixture_path


class Dot(Contract):
    id: str
    x: float
    y: float
    diameter_px: float = Field(ge=0)
    classification: Literal["normal", "undersized", "oversized", "missing"]


class ImageMeasurement(Contract):
    id: str
    label: str
    synthetic: Literal[True]
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    dots: list[Dot]
    mean_diameter_px: float
    variation_px: float
    golden_min_px: float
    golden_max_px: float
    quality_summary: str
    evidence_ids: list[str]


class QuestionOption(Contract):
    value: str
    label: str
    next_question_id: str | None


class DiscoveryQuestion(Contract):
    id: str
    prompt: str
    rationale: str
    options: list[QuestionOption]


class ScoreContribution(Contract):
    evidence_id: str
    weight: float
    explanation: str


class RankedCause(Contract):
    hypothesis_id: str
    label: str
    score: float
    confirmed: bool
    contributions: list[ScoreContribution]
    missing_evidence: list[str]


class TestRecommendation(Contract):
    id: str
    name: str
    duration_minutes: int
    required_parts: list[str]
    instructions: str
    rationale: str
    expected_outcomes: list[str]
    safety_note: str


class InspectionOutcome(Contract):
    outcome: Literal["obstruction_found", "no_obstruction_found"]
    evidence_id: str
    next_snapshot_id: str


class TimelineEntry(Contract):
    timestamp: str
    state: InvestigationState
    description: str


class CaseSummary(Contract):
    problem: str
    confirmed_cause: str
    corrective_action: str
    verification: str
    evidence_ids: list[str]


class VerificationComparison(Contract):
    before_image_id: str
    after_image_id: str
    passed: bool
    explanation: str


class GoldenSnapshot(Contract):
    id: str
    screen: Literal[
        "report",
        "log",
        "questions",
        "diagnosis",
        "inspection",
        "confirmation",
        "corrective",
        "verification",
        "summary",
    ]
    title: str
    state: InvestigationState
    evidence_ids: list[str]
    ranking: list[RankedCause]
    recommendation_id: str | None
    next_snapshot_id: str | None
    timeline: list[TimelineEntry]


class GoldenScenario(Contract):
    schema_version: Literal["1.0"]
    fixture_version: Literal["1.0"]
    simulated: Literal[True]
    investigation: Investigation
    images: list[ImageMeasurement]
    log_preview: IngestionResult
    questions: list[DiscoveryQuestion]
    first_question_id: str
    findings: list[AgentFinding]
    recommendations: list[TestRecommendation]
    procedure_steps: list[ProcedureStep]
    procedure_review: Literal["pending_expert_review"]
    outcomes: list[InspectionOutcome]
    snapshots: list[GoldenSnapshot]
    initial_snapshot_id: str
    verification: VerificationComparison
    summary: CaseSummary

    @model_validator(mode="after")
    def validate_references(self):
        def ids(items, key="id"):
            values = [getattr(item, key) for item in items]
            if len(values) != len(set(values)):
                raise ValueError(f"Duplicate {key}")
            return set(values)

        evidence = ids(self.investigation.evidence)
        snapshots = ids(self.snapshots)
        questions = ids(self.questions)
        images = ids(self.images)
        recommendations = ids(self.recommendations)

        def require(values, allowed):
            if not set(values) <= allowed:
                raise ValueError(f"Unknown references: {set(values) - allowed}")

        require([self.initial_snapshot_id], snapshots)
        require([self.first_question_id], questions)
        require([self.verification.before_image_id, self.verification.after_image_id], images)
        require(self.summary.evidence_ids, evidence)
        for image in self.images:
            require(image.evidence_ids, evidence)
        for question in self.questions:
            require([o.next_question_id for o in question.options if o.next_question_id], questions)
        for finding in self.findings:
            require(finding.supporting_evidence_ids + finding.conflicting_evidence_ids, evidence)
        for snapshot in self.snapshots:
            require(snapshot.evidence_ids, evidence)
            if snapshot.next_snapshot_id:
                require([snapshot.next_snapshot_id], snapshots)
            if snapshot.recommendation_id:
                require([snapshot.recommendation_id], recommendations)
            for cause in snapshot.ranking:
                require([c.evidence_id for c in cause.contributions], set(snapshot.evidence_ids))
                if abs(cause.score - sum(c.weight for c in cause.contributions)) > 0.001:
                    raise ValueError("Score must equal its contributions")
        for outcome in self.outcomes:
            require([outcome.evidence_id], evidence)
            require([outcome.next_snapshot_id], snapshots)
        return self


def load_golden_scenario() -> GoldenScenario:
    return GoldenScenario.model_validate_json(
        fixture_path("v1/golden-scenario.json").read_text(encoding="utf-8")
    )
