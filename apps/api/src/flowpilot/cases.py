"""M1 deterministic case workflow. All mutation decisions live on the server."""

import asyncio
import json
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import Response
from pydantic import ConfigDict, Field, model_serializer, model_validator
from sqlalchemy import JSON, Integer, String, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Mapped, Session, mapped_column

from flowpilot.diagnosis.models import AgentFinding
from flowpilot.diagnosis.reasoning import ReasoningRun, enrich
from flowpilot.golden import (
    CaseSummary,
    DiscoveryQuestion,
    RankedCause,
    ScoreContribution,
    TestRecommendation,
    TimelineEntry,
    load_golden_scenario,
)
from flowpilot.imaging import Measurement, SampleId, generate_raster, png, sample_measurement
from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.ingestion.models import IngestionResult, LogPreviewRequest
from flowpilot.intake import IntakeContext, IntakeRecord, LogContextRequest, log_context
from flowpilot.investigations.models import Contract, Evidence, Investigation
from flowpilot.knowledge.models import RetrievalSnapshot
from flowpilot.knowledge.service import (
    ensure_library_unchanged,
    invalidate_source,
    prepare_case_experience,
    retrieve,
)
from flowpilot.knowledge.summarizer import summarize_pending
from flowpilot.legacy_imaging import LegacyMeasurement
from flowpilot.persistence.database import Base, make_engine
from flowpilot.procedures.models import ProcedureStep
from flowpilot.recovery import RecoveryChecks
from flowpilot.settings import fixture_path
from flowpilot.vision import VisionAssessment, load_assessment


class CaseRecord(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class DiagnosticSnapshot(Contract):
    past_experience: RetrievalSnapshot = Field(default_factory=RetrievalSnapshot)
    revision: int
    timestamp: str
    trigger: Literal[
        "retained_baseline",
        "diagnose",
        "confirm_observation",
        "correct_evidence",
        "refresh_knowledge",
    ]
    state: str
    ranking: list[RankedCause]
    findings: list[AgentFinding]
    findings_mode: Literal["cached_templates", "live"]
    reasoning: ReasoningRun | None
    evidence: list[Evidence]


class CompletionSummary(CaseSummary):
    notes: str = Field(default="", max_length=2000)


class Case(Contract):
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)
    investigation: Investigation
    revision: int = 0
    scenario_version: Literal["1.0", "2.0"] = "1.0"
    rules_version: Literal["1.0", "2.0"] = "1.0"
    recovery: RecoveryChecks | None = None
    calibration_attempts: int = 0
    calibration_failures: int = 0
    escalated: bool = False
    corrective_action: Literal["nozzle_cleaning", "nozzle_replacement"] | None = None
    measurement: Measurement | LegacyMeasurement | VisionAssessment
    verification: Measurement | LegacyMeasurement | VisionAssessment | None = None
    log: IngestionResult | None = None
    intake: IntakeRecord | None = None
    answers: dict[str, str] = Field(default_factory=dict)
    next_question: DiscoveryQuestion | None = None
    questions_complete: bool = False
    ranking: list[RankedCause] = Field(default_factory=list)
    findings: list[AgentFinding] = Field(default_factory=list)
    findings_mode: Literal["cached_templates", "live"] = "cached_templates"
    reasoning: ReasoningRun | None = None
    past_experience: RetrievalSnapshot = Field(default_factory=RetrievalSnapshot)
    diagnostic_history: list[DiagnosticSnapshot] = Field(default_factory=list)
    recommendation: TestRecommendation | None = None
    procedure: list[ProcedureStep] = Field(default_factory=list)
    timeline: list[TimelineEntry] = Field(default_factory=list)
    pending_outcome: Literal["obstruction_found", "no_obstruction_found"] | None = None
    summary: CompletionSummary | None = None
    diagnosis_supported: bool

    @model_serializer(mode="wrap")
    def serialize_case(self, handler):
        payload = handler(self)
        if self.scenario_version == "1.0":
            # Preserve the original nested v1 wire payload, not just stored bytes.
            for finding in payload["findings"]:
                finding.pop("knowledge_refs", None)
            for entry in payload["timeline"]:
                entry.pop("diagnostic_revision", None)
            if payload["summary"] is not None:
                payload["summary"].pop("notes", None)
        return payload


class CreateCase(Contract):
    context: IntakeContext | None = None
    report: str = Field(min_length=1, max_length=2000)
    sample_id: SampleId | None = None
    assessment_id: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def image_source(self):
        if self.sample_id is not None and self.assessment_id is not None:
            raise ValueError("Choose a photo assessment or a raster sample, not both.")
        return self


