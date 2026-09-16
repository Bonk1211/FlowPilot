"""M1 deterministic case workflow. All mutation decisions live on the server."""

import json
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import ConfigDict, Field
from sqlalchemy import JSON, Integer, String, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Mapped, Session, mapped_column

from flowpilot.diagnosis.models import AgentFinding
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
from flowpilot.investigations.models import Contract, Evidence, Investigation
from flowpilot.persistence.database import Base, make_engine
from flowpilot.procedures.models import ProcedureStep
from flowpilot.settings import fixture_path


class CaseRecord(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class Case(Contract):
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)
    investigation: Investigation
    revision: int = 0
    rules_version: Literal["1.0"] = "1.0"
    measurement: Measurement
    verification: Measurement | None = None
    log: IngestionResult | None = None
    answers: dict[str, str] = Field(default_factory=dict)
    next_question: DiscoveryQuestion | None = None
    questions_complete: bool = False
    ranking: list[RankedCause] = Field(default_factory=list)
    findings: list[AgentFinding] = Field(default_factory=list)
    findings_mode: Literal["cached_templates"] = "cached_templates"
    recommendation: TestRecommendation | None = None
    procedure: list[ProcedureStep] = Field(default_factory=list)
    timeline: list[TimelineEntry] = Field(default_factory=list)
    pending_outcome: Literal["obstruction_found", "no_obstruction_found"] | None = None
    summary: CaseSummary | None = None
    diagnosis_supported: bool


class CreateCase(Contract):
    report: str = Field(min_length=1, max_length=2000)
    sample_id: SampleId = "undersized"


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


class Inspect(ActionBase):
    action: Literal["inspect"]
    outcome: Literal["obstruction_found", "no_obstruction_found"]


class Confirm(ActionBase):
    action: Literal["confirm_observation", "complete_action", "resolve"]
    confirmed: Literal[True]


class Verify(ActionBase):
    action: Literal["verify"]
    sample_id: SampleId


