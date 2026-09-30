"""Bounded originals stored locally. Hashes describe bytes, not a claim of source authenticity."""

import hashlib
import io
import re
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from pydantic import Field
from sqlalchemy import JSON, LargeBinary, String, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column
from starlette.concurrency import run_in_threadpool

from flowpilot.incidents.access import Actor, require_permission
from flowpilot.incidents.service import database_operation, get_incident, now
from flowpilot.investigations.models import Contract
from flowpilot.persistence.database import Base
from flowpilot.settings import Settings


class Artifact(Contract):
    id: str
    incident_id: str
    filename: str
    media_type: str
    sha256: str
    size_bytes: int
    created_at: str
    expires_at: str
    created_by: str
    status: Literal["available", "deleted", "expired"] = "available"
    deleted_at: str | None = None
    deleted_by: str | None = None
    deletion_reason: str | None = None


class ArtifactRecord(Base):
    __tablename__ = "incident_artifacts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    incident_id: Mapped[str] = mapped_column(String, nullable=False)
    sha256: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[bytes | None] = mapped_column(LargeBinary)
    details: Mapped[dict] = mapped_column("metadata", JSON, nullable=False)


class DeleteArtifact(Contract):
    reason: str = Field(min_length=1, max_length=1000, pattern=r".*\S.*")


class RetentionResult(Contract):
    dry_run: bool
    artifact_ids: list[str]


router = APIRouter(tags=["incident originals"], dependencies=[Depends(require_permission("view"))])


def read_artifact(incident_id: str, artifact_id: str) -> Artifact:
    def read(session):
        row = session.get(ArtifactRecord, artifact_id)
        if row is None or row.incident_id != incident_id:
            raise HTTPException(404, "Original file not found for this incident.")
        metadata = Artifact.model_validate(row.details)
        if metadata.status != "available" or datetime.fromisoformat(
            metadata.expires_at
        ) <= datetime.now(UTC):
            raise HTTPException(
                410, "Original file deleted or retention expired; provenance retained."
            )
        return metadata

    return database_operation(read)


@router.post("/api/incidents/{incident_id}/artifacts", response_model=Artifact, status_code=201)
async def upload_original(
    incident_id: str,
    request: Request,
    filename: str = Query(min_length=1, max_length=200, pattern=r"^[^/\\\x00-\x1f]+$"),
    actor: Actor = Depends(require_permission("edit")),
):
    get_incident(incident_id)
    settings = Settings()
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > settings.incident_artifact_limit_bytes:
            raise HTTPException(413, "Original exceeds the configured upload limit.")
        data.extend(chunk)
    return await run_in_threadpool(
        archive_artifact,
        incident_id,
        bytes(data),
        filename,
        request.headers.get("Content-Type", "application/octet-stream").split(";")[0],
        actor.subject or "unknown",
        request.headers.get("X-Content-SHA256"),
    )


def archive_artifact(
    incident_id: str,
    data: bytes,
    filename: str,
    media_type: str,
    actor: str,
    expected_sha256: str | None = None,
) -> Artifact:
    get_incident(incident_id)
    settings = Settings()
    if not 1 <= len(filename) <= 200 or re.search(r"[/\\\x00-\x1f]", filename):
        raise HTTPException(422, "Use a filename without a path or control bytes.")
    if len(data) > settings.incident_artifact_limit_bytes:
        raise HTTPException(413, "Original exceeds the configured upload limit.")
    if not data:
        raise HTTPException(422, "Original file is empty.")
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha256 and expected_sha256 != digest:
        raise HTTPException(422, "Original byte hash does not match X-Content-SHA256.")
    if media_type.startswith("image/"):
        try:
            with Image.open(io.BytesIO(data)) as picture:
                if picture.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Unsupported image")
                media_type = Image.MIME[picture.format]
                picture.verify()
        except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError) as error:
            raise HTTPException(422, "Use a valid PNG, JPEG or WebP original.") from error
    elif media_type not in {"text/plain", "text/csv", "application/json", "application/pdf"}:
        media_type = "application/octet-stream"
    metadata = Artifact(
        id=f"ART-{uuid4().hex}",
        incident_id=incident_id,
        filename=filename,
        media_type=media_type,
        sha256=digest,
        size_bytes=len(data),
        created_at=now(),
        created_by=actor,
        expires_at=(
            datetime.now(UTC) + timedelta(days=settings.incident_retention_days)
        ).isoformat(),
    )

    def save(session):
        existing = session.scalar(
            select(ArtifactRecord).where(
                ArtifactRecord.incident_id == incident_id,
                ArtifactRecord.sha256 == digest,
            )
        )
        if existing:
            return Artifact.model_validate(existing.details)
        session.add(
            ArtifactRecord(
                id=metadata.id,
                incident_id=incident_id,
                sha256=digest,
                content=bytes(data),
                details=metadata.model_dump(mode="json"),
            )
        )
        session.flush()
        return metadata

    try:
        return database_operation(save)
    except IntegrityError:
        return database_operation(save)


@router.get("/api/incidents/{incident_id}/artifacts", response_model=list[Artifact])
def list_originals(incident_id: str):
    get_incident(incident_id)

    def read(session):
        result = []
        for row in session.scalars(
            select(ArtifactRecord).where(ArtifactRecord.incident_id == incident_id)
        ):
            metadata = Artifact.model_validate(row.details)
            if metadata.status == "available" and datetime.fromisoformat(
                metadata.expires_at
            ) <= datetime.now(UTC):
                metadata.status = "expired"
            result.append(metadata)
        return result

    return database_operation(read)