class CaseListItem(Contract):
    id: str
    title: str
    state: str
    phase: Literal["Report", "Diagnose", "Inspect", "Correct", "Verify", "Summary"]
    scenario_version: str
    simulated: bool
    read_only: bool
    updated_at: str


class CaseExplanationRequest(Contract):
    revision: int = Field(ge=0)
    question: str = Field(min_length=2, max_length=1000)


class CaseExplanation(Contract):
    answer: str
    evidence_ids: list[str]
    source_refs: list[str]
    knowledge_refs: list[str] = Field(default_factory=list)
    mode: Literal["cached"] = "cached"
    timestamp: str
    non_mutating: Literal[True] = True


class ActionBase(Contract):
    revision: int = Field(ge=0)


class AttachLog(ActionBase):
    action: Literal["attach_log"]
    log: LogPreviewRequest


class Answer(ActionBase):
    action: Literal["answer"]
    question_id: str
    value: str


class Diagnose(ActionBase):
    action: Literal["diagnose"]


class RefreshKnowledge(ActionBase):
    action: Literal["refresh_knowledge"]


class Inspect(ActionBase):
    action: Literal["inspect"]
    outcome: Literal["obstruction_found", "no_obstruction_found"]


class Confirm(ActionBase):
    action: Literal["confirm_observation"]
    confirmed: Literal[True]


class Resolve(ActionBase):
    action: Literal["resolve"]
    confirmed: Literal[True]
    notes: str = Field(default="", max_length=2000)


class CompleteAction(ActionBase):
    action: Literal["complete_action"]
    confirmed: Literal[True]
    corrective_action: Literal["nozzle_cleaning", "nozzle_replacement"] = "nozzle_replacement"


class Verify(ActionBase):
    action: Literal["verify"]
    sample_id: SampleId | None = None
    assessment_id: str | None = Field(default=None, min_length=1, max_length=100)
    checks: RecoveryChecks = Field(default_factory=RecoveryChecks)

    @model_validator(mode="after")
    def image_source(self):
        if (self.sample_id is None) == (self.assessment_id is None):
            raise ValueError("Choose exactly one verification image source.")
        return self


class CorrectEvidence(ActionBase):
    action: Literal["correct_evidence"]
    evidence_id: str
    operation: Literal["edit", "reject"]
    value: str | None = Field(default=None, max_length=2000)
    reason: str = Field(min_length=1, max_length=500)
    confirmed: Literal[True]


CaseAction = Annotated[
    AttachLog
    | Answer
    | Diagnose
    | RefreshKnowledge
    | Inspect
    | Confirm
    | Resolve
    | CompleteAction
    | Verify
    | CorrectEvidence,
    Field(discriminator="action"),
]


def now() -> str:
    return datetime.now(UTC).isoformat()


def evidence(
    case: Case,
    key: str,
    value,
    source_type="technician_input",
    source_ref="operator",
    verified=False,
    unit=None,
) -> Evidence:
    item = Evidence(
        id=f"EV-{uuid4().hex[:12]}",
        key=key,
        value=value,
        unit=unit,
        source_type=source_type,
        source_ref=source_ref,
        quality="high",
        verification_state="verified" if verified else "provisional",
        timestamp=now(),
    )
    case.investigation.evidence.append(item)
    return item


def transition(case: Case, state, description: str):
    case.investigation.state = state
    case.timeline.append(TimelineEntry(timestamp=now(), state=state, description=description))


def capture_diagnosis(case: Case, trigger):
    """Copy results after reasoning, committed atomically with the case action."""
    timestamp = now()
    case.diagnostic_history.append(
        DiagnosticSnapshot(
            revision=case.revision,
            timestamp=timestamp,
            trigger=trigger,
            state=case.investigation.state,
            ranking=[item.model_copy(deep=True) for item in case.ranking],
            findings=[item.model_copy(deep=True) for item in case.findings],
            findings_mode=case.findings_mode,
            reasoning=case.reasoning.model_copy(deep=True) if case.reasoning else None,
            evidence=[item.model_copy(deep=True) for item in case.investigation.evidence],
            past_experience=case.past_experience.model_copy(deep=True),
        )
    )
    if trigger == "retained_baseline":
        transition(
            case,
            case.investigation.state,
            "Previously saved diagnosis retained; earlier history unavailable.",
        )
    # Link the completed action to its exact result without changing workflow order.
    case.timeline[-1].diagnostic_revision = case.revision
    case.timeline[-1].timestamp = timestamp


def question(question_id: str) -> DiscoveryQuestion:
    return next(
        q.model_copy(deep=True) for q in load_golden_scenario().questions if q.id == question_id
    )