CaseAction = Annotated[
    AttachLog | Answer | Diagnose | Inspect | Confirm | Verify, Field(discriminator="action")
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


def question(question_id: str) -> DiscoveryQuestion:
    return next(
        q.model_copy(deep=True) for q in load_golden_scenario().questions if q.id == question_id
    )


def create_case(request: CreateCase) -> Case:
    if not request.report.strip():
        raise HTTPException(422, "Enter an operator report.")
    measurement = sample_measurement(request.sample_id)
    supported = all(d.classification == "undersized" for d in measurement.dots)
    case = Case(
        investigation=Investigation(
            id=f"CASE-{uuid4().hex[:12]}",
            title=request.report.strip(),
            process="Precision epoxy dispensing",
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
    evidence(
        case,
        "mean_dot_diameter_px",
        measurement.mean_diameter_px,
        "synthetic_image_measurement",
        measurement.image_url,
        unit="px",
    )
    evidence(case, "undersized", supported, "synthetic_image_measurement", measurement.image_url)
    transition(case, "reported", "Operator report created; controlled raster measured.")
    return case


def missing_evidence(case: Case, hypothesis_id: str) -> list[str]:
    verified = [e for e in case.investigation.evidence if e.verification_state == "verified"]
    if hypothesis_id == "material_viscosity_change":
        return ["Material temperature", "Material open time"]
    if hypothesis_id == "trapped_air_bubble":
        known = any(e.key == "intermittent" and e.value == "yes" for e in verified)
        return [] if known else ["Intermittent recovery"]
    return [] if any(e.key == "inspection" for e in verified) else ["Physical inspection"]


def normalize_case(case: Case) -> Case:
    """Repair derived presentation on load; never write storage or alter workflow history."""
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
        if finding.agent != "diagnostic_critic":
            cause = next(
                (c for c in case.ranking if c.hypothesis_id == finding.hypothesis_id), None
            )
            if cause:
                finding.missing_evidence = list(cause.missing_evidence)
    return case


def rank(case: Case):
    rules = json.loads(fixture_path("v1/scoring-rules.json").read_text(encoding="utf-8"))
    causes = []
    confirmed = any(
        e.key == "inspection"
        and e.value == "obstruction_found"
        and e.verification_state == "verified"
        for e in case.investigation.evidence
    )
    for index, (cause_id, label) in enumerate(rules["labels"].items()):
        contributions = []
        for item in case.investigation.evidence:
            if item.verification_state == "rejected":
                continue
            for rule in rules["rules"]:
                if (
                    item.key == rule["key"]
                    and item.value == rule["value"]
                    and rule["weights"][index]
                ):
                    contributions.append(
                        ScoreContribution(
                            evidence_id=item.id,
                            weight=rule["weights"][index],
                            explanation=rule["explanation"],
                        )
                    )
        missing = missing_evidence(case, cause_id)
        causes.append(
            RankedCause(
                hypothesis_id=cause_id,
                label=label,
                score=sum(c.weight for c in contributions),
                confirmed=confirmed and index == 0,
                contributions=contributions,
                missing_evidence=missing,
            )
        )
    case.ranking = sorted(causes, key=lambda c: -c.score)
    # Cached templates are populated only from this case's current rule contributions.
    case.findings = [
        AgentFinding(
            agent="fluid_path_specialist"
            if c.hypothesis_id != "material_viscosity_change"
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


def apply_action(case: Case, action: CaseAction) -> Case:
    state = case.investigation.state

    def require(condition, message="This action is not available in the current case state."):
        if not condition:
            raise HTTPException(409, message)

    if action.action == "attach_log":
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
        case.next_question = question(option.next_question_id) if option.next_question_id else None
        case.questions_complete = case.next_question is None
        transition(case, "diagnosing", f"Answered: {current.prompt} {option.label}")
    elif action.action == "diagnose":
        require(case.questions_complete and case.diagnosis_supported and not case.ranking)
        rank(case)
        case.recommendation = load_golden_scenario().recommendations[0]
        transition(
            case, "inspection_recommended", "Ranked three causes; inspect to test restriction."
        )
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
                r for r in load_golden_scenario().recommendations if r.id == "material"
            )
            transition(case, "diagnosing", "No obstruction; review material conditions next.")
    elif action.action == "complete_action":
        require(state == "cause_confirmed")
        evidence(
            case,
            "corrective_action",
            "Simulated site-approved cartridge replacement recorded",
            source_ref="confirmed_action",
            verified=True,
        )
        transition(case, "corrective_action_completed", "Simulated corrective action confirmed.")
    elif action.action == "verify":
        require(state == "corrective_action_completed")
        case.verification = sample_measurement(action.sample_id)
        evidence(
            case,
            "verification_passed",
            case.verification.passed,
            "synthetic_image_measurement",
            case.verification.image_url,
            verified=True,
        )
        transition(
            case,
            "verification_passed" if case.verification.passed else state,
            "Verification passed."
            if case.verification.passed
            else "Verification failed; case remains open. Select another sample to retry.",
        )
    elif action.action == "resolve":
        require(state == "verification_passed" and case.verification and case.verification.passed)
        case.summary = CaseSummary(
            problem=case.investigation.title,
            confirmed_cause="Cartridge / nozzle restriction",
            corrective_action="Simulated site-approved cartridge replacement recorded",
            verification=f"Mean {case.verification.mean_diameter_px} px; all dots within 28–32 px.",
            evidence_ids=[e.id for e in case.investigation.evidence],
        )
        transition(case, "resolved", "Resolution explicitly confirmed; case summary saved.")
    case.revision += 1
    return case


router = APIRouter(prefix="/api", tags=["cases"])


@router.get("/demo/images", response_model=list[Measurement])
def images():
    return [sample_measurement(s) for s in ("normal", "undersized", "oversized", "missing")]


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


@router.post("/investigations", response_model=Case, status_code=201)
def new_case(request: CreateCase):
    case = create_case(request)

    def save(session):
        session.add(
            CaseRecord(id=case.investigation.id, revision=0, payload=case.model_dump(mode="json"))
        )
        return case

    return database_operation(save)


@router.get("/investigations/{case_id}", response_model=Case)
def get_case(case_id: str):
    def get(session):
        record = session.get(CaseRecord, case_id)
        if record is None:
            raise HTTPException(404, "Case not found.")
        return normalize_case(Case.model_validate(record.payload))

    return database_operation(get)


@router.post("/investigations/{case_id}/actions", response_model=Case)
def act(case_id: str, action: CaseAction):
    def change(session):
        record = session.execute(
            select(CaseRecord).where(CaseRecord.id == case_id)
        ).scalar_one_or_none()
        if record is None:
            raise HTTPException(404, "Case not found.")
        if record.revision != action.revision:
            raise HTTPException(409, "Case changed. Reload the saved case before trying again.")
        case = apply_action(normalize_case(Case.model_validate(record.payload)), action)
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
        return case

    return database_operation(change)
