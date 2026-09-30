"""Reviewed replay experience, kept separate from current-incident evidence."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from flowpilot.incidents.access import require_permission
from flowpilot.incidents.models import Incident
from flowpilot.investigations.models import Contract


class IncidentExperience(Contract):
    incident_id: str
    source_revision: int
    review_version: int
    citation: str
    configuration: str
    mode: str
    symptom: str
    outcome: str
    summary: str
    reviewed_by: str
    reviewed_at: str
    evidence_ids: list[str]
    source_refs: list[str]
    limitation: str = (
        "Reviewed development experience, not an approved operating procedure or "
        "evidence that this incident has the same cause."
    )


router = APIRouter(
    prefix="/api/incidents",
    tags=["incident experience"],
    dependencies=[Depends(require_permission("view"))],
)


def compatible_experience(current: Incident, candidates: list[Incident], query: str = ""):
    matches = []
    for source in candidates:
        learning = source.learning
        if (
            source.id == current.id
            or source.configuration != current.configuration
            or source.mode != current.mode
            or source.status != "closed"
            or source.closure is None
            or not learning
            or learning.status != "published"
            or not learning.reviews
            or learning.reviews[-1].decision != "approve"
            or datetime.fromisoformat(source.closure.closed_at)
            > datetime.fromisoformat(current.created_at)
        ):
            continue
        review = learning.reviews[-1]
        if query.casefold() not in (source.symptom + " " + learning.summary).casefold():
            continue
        matches.append(
            IncidentExperience(
                incident_id=source.id,
                source_revision=learning.source_revision,
                review_version=review.version,
                citation=f"{source.id}@r{learning.source_revision}/review-{review.version}",
                configuration=source.configuration,
                mode=source.mode,
                symptom=source.symptom,
                outcome=learning.outcome,
                summary=learning.summary,
                reviewed_by=review.reviewer,
                reviewed_at=review.timestamp,
                evidence_ids=learning.evidence_ids,
                source_refs=learning.source_refs,
            )
        )
    return sorted(matches, key=lambda match: match.reviewed_at, reverse=True)


@router.get("/{incident_id}/experience", response_model=list[IncidentExperience])
def past_experience(
    incident_id: str,
    q: str = Query(default="", max_length=200),
    limit: int = Query(default=5, ge=1, le=20),
):
    from flowpilot.incidents.service import IncidentRecord, database_operation, load_incident

    def read(session):
        current = load_incident(session, incident_id)
        # ponytail: scan the local prototype corpus; index configuration/status at pilot scale.
        candidates = [
            load_incident(session, source_id)
            for source_id in session.scalars(select(IncidentRecord.id)).all()
        ]
        return compatible_experience(current, candidates, q)[:limit]

    return database_operation(read)