def create_case(request: CreateCase) -> Case:
    if not request.report.strip():
        raise HTTPException(422, "Enter an operator report.")
    measurement = (
        load_assessment(request.assessment_id)
        if request.assessment_id is not None
        else sample_measurement(request.sample_id or "incomplete")
    )
    # An operator report can still warrant investigation with a normal-looking photo.
    supported = isinstance(measurement, VisionAssessment) or not measurement.passed
    case = Case(
        scenario_version="2.0",
        rules_version="2.0",
        investigation=Investigation(
            schema_version="2.0",
            id=f"CASE-{uuid4().hex[:12]}",
            title=request.report.strip(),
            process="S-932 / DJ-2200 atomized flux spraying",
            state="reported",
            simulated=True,
            reported_at=now(),
        ),
        measurement=measurement,
        diagnosis_supported=supported,
        next_question=question("frequency") if supported else None,
        procedure=load_golden_scenario().procedure_steps,
    )
    evidence(case, "operator_report", request.report.strip(), verified=True)
    if isinstance(measurement, VisionAssessment):
        evidence(
            case,
            "visual_anomaly_detected",
            not measurement.passed,
            "model_inference",
            measurement.image_url,
        )
        transition(case, "reported", "Operator report created; photo analysis attached.")
        return case
    evidence(
        case,
        "coverage_pct",
        measurement.coverage_pct,
        "synthetic_image_measurement",
        measurement.image_url,
        unit="%",
    )
    for key, observed in {
        "incomplete_coverage": measurement.coverage_pct < 100,
        "coarse_deposits": measurement.coarse_area_px > 0,
        "shifted_pattern": measurement.displacement_px > 1 and measurement.coverage_pct >= 85,
        "overspray": measurement.outside_keep_out_px > 0,
    }.items():
        evidence(case, key, observed, "synthetic_image_measurement", measurement.image_url)
    transition(case, "reported", "Operator report created; controlled raster measured.")
    return case


def missing_evidence(case: Case, hypothesis_id: str) -> list[str]:
    verified = [e for e in case.investigation.evidence if e.verification_state == "verified"]
    if hypothesis_id == "material_condition":
        return ["Material temperature", "Pot life and idle-purge history"]
    if hypothesis_id == "atomization_fault":
        known = any(e.key == "intermittent" and e.value == "yes" for e in verified)
        return (
            ["Air-cap and coaxial-air inspection"]
            if known
            else ["Weight versus pattern", "Air-cap and coaxial-air inspection"]
        )
    if hypothesis_id == "fluid_supply_fault":
        return ["Actual pressure stability", "BFS and connection checks"]
    if hypothesis_id == "alignment_fault":
        return ["Nozzle straightness and offsets", "Recipe teaching"]
    if any(e.key == "inspection" and e.value == "obstruction_found" for e in verified):
        return []
    if any(e.key == "inspection" and e.value == "no_obstruction_found" for e in verified):
        return ["Upstream fluid-path inspection"]
    return ["Authorized nozzle inspection", "Upstream fluid-path inspection"]


def normalize_case(case: Case) -> Case:
    """Repair derived presentation on load; never write storage or alter workflow history."""
    if case.scenario_version == "1.0":
        return case
    if case.log:
        for item in case.investigation.evidence:
            if item.source_type != "machine_log" or item.unit is not None:
                continue
            matches = [
                candidate
                for candidate in case.log.evidenceCandidates
                if candidate.key == item.key
                and candidate.sourceRef == item.source_ref
                and candidate.value == item.value
            ]
            if len(matches) == 1 and isinstance(matches[0].unit, dict):
                item.unit = dict(matches[0].unit)
    for cause in case.ranking:
        cause.missing_evidence = missing_evidence(case, cause.hypothesis_id)
    for finding in case.findings:
        if case.findings_mode == "cached_templates" and finding.agent != "diagnostic_critic":
            cause = next(
                (c for c in case.ranking if c.hypothesis_id == finding.hypothesis_id), None
            )
            if cause:
                finding.missing_evidence = list(cause.missing_evidence)
    return case