@router.get("/api/incidents/{incident_id}/artifacts/{artifact_id}")
def download_original(incident_id: str, artifact_id: str):
    metadata = read_artifact(incident_id, artifact_id)

    def read(session):
        row = session.get(ArtifactRecord, artifact_id)
        if row.content is None:
            raise HTTPException(410, "Original file was deleted.")
        if hashlib.sha256(row.content).hexdigest() != metadata.sha256:
            raise HTTPException(409, "Original byte integrity check failed.")
        return Response(
            row.content,
            media_type=metadata.media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{artifact_id}"',
                "X-Content-SHA256": metadata.sha256,
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store",
            },
        )

    return database_operation(read)


def erase(
    session, row: ArtifactRecord, actor: str, reason: str, status: str = "deleted"
) -> Artifact:
    metadata = Artifact.model_validate(row.details)
    if metadata.status == "available":
        metadata.status = status
        metadata.deleted_at, metadata.deleted_by, metadata.deletion_reason = now(), actor, reason
        row.content, row.details = None, metadata.model_dump(mode="json")
        from flowpilot.incidents.models import Incident, IncidentEvent
        from flowpilot.incidents.service import (
            IncidentRecord,
            active_evidence,
            digest,
            invalidate_conclusion,
            refresh_draft,
        )

        saved = session.get(IncidentRecord, metadata.incident_id)
        if saved:
            incident = Incident.model_validate(saved.payload)
            linked = [item for item in active_evidence(incident) if item.artifact_id == metadata.id]
            if linked:
                expected_revision = incident.revision
                incident.revision += 1
                incident.updated_at = now()
                for original in linked:
                    correction = original.model_copy(
                        update={
                            "id": f"unavailable-{uuid4().hex}",
                            "status": "unavailable",
                            "supersedes_id": original.id,
                            "correction_reason": reason,
                            "ingested_at": now(),
                        }
                    )
                    correction.integrity_ref = digest(
                        correction.model_dump(exclude={"integrity_ref"})
                    )
                    incident.evidence.append(correction)
                invalidate_conclusion(incident)
                refresh_draft(incident)
                incident.history.append(
                    IncidentEvent(
                        revision=incident.revision,
                        action="original_unavailable",
                        timestamp=now(),
                        actor=actor,
                        detail=f"Original {metadata.id} {status}: {reason}",
                    )
                )
                result = session.execute(
                    update(IncidentRecord)
                    .where(
                        IncidentRecord.id == incident.id,
                        IncidentRecord.revision == expected_revision,
                    )
                    .values(revision=incident.revision, payload=incident.model_dump(mode="json"))
                )
                if result.rowcount != 1:
                    raise HTTPException(409, "Incident changed; retry original removal.")
    return metadata


def reconcile_expired_originals(session, incident_id: str) -> int:
    """Invalidate dependent evidence through the same audited path as explicit retention."""
    from flowpilot.incidents.models import Incident
    from flowpilot.incidents.service import IncidentRecord, active_evidence

    incident = session.get(IncidentRecord, incident_id)
    if incident is None:
        return 0
    artifact_ids = {
        item.artifact_id
        for item in active_evidence(Incident.model_validate(incident.payload))
        if item.artifact_id
    }
    if not artifact_ids:
        return 0
    expired = 0
    for row in session.scalars(
        select(ArtifactRecord).where(
            ArtifactRecord.incident_id == incident_id, ArtifactRecord.id.in_(artifact_ids)
        )
    ):
        metadata = Artifact.model_validate(row.details)
        if metadata.status == "available" and datetime.fromisoformat(
            metadata.expires_at
        ) <= datetime.now(UTC):
            erase(
                session,
                row,
                "system:incident-retention",
                "Configured retention expired.",
                "expired",
            )
            expired += 1
    return expired


@router.delete("/api/incidents/{incident_id}/artifacts/{artifact_id}", response_model=Artifact)
def delete_original(
    incident_id: str,
    artifact_id: str,
    request: DeleteArtifact,
    actor: Actor = Depends(require_permission("manage_data")),
):
    def remove(session):
        row = session.get(ArtifactRecord, artifact_id)
        if row is None or row.incident_id != incident_id:
            raise HTTPException(404, "Original file not found for this incident.")
        return erase(session, row, actor.subject or "unknown", request.reason)

    return database_operation(remove)


@router.post("/api/incident-artifacts/retention", response_model=RetentionResult)
def enforce_retention(
    dry_run: bool = True,
    actor: Actor = Depends(require_permission("manage_data")),
):
    def remove(session):
        ids = []
        # ponytail: local pilot scan; index expires_at if the corpus grows beyond one site.
        for row in session.scalars(
            select(ArtifactRecord).where(ArtifactRecord.content.is_not(None))
        ):
            metadata = Artifact.model_validate(row.details)
            if datetime.fromisoformat(metadata.expires_at) <= datetime.now(UTC):
                ids.append(row.id)
                if not dry_run:
                    erase(
                        session,
                        row,
                        actor.subject or "unknown",
                        "Configured retention expired.",
                        "expired",
                    )
        return RetentionResult(dry_run=dry_run, artifact_ids=ids)

    return database_operation(remove)
