"""Durable replay incident operations; no machine-control or email-delivery capability."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import JSON, Integer, String, select, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Mapped, Session, mapped_column

from flowpilot.incidents import diagnostic
from flowpilot.incidents.models import (
    AssessmentSnapshot,
    Closure,
    CreateIncident,
    EvidenceInput,
    HandoffDraft,
    Incident,
    IncidentAction,
    IncidentEvent,
    IncidentEvidence,
    IncidentObservation,
    LearningCandidate,
    LearningReview,
)
from flowpilot.incidents.replay import replay_arrivals
from flowpilot.persistence.database import Base, make_engine


class IncidentRecord(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    trigger_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


def now() -> str:
    return datetime.now(UTC).isoformat()


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def database_operation(operation):
    engine = make_engine()
    try:
        with Session(engine) as session, session.begin():
            return operation(session)
    except OperationalError as error:
        raise HTTPException(
            503, "Incident storage unavailable. Run database migrations."
        ) from error
    finally:
        engine.dispose()


def list_incidents(limit: int = 30) -> list[Incident]:
    def listing(session):
        # ponytail: scan local prototype snapshots; index updated_at for a multi-site pilot.
        items = [
            load_incident(session, incident_id)
            for incident_id in session.scalars(select(IncidentRecord.id)).all()
        ]
        return sorted(items, key=lambda item: item.updated_at, reverse=True)[:limit]

    return database_operation(listing)


def load_incident(session: Session, incident_id: str) -> Incident:
    from flowpilot.incidents.artifacts import reconcile_expired_originals

    row = session.get(IncidentRecord, incident_id)
    if row is None:
        raise HTTPException(404, "Incident not found.")
    if reconcile_expired_originals(session, incident_id):
        session.refresh(row)
    return Incident.model_validate(row.payload)


def get_incident(incident_id: str) -> Incident:
    return database_operation(lambda session: load_incident(session, incident_id))


def active_evidence(incident: Incident) -> list[IncidentEvidence]:
    superseded = {item.supersedes_id for item in incident.evidence if item.supersedes_id}
    return [item for item in incident.evidence if item.id not in superseded]


def active_observations(incident: Incident) -> list[IncidentObservation]:
    from flowpilot.incidents.graph import excluded_observations

    superseded = {item.supersedes_id for item in incident.observations if item.supersedes_id}
    superseded.update(excluded_observations(incident))
    evidence_ids = {item.id for item in active_evidence(incident) if item.status == "collected"}
    return [
        item
        for item in incident.observations
        if item.id not in superseded and set(item.evidence_ids) <= evidence_ids
    ]


def evidence_record(item: EvidenceInput, incident: Incident | None = None, **changes):
    if incident is not None:
        if item.tool_id is not None and item.tool_id != incident.tool_id:
            raise HTTPException(422, "Evidence belongs to another tool; association is unresolved.")
        if item.configuration is not None and item.configuration != incident.configuration:
            raise HTTPException(422, "Evidence configuration does not match this incident.")
    if item.artifact_id:
        from flowpilot.incidents.artifacts import read_artifact

        if incident is None:
            raise HTTPException(422, "An original file must belong to a saved incident.")
        artifact = read_artifact(incident.id, item.artifact_id)
        changes["raw_integrity_ref"] = artifact.sha256
        if item.image_url and item.image_url != (
            f"/api/incidents/{incident.id}/artifacts/{artifact.id}"
        ):
            raise HTTPException(422, "Image reference must match its preserved original.")
    elif item.image_url and item.image_url.startswith("/api/incidents/"):
        raise HTTPException(422, "Preserved image references need an artifact ID.")
    return IncidentEvidence(
        **item.model_dump(), ingested_at=now(), integrity_ref=digest(item.model_dump()), **changes
    )


def draft_for(incident: Incident, human_body: str | None = None) -> HandoffDraft:
    evidence = active_evidence(incident)
    facts = [
        f"- {item.label} [{item.id}]: event {item.event_time or 'unknown'}; "
        f"source {item.source_ref}; synthetic: {item.synthetic}."
        for item in evidence
        if item.status == "collected"
    ]
    unknowns = [f"- {item.label}: {item.status}" for item in evidence if item.status != "collected"]
    if any(item.time_uncertain for item in evidence):
        unknowns.append("- Event ordering is uncertain; image/control-PC clocks are not aligned.")
    boundaries = []
    for role, label in [("last_good", "Last known good"), ("first_bad", "First known bad")]:
        item = next(
            (item for item in evidence if item.role == role and item.status == "collected"), None
        )
        boundaries.append(
            f"- {label}: {item.id}, {item.event_time or 'time unknown'}, "
            f"lot {item.lot_id or 'unknown'}, tray {item.tray_id or 'unknown'}, "
            f"unit {item.unit_id or 'unknown'}."
            if item
            else f"- {label}: unavailable."
        )
    investigation = ["- Diagnosis is pending; no cause is confirmed."]
    if incident.assessment:
        investigation = [
            f"- Assessment: {incident.assessment.summary}",
            *[
                f"- {hypothesis.rank}. {hypothesis.title}: {hypothesis.status}; "
                f"{hypothesis.explanation}"
                for hypothesis in incident.assessment.hypotheses
            ],
            f"- Next: {incident.assessment.next_step.title}. "
            f"{incident.assessment.next_step.reason}",
        ]
        unknowns.extend(f"- {item}" for item in incident.assessment.unresolved)
    investigation.extend(
        f"- Simulated {item.check_id}: {item.result}; evidence {', '.join(item.evidence_ids)}."
        for item in active_observations(incident)
    )
    if incident.investigation.nodes:
        investigation.append(
            f"- Saved investigation path: {len(incident.investigation.nodes)} nodes, "
            f"{len(incident.investigation.answers)} original answers; full path in the report."
        )
    body = "\n".join(
        [
            f"Incident {incident.id} — {incident.tool_id}",
            f"Configuration: {incident.configuration}",
            f"Trigger: {incident.trigger_origin} / {incident.trigger_id} "
            f"at {incident.trigger_time}",
            f"Opened: {incident.created_at}; draft source revision {incident.revision}.",
            f"Symptom: {incident.symptom}",
            f"Mode: {incident.mode}; no live equipment connection or validated diagnosis.",
            "Severity: not assessed. Equipment/production disposition: not assessed.",
            "",
            "Known defect boundary (affected extent remains unconfirmed):",
            *boundaries,
            "",
            "Known evidence:",
            *(facts or ["- Collection has started; no source collected yet."]),
            "",
            "Unknown or missing:",
            *(unknowns or ["- No missing sources recorded."]),
            "",
            "Investigation:",
            *investigation,
            *(
                [f"- Closure: {incident.closure.outcome}. {incident.closure.notes}"]
                if incident.closure
                else []
            ),
            "",
            f"Workspace: /incidents/{incident.id}",
            f"Report: /api/incidents/{incident.id}/report.md",
            "",
            "Engineering help requested: review competing causes, missing records and "
            "applicable controlled procedures before any equipment action.",
            "Draft only. No email has been sent.",
        ]
    )
    return HandoffDraft(
        subject=f"[Severity unassessed] {incident.tool_id}: "
        f"{incident.symptom[:100]} — {incident.id}",
        body=human_body if human_body is not None else body,
        version=max((draft.version for draft in incident.handoff_history), default=0) + 1,
        source_revision=incident.revision,
        created_at=now(),
        human_edited=human_body is not None,
    )


def refresh_draft(incident: Incident, human_body: str | None = None):
    draft = draft_for(incident, human_body)
    incident.handoff_history.append(draft)
    # Preserve the active engineer edit while saving a refreshed generated suggestion.
    if not incident.handoff.human_edited or human_body is not None:
        incident.handoff = draft


def create_incident(request: CreateIncident, owner: str | None = None) -> Incident:
    trigger_key = digest([request.tool_id, request.trigger_id])
    fingerprint = digest(request.model_dump(mode="json"))

    def existing(session):
        row = session.scalar(
            select(IncidentRecord).where(IncidentRecord.trigger_key == trigger_key)
        )
        if row is None:
            return None
        incident = load_incident(session, row.id)
        if incident.trigger_fingerprint != fingerprint:
            raise HTTPException(409, "Trigger ID already exists with a different original package.")
        return incident

    saved = database_operation(existing)
    if saved:
        return saved
    timestamp = now()
    incident = Incident(
        id=f"INC-{uuid4().hex[:12]}",
        trigger_id=request.trigger_id,
        trigger_fingerprint=fingerprint,
        trigger_origin=request.trigger_origin,
        trigger_time=request.trigger_time or timestamp,
        tool_id=request.tool_id,
        configuration=request.configuration,
        symptom=request.symptom,
        mode=request.mode,
        created_at=timestamp,
        updated_at=timestamp,
        status="evidence_collecting",
        owner=owner,
        waiting_for="missing_data" if not request.evidence else None,
        handoff=HandoffDraft(
            subject="", body="", version=0, source_revision=0, created_at=timestamp
        ),
    )
    incident.evidence = [evidence_record(item, incident) for item in request.evidence]
    refresh_draft(incident)
    incident.history.append(
        IncidentEvent(
            revision=0,
            action="create",
            timestamp=timestamp,
            detail="Incident saved with a partial handoff; diagnosis has not been requested.",
        )
    )

    def save(session):
        session.add(
            IncidentRecord(
                id=incident.id,
                trigger_key=trigger_key,
                revision=0,
                payload=incident.model_dump(mode="json"),
            )
        )
        session.flush()
        return incident

    try:
        return database_operation(save)
    except IntegrityError:
        saved = database_operation(existing)
        if saved is None:
            raise
        return saved


def assess(incident: Incident):
    from flowpilot.incidents import graph
    from flowpilot.incidents.coordinator import input_fingerprint

    evidence = [
        item.model_dump(mode="json")
        for item in active_evidence(incident)
        if item.status == "collected"
    ]
    observations = [item.model_dump(mode="json") for item in active_observations(incident)]
    baseline = diagnostic.analyze(evidence, observations, incident.configuration)
    from flowpilot.incidents.knowledge import applicable_sources
    from flowpilot.incidents.rag import DOCUMENT_ID as RAG_DOCUMENT_ID

    try:
        baseline.sources.extend(
            diagnostic.SourcePassage.model_validate(source.model_dump(mode="json"))
            for source in applicable_sources(incident.configuration)
            if source.document_id != RAG_DOCUMENT_ID
        )
    except HTTPException as error:
        if error.status_code != 503:
            raise
        baseline.warnings.append(
            "Controlled-source retrieval failed; operational methods remain blocked."
        )

    incident.assessment = baseline
    asyncio.run(graph.advance(incident, input_fingerprint(incident)))
    incident.assessment_history.append(
        AssessmentSnapshot(
            incident_revision=incident.revision,
            created_at=now(),
            assessment=incident.assessment,
        )
    )
    incident.status = "review" if incident.escalated else "investigating"
    incident.waiting_for = (
        "engineer"
        if incident.escalated or incident.assessment.next_step.kind in {"review", "escalate"}
        else "observation"
    )


def invalidate_conclusion(incident: Incident):
    from flowpilot.incidents.graph import invalidate_evidence

    invalidate_evidence(incident)
    incident.assessment = None
    if incident.closure:
        incident.closure_history.append(incident.closure)
        incident.closure = None
    if incident.learning and incident.learning.status != "withdrawn":
        incident.learning.status = "withdrawn"
        incident.learning.reviews.append(
            LearningReview(
                version=len(incident.learning.reviews) + 1,
                reviewer="system",
                decision="withdraw",
                notes="New evidence or observations supersede the reviewed source snapshot.",
                timestamp=now(),
            )
        )
    incident.status = "review" if incident.escalated else "investigating"
    if incident.escalated:
        incident.waiting_for = "engineer"


def apply_action(incident: Incident, action: IncidentAction, actor: str | None = None) -> Incident:
    from flowpilot.incidents.graph import GRAPH_ACTIONS, apply_graph_action

    incident.revision += 1
    incident.updated_at = now()
    detail = action.action.replace("_", " ")
    if action.action in GRAPH_ACTIONS:
        apply_graph_action(incident, action, actor)
        if action.action != "select_investigation":
            invalidate_conclusion(incident)
        detail = "Investigation action saved; original answers and earlier paths retained."
    elif action.action == "advance_replay":
        if incident.mode != "replay":
            raise HTTPException(422, "Only a replay incident has staged collection.")
        if incident.replay_stage:
            raise HTTPException(409, "All replay sources have already been collected.")
        for item in replay_arrivals():
            replaces = "machine-log-pending" if item.kind == "log" else None
            incident.evidence.append(evidence_record(item, incident, supersedes_id=replaces))
        incident.replay_stage = 1
        invalidate_conclusion(incident)
        detail = "Replay log and context collected; PM remains unavailable and clocks uncertain."
    elif action.action in {"add_evidence", "correct_evidence"}:
        if len(incident.evidence) >= 500:
            raise HTTPException(422, "Prototype incident evidence limit reached (500 records).")
        item = action.evidence if action.action == "add_evidence" else action.replacement
        if any(old.id == item.id for old in incident.evidence):
            raise HTTPException(422, "Use a new evidence ID; original records are immutable.")
        changes = {}
        if action.action == "correct_evidence":
            if action.evidence_id not in {old.id for old in active_evidence(incident)}:
                raise HTTPException(422, "Correct an active evidence record.")
            changes = {"supersedes_id": action.evidence_id, "correction_reason": action.reason}
        incident.evidence.append(evidence_record(item, incident, **changes))
        invalidate_conclusion(incident)
        detail = f"{action.action}: {item.id}; previous evidence and assessments retained."
    elif action.action == "analyze":
        if incident.status == "closed":
            raise HTTPException(409, "Add new evidence before reopening this closed incident.")
        assess(incident)
    elif action.action == "record_result":
        checks = {"delivery_review", "restriction_review", "material_review"}
        questions = {
            f"question_{key}"
            for key in ("material", "coverage", "frequency", "recent_changes", "location")
        }
        if action.check_id not in checks | questions:
            raise HTTPException(422, "Unknown question or check.")
        if not action.synthetic:
            raise HTTPException(422, "This prototype accepts labelled simulated results only.")
        if incident.mode == "live" and action.check_id in checks:
            raise HTTPException(422, "Replay checks cannot confirm an actual equipment incident.")
        previous = next(
            (
                item
                for item in reversed(active_observations(incident))
                if item.check_id == action.check_id
            ),
            None,
        )
        if action.check_id in checks and (
            incident.assessment is None
            or not any(
                item.id == action.check_id and (item.eligible or previous is not None)
                for item in incident.assessment.checks
            )
        ):
            raise HTTPException(422, "Analyze the incident and choose an eligible replay check.")
        if action.check_id in checks and action.result not in {
            "supported",
            "contradicted",
            "inconclusive",
        }:
            raise HTTPException(
                422, "Use supported, contradicted or inconclusive for a replay check."
            )
        evidence_ids = {item.id for item in active_evidence(incident) if item.status == "collected"}
        if not set(action.evidence_ids) <= evidence_ids:
            raise HTTPException(422, "Results must reference active collected evidence.")
        linked_ids = action.evidence_ids or (
            sorted(evidence_ids) if action.check_id in checks else []
        )
        incident.observations.append(
            IncidentObservation(
                id=f"OBS-{uuid4().hex[:12]}",
                check_id=action.check_id,
                result=action.result,
                notes=action.notes,
                evidence_ids=linked_ids,
                synthetic=True,
                extraction_confidence=action.extraction_confidence,
                author=actor,
                recorded_at=now(),
                # Updating an answer corrects it; another check result is independent evidence.
                supersedes_id=previous.id if previous and action.check_id in questions else None,
            )
        )
        invalidate_conclusion(incident)
        from flowpilot.settings import Settings

        if not Settings().incident_auto_process:
            assess(incident)
        detail = f"Recorded simulated {action.check_id}: {action.result}."
    elif action.action == "edit_handoff":
        refresh_draft(incident, action.body)
    elif action.action == "refresh_handoff":
        pass  # The shared refresh below saves a suggestion without overwriting human edits.
    elif action.action == "escalate":
        incident.escalated = True
        incident.waiting_for = "engineer"
        if incident.status != "closed":
            incident.status = "review"
        detail = f"Engineer review requested. {action.notes}".strip()
    elif action.action == "close":
        if incident.status == "closed":
            raise HTTPException(409, "Incident is already closed.")
        if action.outcome == "supported":
            if not action.conclusion or not action.conclusion.strip():
                raise HTTPException(422, "A supported outcome needs an evidence-based conclusion.")
            if (
                incident.assessment is None
                or not any(
                    hypothesis.status == "supported"
                    for hypothesis in incident.assessment.hypotheses
                )
                or not any(
                    item.check_id in {"delivery_review", "restriction_review", "material_review"}
                    and item.result == "supported"
                    for item in active_observations(incident)
                )
            ):
                raise HTTPException(
                    422, "Supported closure requires a current assessment and result."
                )
        incident.closure = Closure(
            outcome=action.outcome,
            notes=action.notes,
            reviewer=action.reviewer,
            conclusion=action.conclusion if action.outcome == "supported" else None,
            closed_at=now(),
            evidence_revision=action.revision,
        )
        incident.status = "closed"
        incident.waiting_for = None
        source = active_evidence(incident)
        if incident.learning:
            incident.learning_history.append(incident.learning.model_copy(deep=True))
        incident.learning = LearningCandidate(
            source_revision=incident.revision,
            source_fingerprint=digest(
                {
                    "evidence": [item.model_dump(mode="json") for item in source],
                    "observations": [
                        item.model_dump(mode="json") for item in active_observations(incident)
                    ],
                    "closure": incident.closure.model_dump(mode="json"),
                }
            ),
            outcome=action.outcome,
            summary=action.conclusion if action.outcome == "supported" else action.notes,
            source_refs=[item.source_ref for item in source],
            evidence_ids=[item.id for item in source]
            + [item.id for item in active_observations(incident)],
            source_evidence=source,
            source_observations=[
                item.model_copy(deep=True) for item in active_observations(incident)
            ],
            source_versions={
                item.id: f"{item.revision}; {item.approval_status}"
                for item in incident.assessment.sources
            }
            if incident.assessment
            else {},
        )
        detail = f"{action.reviewer} closed as {action.outcome}; equipment disposition unchanged."
    elif action.action == "review_learning":
        if incident.learning is None or incident.closure is None:
            raise HTTPException(422, "Close and capture the incident before reviewing learning.")
        incident.learning.status = "published" if action.decision == "approve" else "withdrawn"
        incident.learning.reviews.append(
            LearningReview(
                version=len(incident.learning.reviews) + 1,
                reviewer=action.reviewer,
                decision=action.decision,
                notes=action.notes,
                timestamp=now(),
            )
        )
        detail = f"Learning {action.decision} by {action.reviewer}: {action.notes}"
    if action.action != "edit_handoff":
        refresh_draft(incident)
    incident.history.append(
        IncidentEvent(
            revision=incident.revision,
            action=action.action,
            timestamp=incident.updated_at,
            detail=detail,
        )
    )
    return incident


BACKGROUND_ACTOR = "system:incident-coordinator"
BACKGROUND_EVENTS = {"background_analysis", "background_handoff"}
# The intent of these actions does not depend on the assessment or draft a background job refreshed.
REBASEABLE_ACTIONS = {"advance_replay", "analyze", "refresh_handoff"}


def only_background_changes(incident: Incident, since_revision: int) -> bool:
    later = [event for event in incident.history if event.revision > since_revision]
    return (
        since_revision < incident.revision
        and len({event.revision for event in later}) == incident.revision - since_revision
        and all(
            event.actor == BACKGROUND_ACTOR and event.action in BACKGROUND_EVENTS for event in later
        )
    )


def act(incident_id: str, action: IncidentAction, actor: str | None = None) -> Incident:
    rebaseable = action.action in REBASEABLE_ACTIONS
    for attempt in range(3):
        incident = get_incident(incident_id)
        if action.action == "answer_investigation":
            previous = next(
                (item for item in incident.investigation.answers if item.id == action.answer_id),
                None,
            )
            if previous:
                if previous.request_fingerprint != digest(action.model_dump(exclude={"revision"})):
                    raise HTTPException(
                        409, "This answer ID was already used for different content."
                    )
                return incident
        if incident.revision != action.revision:
            if not (rebaseable and only_background_changes(incident, action.revision)):
                raise HTTPException(409, "Incident changed. Reload before applying this action.")
        # Only background analysis/draft refreshes intervened; apply to the current revision.
        current = action.model_copy(update={"revision": incident.revision})
        # No database transaction remains open during diagnostic/provider work.
        incident = apply_action(incident, current, actor)
        incident.history[-1].actor = actor
        try:
            return save_incident(incident, current.revision, actor)
        except HTTPException as error:
            # A background job may commit while this action runs; re-check and retry.
            if error.status_code != 409 or not rebaseable or attempt == 2:
                raise


def save_incident(incident: Incident, expected_revision: int, actor: str | None = None) -> Incident:
    def save(session):
        from flowpilot.incidents.artifacts import reconcile_expired_originals

        # Providers run outside the transaction; originals can expire while they work.
        # Commit expiry invalidation even when this result has become stale.
        if reconcile_expired_originals(session, incident.id):
            return None
        result = session.execute(
            update(IncidentRecord)
            .where(
                IncidentRecord.id == incident.id,
                IncidentRecord.revision == expected_revision,
            )
            .values(revision=incident.revision, payload=incident.model_dump(mode="json"))
        )
        return incident if result.rowcount == 1 else None

    saved = database_operation(save)
    if saved is None:
        raise HTTPException(409, "Incident changed; this stale result was not saved.")
    return saved


def report_markdown(incident: Incident, communications=(), experiments=()) -> str:
    snapshot = digest(
        {
            "incident": incident.model_dump(mode="json"),
            "communications": [item.model_dump(mode="json") for item in communications],
            "experiments": [item.model_dump(mode="json") for item in experiments],
        }
    )
    lines = [
        f"# Incident {incident.id}",
        "",
        f"Recorded revision: {incident.revision}",
        f"Report snapshot SHA-256: {snapshot}",
        f"Tool/configuration: {incident.tool_id} / {incident.configuration}",
        f"Mode: {incident.mode}. Physical checks and production release are not authorized here.",
        f"Trigger: {incident.trigger_origin} / {incident.trigger_id} at {incident.trigger_time}.",
        f"Status: {incident.status}. Equipment disposition: {incident.disposition}.",
        "",
        "## Problem",
        "",
        incident.symptom,
        "",
        "## Evidence and timeline",
        "",
    ]
    superseded = {item.supersedes_id for item in incident.evidence if item.supersedes_id}
    for item in incident.evidence:
        offset = item.clock_offset_seconds if item.clock_offset_seconds is not None else "unknown"
        lines.extend(
            [
                f"- **{item.id}**: {item.label}; {item.status}"
                + ("; superseded" if item.id in superseded else ""),
                f"  Source: {item.source_ref}; metadata SHA-256: {item.integrity_ref}",
                f"  Original file: {item.artifact_id or 'not archived'}; raw byte SHA-256: "
                f"{item.raw_integrity_ref or 'not available'}",
                f"  Event: {item.event_time or 'unknown'};"
                f" timezone: {item.event_timezone or 'unknown'};"
                f" ingested: {item.ingested_at}; time uncertain: {item.time_uncertain}",
                f"  Recorded clock correction (not applied to raw timestamp): {offset} seconds.",
                f"  Provenance: {item.provenance}; synthetic: {item.synthetic}",
                f"  Values: {json.dumps(item.values, ensure_ascii=False)}",
            ]
        )
    from flowpilot.incidents.graph import report_lines

    lines.extend(report_lines(incident))
    if incident.conversation:
        lines.extend(["", "## Investigation conversation", ""])
        for turn in incident.conversation:
            lines.extend(
                [
                    f"- {turn.id} at {turn.recorded_at}; {turn.input_mode}; {turn.author}; "
                    f"{turn.intent} / {turn.status}; "
                    f"questions: {', '.join(turn.node_ids) or 'none'}.",
                    f"  Technician: {turn.text}",
                    f"  Agent: {turn.reply}",
                    *[
                        f"  Reference: {source.id}; {source.document_id}, {source.revision}; "
                        f"{source.section}; {source.approval_status}. {source.limitation}"
                        for source in turn.sources
                    ],
                ]
            )
    lines.extend(["", "## Assessment history", ""])
    for snapshot in incident.assessment_history:
        assessment = snapshot.assessment
        lines.extend(
            [
                f"### Incident revision {snapshot.incident_revision} — {snapshot.created_at}",
                "",
                assessment.summary,
                "",
                f"Decision provider: {assessment.provider}; version: {assessment.version}.",
                assessment.provider_status,
                "",
            ]
        )
        for hypothesis in assessment.hypotheses:
            lines.extend(
                [
                    f"{hypothesis.rank}. **{hypothesis.title} — {hypothesis.status}**",
                    f"   Mechanism (inferred): {hypothesis.mechanism}",
                    f"   Explanation: {hypothesis.explanation}",
                    "   Supports: "
                    + (
                        "; ".join(
                            f"[{item.evidence_id}] {item.explanation}"
                            for item in hypothesis.supporting_evidence
                        )
                        or "No supporting observation recorded."
                    ),
                    "   Conflicts: "
                    + (
                        "; ".join(
                            f"[{item.evidence_id}] {item.explanation}"
                            for item in hypothesis.conflicting_evidence
                        )
                        or "No conflicting observation recorded; absence is not confirmation."
                    ),
                    "   Missing: " + "; ".join(hypothesis.missing_evidence),
                    f"   How to distinguish: {hypothesis.how_to_test}",
                    "   Source passages: " + ", ".join(hypothesis.source_refs),
                    "",
                ]
            )
        if assessment.explanation.result:
            explanation = assessment.explanation.result
            lines.extend(
                [
                    "**Model explanation (requires review):** " + explanation.text,
                    f"Model: {assessment.explanation.model}; "
                    f"prompt: {assessment.explanation.prompt_version}.",
                    "Citations: " + ", ".join(explanation.evidence_ids + explanation.source_refs),
                    "Uncertainties: " + "; ".join(explanation.uncertainties),
                    "",
                ]
            )
        if assessment.decision:
            decision = assessment.decision
            lines.extend(
                [
                    f"Decision: {decision.selected_id}; baseline: {decision.baseline_id}; "
                    f"model: {decision.model_version or decision.requested_model}.",
                    decision.reason,
                    decision.limitation,
                    "",
                ]
            )
        lines.extend(
            [
                f"**Next step:** {assessment.next_step.title}. {assessment.next_step.reason}",
                "",
                "Unresolved:",
                *[f"- {item}" for item in assessment.unresolved],
                "",
                "Source versions and applicability:",
            ]
        )
        lines.extend(
            f"- {source.id}: {source.document_id}, {source.revision}, section {source.section}; "
            f"{source.authority}, {source.approval_status}; applicable: {source.applicable}; "
            f"operational instructions allowed: {source.operational_allowed}. "
            f"{source.limitation} ({source.file_path})"
            for source in assessment.sources
        )
        lines.extend(["", *[f"- Limitation: {item}" for item in assessment.warnings], ""])
    lines.extend(["## Questions and recorded checks", ""])
    for item in incident.observations:
        active = item.id in {entry.id for entry in active_observations(incident)}
        lines.append(
            f"- {item.id}: {item.check_id} → {item.result}; simulated: {item.synthetic}; "
            f"evidence: {', '.join(item.evidence_ids) or 'none linked'}; "
            f"{'active' if active else 'superseded or linked evidence withdrawn'}; {item.notes}"
        )
    if incident.simulations:
        lines.extend(["", "## Recorded simulations (synthetic only)", ""])
        for run in incident.simulations:
            lines.extend(
                [
                    f"- {run.id}: {run.scenario}; model {run.model_version}; "
                    f"fixture {run.fixture_version}.",
                    f"  Source revision: {run.source_revision}; context evidence: "
                    f"{', '.join(run.evidence_ids) or 'none'}.",
                    "  Parameters: " + json.dumps(run.parameters.model_dump()),
                    "  Units: " + json.dumps(run.units),
                    "  Assumptions: " + " ".join(run.assumptions),
                    "  Limits: " + " ".join(run.validity_limits),
                    "  Simulated outputs are not observations or approved diagnostic evidence.",
                    "",
                ]
            )
            lines.extend(
                [
                    "| Position | Fixture relative mass | Learned relative mass | "
                    "Fixture coverage | Learned coverage |",
                    "|---|---|---|---|---|",
                    *[
                        f"| {point.position:.3f} | {point.relative_mass:.4f} | "
                        f"{point.learned_relative_mass:.4f} | {point.coverage_fraction:.4f} | "
                        f"{point.learned_coverage_fraction:.4f} |"
                        for point in run.points
                    ],
                    "",
                ]
            )
    if experiments:
        lines.extend(["", "## Mock experiment plans and results", ""])
        for plan in experiments:
            lines.extend(
                [
                    f"### {plan.id} — {plan.status}, revision {plan.revision}",
                    "",
                    f"Plan version: {plan.plan_revision}; "
                    f"evidence revision: {plan.source_incident_revision}; "
                    f"source current: {plan.source_current}.",
                    f"Approved by: {plan.approved_by or 'not approved'}. "
                    f"Model: {plan.model_version}; fixture: {plan.fixture_version}.",
                    f"Source: {plan.source_passage.document_id} / {plan.source_passage.revision} / "
                    f"{plan.source_passage.section}; {plan.source_passage.approval_status}.",
                    f"Response: {plan.proposal.response}; "
                    f"repetitions: {plan.proposal.repetitions}.",
                    f"Analysis plan: {plan.analysis_plan}.",
                    "Prerequisites: " + " ".join(plan.prerequisites),
                    "Stopping conditions: " + " ".join(plan.stopping_conditions),
                    "Physical execution allowed: False. "
                    "All conditions and responses are simulated.",
                    "",
                    "| Run | Mechanism | Baseline | Severity | Delivery ratio | "
                    "Material ratio | Mean response | Baseline contrast |",
                    "|---|---|---|---|---|---|---|---|",
                ]
            )
            for condition in plan.matrix:
                result = next(
                    (row for row in plan.results if row.condition.index == condition.index), None
                )
                mean = f"{result.response_mean:.6f}" if result else "not run"
                contrast = f"{result.contrast_from_baseline:.6f}" if result else "not run"
                lines.append(
                    f"| {condition.index} | {condition.hypothesis_id} | {condition.baseline} | "
                    f"{condition.parameters.severity} | {condition.parameters.delivery_ratio} | "
                    f"{condition.parameters.material_ratio} | {mean} | {contrast} |"
                )
            if plan.analysis:
                lines.extend(
                    [
                        "",
                        f"Outcome: {plan.analysis.outcome}. {plan.analysis.summary}",
                        *[f"- {limit}" for limit in plan.analysis.limitations],
                    ]
                )
            lines.extend(
                [
                    "",
                    *[
                        f"- {event.action}: {event.actor} at {event.timestamp}; {event.detail}"
                        for event in plan.history
                    ],
                    "",
                ]
            )
    lines.extend(["", "## Conclusion and engineer notes", ""])
    if incident.closure:
        lines.extend(
            [
                f"Outcome: {incident.closure.outcome}; reviewer: {incident.closure.reviewer}",
                incident.closure.conclusion or "No cause confirmed.",
                incident.closure.notes,
            ]
        )
    else:
        lines.append("Investigation open; no final conclusion.")
    if incident.learning:
        lines.extend(
            [
                "",
                "## Reviewed learning",
                "",
                f"Status: {incident.learning.status}; "
                f"source revision {incident.learning.source_revision}.",
                "Recorded source fingerprint: " + incident.learning.source_fingerprint,
                *[
                    f"- Review {review.version}: {review.decision} by {review.reviewer} "
                    f"at {review.timestamp}; {review.notes}"
                    for review in incident.learning.reviews
                ],
            ]
        )
    lines.extend(
        ["", "## Handoff (draft only)", "", incident.handoff.subject, "", incident.handoff.body]
    )
    if communications:
        lines.extend(["", "## Communication snapshots", ""])
        for message in communications:
            label = "SIMULATED — no email sent" if message.transport == "mock" else "SMTP"
            lines.extend(
                [
                    f"### {message.id} — {label}",
                    "",
                    f"Status: {message.status}; communication revision: {message.revision}; "
                    f"incident revision: {message.incident_revision}; "
                    f"draft version: {message.draft_version}.",
                    f"Approval: {message.approved_by} at {message.approved_at}.",
                    "Recipients: " + ", ".join(message.recipients),
                    *[
                        f"- Attempt {attempt.number}: {attempt.status}; {attempt.detail}"
                        for attempt in message.attempts
                    ],
                    *[
                        f"- Receipt: {receipt.status}; {receipt.reference}; "
                        f"recorded by {receipt.actor}; {receipt.notes}"
                        for receipt in message.receipts
                    ],
                    "",
                    "Preserved communication content:",
                    "",
                    message.subject,
                    "",
                    message.body,
                    "",
                ]
            )
    lines.extend(["", "## Application audit", ""])
    lines.extend(f"- r{e.revision} {e.timestamp}: {e.detail}" for e in incident.history)
    return "\n".join(lines) + "\n"