def rank(case: Case):
    case.findings_mode = "cached_templates"
    case.reasoning = None
    case.past_experience = RetrievalSnapshot()
    rules = json.loads(fixture_path("v2/scoring-rules.json").read_text(encoding="utf-8"))
    causes = []
    confirmed = any(
        e.key == "inspection"
        and e.value == "obstruction_found"
        and e.verification_state == "verified"
        for e in case.investigation.evidence
    )
    for cause_id, label in rules["labels"].items():
        contributions = []
        for item in case.investigation.evidence:
            if item.verification_state == "rejected":
                continue
            for rule in rules["rules"]:
                if (
                    item.key == rule["key"]
                    and item.value == rule["value"]
                    and rule["weights"].get(cause_id, 0)
                ):
                    contributions.append(
                        ScoreContribution(
                            evidence_id=item.id,
                            weight=rule["weights"].get(cause_id, 0),
                            explanation=rule["explanation"],
                        )
                    )
        missing = missing_evidence(case, cause_id)
        causes.append(
            RankedCause(
                hypothesis_id=cause_id,
                label=label,
                score=sum(c.weight for c in contributions),
                confirmed=confirmed and cause_id == "fluid_path_restriction",
                contributions=contributions,
                missing_evidence=missing,
            )
        )
    case.ranking = sorted(causes, key=lambda c: -c.score)
    # Cached templates are populated only from this case's current rule contributions.
    case.findings = [
        AgentFinding(
            agent="fluid_path_specialist"
            if c.hypothesis_id not in ("material_condition", "alignment_fault")
            else "material_process_specialist",
            hypothesis_id=c.hypothesis_id,
            supporting_evidence_ids=[s.evidence_id for s in c.contributions if s.weight > 0],
            conflicting_evidence_ids=[s.evidence_id for s in c.contributions if s.weight < 0],
            missing_evidence=c.missing_evidence,
            source_refs=[],
            confidence_band="medium",
            summary=f"{c.label}: compare the cited supporting and conflicting observations.",
        )
        for c in case.ranking
    ]
    case.findings.append(
        AgentFinding(
            agent="diagnostic_critic",
            hypothesis_id=case.ranking[0].hypothesis_id,
            supporting_evidence_ids=[],
            conflicting_evidence_ids=[],
            missing_evidence=["Material temperature", "Material open time"],
            source_refs=[],
            confidence_band="low",
            summary="Image measurements describe symptoms, not causes. "
            "Machine PASS does not establish product quality; material conditions remain unknown.",
        )
    )


def correct_evidence(case: Case, action: CorrectEvidence):
    items = case.investigation.evidence
    if any(e.key == "inspection" and e.verification_state == "verified" for e in items):
        raise HTTPException(
            409, "Evidence is locked after a confirmed inspection. Create a new case."
        )
    item = next((e for e in items if e.id == action.evidence_id), None)
    if item is None or item.verification_state == "rejected":
        raise HTTPException(409, "Select current evidence to correct.")
    if not action.reason.strip():
        raise HTTPException(422, "A correction reason is required.")
    questions = {q.id: q for q in load_golden_scenario().questions}
    editable = item.source_type == "technician_input" and (
        item.key == "operator_report" or item.key in questions
    )
    if action.operation == "edit":
        if not editable:
            raise HTTPException(422, "Machine and image evidence can be rejected, not edited.")
        if not action.value or not action.value.strip():
            raise HTTPException(422, "A replacement value is required.")
        if item.key in questions and action.value not in {
            o.value for o in questions[item.key].options
        }:
            raise HTTPException(422, "Unknown answer option.")
    before = item.model_dump(mode="json")
    item.verification_state = "rejected"
    invalidated = []
    question_key = item.key if item.key in questions else None
    if item.source_type == "machine_log" and question_key is None:
        # Rejecting a measurement also retires answers derived from that source row.
        question_key = next(
            (
                key
                for key in case.answers
                if any(
                    e.key == key
                    and e.source_type == "machine_log"
                    and e.verification_state != "rejected"
                    and case.intake is not None
                    and key in case.intake.signals
                    and item.source_ref in case.intake.signals[key].source_refs
                    for e in items
                )
            ),
            None,
        )
    if question_key is not None:
        # Follow the previously answered path, retiring all dependent answers.
        cursor = question_key
        while cursor and cursor in case.answers:
            previous = case.answers.pop(cursor)
            for dependent in items:
                if (
                    dependent.key == cursor or dependent.source_ref == f"question:{cursor}"
                ) and dependent.verification_state != "rejected":
                    invalidated.append(dependent.model_dump(mode="json"))
                    dependent.verification_state = "rejected"
            option = next(o for o in questions[cursor].options if o.value == previous)
            cursor = option.next_question_id
        case.next_question = question(question_key)
        if action.operation == "edit":
            case.answers[item.key] = action.value
            option = next(o for o in questions[item.key].options if o.value == action.value)
            case.next_question = (
                question(option.next_question_id) if option.next_question_id else None
            )
        case.questions_complete = case.next_question is None
    if action.operation == "edit":
        evidence(case, item.key, action.value.strip(), source_ref=item.source_ref, verified=True)
        record_photo_symptom(case, item.key, action.value.strip())
        if item.key == "operator_report":
            case.investigation.title = action.value.strip()
    if item.source_type in ("synthetic_image_measurement", "model_inference"):
        for derived in items:
            if derived.source_ref == item.source_ref and derived.verification_state != "rejected":
                invalidated.append(derived.model_dump(mode="json"))
                derived.verification_state = "rejected"
        if item.source_type == "synthetic_image_measurement":
            case.diagnosis_supported = False
    case.pending_outcome = None
    case.recommendation = None
    had_ranking = bool(case.ranking)
    case.ranking = []
    case.findings = []
    case.findings_mode = "cached_templates"
    case.reasoning = None
    case.past_experience = RetrievalSnapshot()
    state = "diagnosing"
    if had_ranking and case.questions_complete:
        rank(case)
        if case.diagnosis_supported:
            case.recommendation = load_golden_scenario().recommendations[0]
            state = "inspection_recommended"
    transition(
        case,
        state,
        "Evidence correction: "
        + json.dumps(
            {
                "operation": action.operation,
                "before": before,
                "replacement": action.value if action.operation == "edit" else None,
                "invalidated": invalidated,
                "reason": action.reason.strip(),
            },
            ensure_ascii=False,
        ),
    )


def record_photo_symptom(case: Case, question_id: str, value: str):
    if (
        isinstance(case.measurement, VisionAssessment)
        and question_id == "frequency"
        and value in ("continuous", "intermittent")
    ):
        evidence(
            case,
            "incomplete_coverage" if value == "continuous" else "coarse_deposits",
            True,
            source_ref="question:frequency",
            verified=True,
        )


def apply_action(case: Case, action: CaseAction) -> Case:
    if case.scenario_version == "1.0":
        raise HTTPException(
            409, "Legacy epoxy cases are read-only. Start a new flux investigation."
        )
    state = case.investigation.state

    def require(condition, message="This action is not available in the current case state."):
        if not condition:
            raise HTTPException(409, message)

    if action.action == "correct_evidence":
        case.past_experience = RetrievalSnapshot()
        correct_evidence(case, action)
    elif action.action == "attach_log":
        require(state in ("reported", "diagnosing") and not case.ranking and case.log is None)
        case.log = IngestionResult.model_validate(
            parse_industry_event_log(
                action.log.text,
                source_name=action.log.sourceName,
                timezone_offset=action.log.timezoneOffset,
            )
        )
        for candidate in case.log.evidenceCandidates:
            item = evidence(
                case,
                candidate.key,
                candidate.value,
                "machine_log",
                candidate.sourceRef,
                unit=candidate.unit,
            )
            # Never substitute ingestion time for an unknown machine-event time.
            item.timestamp = candidate.timestamp or "unknown"
        transition(
            case, state, f"Attached {case.log.sourceName}; raw events and warnings retained."
        )
    elif action.action == "answer":
        require(state in ("reported", "diagnosing") and case.next_question is not None)
        current = case.next_question
        require(action.question_id == current.id, "Answer the current discovery question.")
        option = next((o for o in current.options if o.value == action.value), None)
        if option is None:
            raise HTTPException(422, "Unknown answer option.")
        case.answers[current.id] = action.value
        evidence(case, current.id, action.value, source_ref=f"question:{current.id}", verified=True)
        record_photo_symptom(case, current.id, action.value)
        case.next_question = question(option.next_question_id) if option.next_question_id else None
        case.questions_complete = case.next_question is None
        transition(case, "diagnosing", f"Answered: {current.prompt} {option.label}")
    elif action.action == "diagnose":
        require(case.questions_complete and case.diagnosis_supported and not case.ranking)
        rank(case)
        case.recommendation = load_golden_scenario().recommendations[0]
        transition(
            case, "inspection_recommended", "Ranked five causes; inspect to test restriction."
        )
    elif action.action == "refresh_knowledge":
        require(bool(case.ranking) and case.diagnosis_supported)
        rank(case)
        transition(case, state, "Refreshed published experience; prior diagnosis retained.")
    elif action.action == "inspect":
        require(state == "inspection_recommended" and case.pending_outcome is None)
        case.pending_outcome = action.outcome
        transition(case, state, "Inspection observation selected; explicit confirmation required.")
    elif action.action == "confirm_observation":
        require(state == "inspection_recommended" and case.pending_outcome is not None)
        outcome = case.pending_outcome
        evidence(case, "inspection", outcome, source_ref="confirmed_inspection", verified=True)
        transition(
            case, "inspection_completed", "Inspection completed: " + outcome.replace("_", " ")
        )
        case.pending_outcome = None
        rank(case)
        if outcome == "obstruction_found":
            case.recommendation = None
            transition(case, "cause_confirmed", "Technician confirmed the obstruction observation.")
        else:
            case.recommendation = next(
                r for r in load_golden_scenario().recommendations if r.id == "air_supply"
            )
            transition(
                case,
                "diagnosing",
                "No nozzle obstruction; review air cap and pressure supply next.",
            )
    elif action.action == "complete_action":
        require(state == "cause_confirmed")
        evidence(
            case,
            "corrective_action",
            "Simulated " + action.corrective_action.replace("_", " ") + " recorded",
            source_ref="confirmed_action",
            verified=True,
        )
        case.corrective_action = action.corrective_action
        transition(case, "corrective_action_completed", "Simulated corrective action confirmed.")
    elif action.action == "verify":
        require(state == "corrective_action_completed")
        require(
            not case.escalated,
            "Two calibration failures require maintenance escalation; "
            "ordinary retries are blocked.",
        )
        if isinstance(case.measurement, VisionAssessment):
            require(action.assessment_id is not None, "Analyze a post-action photo first.")
            verification = load_assessment(action.assessment_id)
            require(
                verification.model_id == case.measurement.model_id
                and verification.preprocessing_id == case.measurement.preprocessing_id
                and verification.threshold == case.measurement.threshold,
                "Before and after photos must use the same model and reference threshold.",
            )
            case.verification = verification
        else:
            require(action.sample_id is not None, "Use a raster sample for this saved case.")
            case.verification = sample_measurement(action.sample_id)
        case.recovery = action.checks
        if action.checks.confirmed and action.checks.calibration != "unknown":
            case.calibration_attempts += 1
            case.calibration_failures += int(action.checks.calibration == "fail")
        case.escalated = case.calibration_failures >= 2
        passed = case.verification.passed and action.checks.complete() and not case.escalated
        evidence(
            case,
            "recovery_checks",
            action.checks.model_dump(mode="json"),
            source_ref="confirmed_simulated_recovery",
            verified=action.checks.confirmed,
        )
        evidence(
            case,
            "verification_passed",
            passed,
            "model_inference"
            if isinstance(case.verification, VisionAssessment)
            else "synthetic_image_measurement",
            case.verification.image_url,
            verified=action.checks.confirmed,
        )
        transition(
            case,
            "verification_passed" if passed else state,
            "Verification passed; simulated recovery only."
            if passed
            else "Two calibration failures: maintenance escalation required."
            if case.escalated
            else "Verification incomplete or failed; case remains open.",
        )
    elif action.action == "resolve":
        require(
            state == "verification_passed"
            and case.verification
            and case.verification.passed
            and case.recovery
            and case.recovery.complete()
            and not case.escalated
        )
        case.summary = CompletionSummary(
            problem=case.investigation.title,
            confirmed_cause="Nozzle restriction",
            corrective_action="Simulated "
            + (case.corrective_action or "nozzle_replacement").replace("_", " "),
            verification=(
                "Post-action photo is within the normal reference range; "
                "technician recovery checks confirmed. "
                "Visual similarity alone does not authorize lot release."
                if isinstance(case.verification, VisionAssessment)
                else "Visual and recovery checks passed; synthetic recovery only, not lot release."
            ),
            evidence_ids=[e.id for e in case.investigation.evidence],
            notes=action.notes.strip(),
        )
        transition(case, "resolved", "Resolution explicitly confirmed; case summary saved.")
    case.revision += 1
    return case


router = APIRouter(prefix="/api", tags=["cases"])


def case_phase(case: Case) -> str:
    state = case.investigation.state
    if state == "resolved":
        return "Summary"
    if state in ("verification_passed", "corrective_action_completed"):
        return "Verify"
    if state == "cause_confirmed":
        return "Correct"
    if case.pending_outcome:
        return "Inspect"
    if case.ranking or state == "diagnosing":
        return "Diagnose"
    return "Report"


def case_list_item(case: Case) -> CaseListItem:
    latest = case.timeline[-1].timestamp if case.timeline else case.investigation.reported_at
    return CaseListItem(
        id=case.investigation.id,
        title=case.investigation.title,
        state=case.investigation.state,
        phase=case_phase(case),
        scenario_version=case.scenario_version,
        simulated=case.investigation.simulated,
        read_only=case.scenario_version == "1.0",
        updated_at=latest,
    )


def explain_case(case: Case, question_text: str) -> CaseExplanation:
    question = question_text.strip()
    lowered = question.casefold()
    prohibited = (
        "start the machine",
        "control the machine",
        "bypass",
        "authorize maintenance",
        "release the lot",
        "approve the lot",
    )
    if any(term in lowered for term in prohibited):
        return CaseExplanation(
            answer=(
                "FlowPilot cannot authorize maintenance, control equipment, bypass a workflow "
                "gate, or release production. Follow the controlled site procedure and use the "
                "visible case controls to record an authorized observation."
            ),
            evidence_ids=[],
            source_refs=[],
            timestamp=now(),
        )

    active = [item for item in case.investigation.evidence if item.verification_state != "rejected"]
    by_id = {item.id: item for item in active}
    evidence_ids: list[str] = []

    top = case.ranking[0] if case.ranking else None
    if top:
        evidence_ids = [
            contribution.evidence_id
            for contribution in top.contributions
            if contribution.evidence_id in by_id
        ][:5]

    if any(term in lowered for term in ("next", "do now", "action", "check")):
        if case.recommendation:
            answer = (
                f"Next check: {case.recommendation.name}. "
                f"{case.recommendation.rationale} {case.recommendation.instructions} "
                "This guidance does not authorize physical service."
            )
        elif case.summary:
            answer = "This simulated case is resolved. Review the saved summary and audit history."
        else:
            answer = "Complete the visible required case control before moving to the next phase."
    elif any(term in lowered for term in ("missing", "unknown", "uncertain", "confidence")):
        gaps = sorted({gap for cause in case.ranking for gap in cause.missing_evidence})
        answer = (
            "Remaining unknowns: " + "; ".join(gaps)
            if gaps
            else "No additional diagnostic gaps are listed for the current ranked causes."
        )
    elif top:
        qualifier = "confirmed" if top.confirmed else "not confirmed"
        answer = (
            f"The leading hypothesis is {top.label} at {top.score} heuristic points; it is "
            f"{qualifier}. The score is deterministic, not a probability. "
            "Open the cited evidence before recording an inspection outcome."
        )
    else:
        answer = (
            "The case is still in intake. Complete the discovery questions and attach any "
            "available machine evidence before requesting a ranked diagnosis."
        )

    historical = case.past_experience
    if historical.matches:
        answer += " Saved historical context: " + historical.explanation
        if historical.suggested_check:
            answer += " " + historical.suggested_check
        answer += " Check reference status in Past experience before reuse."
    return CaseExplanation(
        answer=answer,
        knowledge_refs=[m.citation for m in historical.matches],
        evidence_ids=evidence_ids,
        source_refs=[by_id[item_id].source_ref for item_id in evidence_ids],
        timestamp=now(),
    )


@router.get("/demo/images", response_model=list[Measurement])
def images():
    return [
        sample_measurement(s) for s in ("normal", "incomplete", "coarse", "shifted", "overspray")
    ]


@router.get("/demo/images/{sample_id}.png")
def image(sample_id: SampleId):
    return Response(png(generate_raster(sample_id)), media_type="image/png")


def database_operation(operation):
    engine = make_engine()
    try:
        with Session(engine) as session, session.begin():
            return operation(session)
    except OperationalError as error:
        raise HTTPException(
            503, "Case storage unavailable. Run the documented database migration."
        ) from error
    finally:
        engine.dispose()


def apply_intake(case: Case, context: IntakeContext):
    if not isinstance(case.measurement, VisionAssessment):
        raise HTTPException(422, "Combined intake requires a photo assessment.")
    signals = {}
    if context.log is not None:
        parsed = log_context(LogContextRequest(log=context.log, board_id=context.board_id))
        if not context.log_confirmed or (parsed.boards and context.board_id is None):
            raise HTTPException(422, "Confirm the log and its matching Board before submitting.")
        signals = parsed.signals
        apply_action(case, AttachLog(action="attach_log", revision=case.revision, log=context.log))
    elif context.board_id is not None or context.log_confirmed:
        raise HTTPException(422, "A Board selection requires a log.")
    used = set()
    while case.next_question is not None:
        q = case.next_question
        choice = context.observations.get(q.id)
        if choice is None:
            raise HTTPException(422, f"Answer: {q.prompt}")
        used.add(q.id)
        option_values = {option.value for option in q.options}
        if choice.observed_value is not None and choice.observed_value not in option_values:
            raise HTTPException(422, "Unknown observation option.")
        signal = signals.get(q.id)
        conflict = signal is not None and (
            (choice.source == "technician_input" and choice.value not in (signal.answer, "unknown"))
            or (
                choice.observed_value is not None
                and choice.observed_value not in (signal.answer, "unknown")
            )
        )
        if conflict and not choice.reason.strip():
            raise HTTPException(
                422, "Explain which evidence to use when the log and observation differ."
            )
        if choice.source == "machine_log" and (signal is None or choice.value != signal.answer):
            raise HTTPException(422, "This answer is not supported by the selected log window.")
        apply_action(
            case,
            Answer(action="answer", revision=case.revision, question_id=q.id, value=choice.value),
        )
        recorded = next(e for e in reversed(case.investigation.evidence) if e.key == q.id)
        if choice.source == "machine_log":
            recorded.source_type = "machine_log"
            recorded.source_ref = "; ".join(signal.source_refs)
            referenced = next(e for e in case.log.events if e.sourceRef == signal.source_refs[-1])
            recorded.timestamp = referenced.occurredAt or "unknown"
        if choice.reason.strip():
            evidence(
                case,
                "evidence_resolution",
                {
                    "question": q.id,
                    "selected_source": choice.source,
                    "selected_value": choice.value,
                    "observed_value": choice.observed_value,
                    "log_value": signal.answer if signal else None,
                    "reason": choice.reason.strip(),
                },
                source_ref=f"intake:{q.id}",
                verified=True,
            )
    if set(context.observations) != used:
        raise HTTPException(422, "Submit only observations from the selected symptom branch.")
    case.intake = IntakeRecord(
        board_id=context.board_id,
        observations=context.observations,
        notes=context.notes.strip(),
        signals=signals,
    )
    apply_action(case, Diagnose(action="diagnose", revision=case.revision))


@router.post("/investigations", response_model=Case, status_code=201)
def new_case(request: CreateCase):
    case = create_case(request)
    if request.context is not None:
        apply_intake(case, request.context)
        case.past_experience = database_operation(lambda session: retrieve(session, case))
        asyncio.run(enrich(case))
        capture_diagnosis(case, "diagnose")

    def save(session):
        session.add(
            CaseRecord(
                id=case.investigation.id,
                revision=case.revision,
                payload=case.model_dump(mode="json"),
            )
        )
        session.flush()
        ensure_library_unchanged(session, case.past_experience)
        return case

    return database_operation(save)


@router.get("/investigations", response_model=list[CaseListItem])
def list_cases(limit: int = Query(default=20, ge=1, le=50)):
    def listing(session):
        records = session.scalars(select(CaseRecord)).all()
        items = [
            case_list_item(normalize_case(Case.model_validate(record.payload)))
            for record in records
        ]
        return sorted(items, key=lambda item: item.updated_at, reverse=True)[:limit]

    return database_operation(listing)


@router.post("/demo/reset", response_model=Case, status_code=201)
def reset_demo(request: CreateCase):
    """Start a fresh simulated investigation; retain all existing case history."""
    return new_case(request)


@router.get("/investigations/{case_id}", response_model=Case)
def get_case(case_id: str):
    def get(session):
        record = session.get(CaseRecord, case_id)
        if record is None:
            raise HTTPException(404, "Case not found.")
        return normalize_case(Case.model_validate(record.payload))

    return database_operation(get)


@router.post(
    "/investigations/{case_id}/explanations",
    response_model=CaseExplanation,
)
def explain(case_id: str, request: CaseExplanationRequest):
    case = get_case(case_id)
    if case.revision != request.revision:
        raise HTTPException(409, "Case changed. Reload it before requesting guidance.")
    return explain_case(case, request.question)


@router.post("/investigations/{case_id}/actions", response_model=Case)
def act(case_id: str, action: CaseAction, background_tasks: BackgroundTasks):
    case = get_case(case_id)
    if case.revision != action.revision:
        raise HTTPException(409, "Case changed. Reload the saved case before trying again.")
    if case.scenario_version == "2.0" and case.ranking and not case.diagnostic_history:
        capture_diagnosis(case, "retained_baseline")
    case = apply_action(case, action)
    if case.ranking and action.action in (
        "diagnose",
        "confirm_observation",
        "correct_evidence",
        "refresh_knowledge",
    ):
        case.past_experience = database_operation(lambda session: retrieve(session, case))
        # The read transaction has closed. Never hold SQLite locks across network I/O.
        asyncio.run(enrich(case))
    if action.action in (
        "diagnose",
        "confirm_observation",
        "correct_evidence",
        "refresh_knowledge",
    ):
        capture_diagnosis(case, action.action)

    def change(session):
        result = session.execute(
            update(CaseRecord)
            .where(
                CaseRecord.id == case_id,
                CaseRecord.revision == action.revision,
            )
            .values(revision=case.revision, payload=case.model_dump(mode="json"))
        )
        if result.rowcount != 1:
            raise HTTPException(409, "Case changed. Reload the saved case before trying again.")
        if action.action in (
            "diagnose",
            "confirm_observation",
            "correct_evidence",
            "refresh_knowledge",
        ):
            ensure_library_unchanged(session, case.past_experience)
        invalidate_source(session, case_id)
        if action.action in ("confirm_observation", "complete_action", "verify", "resolve"):
            prepare_case_experience(session, case)
        return case

    saved = database_operation(change)
    background_tasks.add_task(summarize_pending, case_id)
    return saved
