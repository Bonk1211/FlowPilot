"""Immutable source passages and reviewed applicability, separate from incident experience."""

import hashlib
import json
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, model_validator
from sqlalchemy import JSON, Integer, String, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from flowpilot.incidents.access import require_permission
from flowpilot.incidents.service import database_operation
from flowpilot.investigations.models import Contract
from flowpilot.persistence.database import Base


class SourcePassageInput(Contract):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.:-]+$")
    section: str = Field(min_length=1, max_length=150, pattern=r".*\S.*")
    page: str | None = Field(default=None, max_length=40)
    text: str = Field(min_length=1, max_length=20000, pattern=r"[\s\S]*\S[\s\S]*")


class SourceDocumentInput(Contract):
    document_id: str = Field(min_length=1, max_length=150, pattern=r".*\S.*")
    document_revision: str = Field(min_length=1, max_length=100, pattern=r".*\S.*")
    title: str = Field(min_length=1, max_length=200, pattern=r".*\S.*")
    configurations: list[str] = Field(min_length=1, max_length=50)
    authority: Literal["controlled_procedure", "secondary_summary", "example"]
    original_ref: str = Field(min_length=1, max_length=1000, pattern=r".*\S.*")
    original_sha256: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{64}$")
    passages: list[SourcePassageInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_content(self):
        if len({item.id for item in self.passages}) != len(self.passages):
            raise ValueError("Passage IDs must be unique within a document revision.")
        if any(not value.strip() or len(value) > 150 for value in self.configurations):
            raise ValueError("Configuration names must contain 1–150 characters.")
        if len(json.dumps(self.model_dump())) > 200000:
            raise ValueError("A source revision may contain at most 200 KB of passage metadata.")
        return self


class SourceReview(Contract):
    version: int
    decision: Literal["publish", "withdraw"]
    actor: str
    notes: str
    timestamp: str


class IncidentSourceDocument(Contract):
    id: str
    revision: int = 1
    status: Literal["draft", "published", "withdrawn"] = "draft"
    content: SourceDocumentInput
    content_digest: str
    submitted_by: str
    created_at: str
    reviews: list[SourceReview] = Field(default_factory=list)


class SourceReviewRequest(Contract):
    revision: int = Field(ge=1)
    decision: Literal["publish", "withdraw"]
    notes: str = Field(min_length=1, max_length=3000, pattern=r"[\s\S]*\S[\s\S]*")


class SourceConflictInput(Contract):
    source_ids: list[str] = Field(min_length=2, max_length=20)
    description: str = Field(min_length=1, max_length=3000, pattern=r"[\s\S]*\S[\s\S]*")

    @model_validator(mode="after")
    def distinct_sources(self):
        if len(set(self.source_ids)) != len(self.source_ids):
            raise ValueError("A conflict must identify distinct source revisions.")
        return self


class ConflictReview(Contract):
    version: int
    decision: Literal["resolve", "reopen"]
    actor: str
    notes: str
    timestamp: str


class SourceConflict(Contract):
    id: str
    revision: int = 1
    source_ids: list[str]
    description: str
    status: Literal["unresolved", "resolved"] = "unresolved"
    created_at: str
    submitted_by: str
    reviews: list[ConflictReview] = Field(default_factory=list)


class ConflictReviewRequest(Contract):
    revision: int = Field(ge=1)
    decision: Literal["resolve", "reopen"]
    notes: str = Field(min_length=1, max_length=3000, pattern=r"[\s\S]*\S[\s\S]*")


class ApplicableSourcePassage(Contract):
    id: str
    source_id: str
    document_id: str
    title: str
    revision: str
    section: str
    page: str | None
    file_path: str
    configurations: list[str]
    authority: Literal["controlled_procedure", "secondary_summary", "example"]
    approval_status: Literal[
        "approved", "reviewed_reference", "unverified", "withdrawn", "conflicted"
    ]
    passage: str
    excerpt_kind: Literal["exact_excerpt"] = "exact_excerpt"
    applicable: bool
    operational_allowed: bool
    limitation: str
    original_sha256: str | None
    content_digest: str
    publication_version: int
    conflict_ids: list[str]


class SourceDocumentRecord(Base):
    __tablename__ = "incident_source_documents"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    source_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class SourceConflictRecord(Base):
    __tablename__ = "incident_source_conflicts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


def timestamp():
    return datetime.now(UTC).isoformat()


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def load_document(session, source_id: str) -> IncidentSourceDocument:
    row = session.get(SourceDocumentRecord, source_id)
    if row is None:
        raise HTTPException(404, "Source revision not found.")
    return IncidentSourceDocument.model_validate(row.payload)


def create_document(content: SourceDocumentInput, actor: str) -> IncidentSourceDocument:
    source_key = fingerprint([content.document_id, content.document_revision])
    content_digest = fingerprint(content.model_dump(mode="json"))

    def existing(session):
        row = session.scalar(
            select(SourceDocumentRecord).where(SourceDocumentRecord.source_key == source_key)
        )
        if row is None:
            return None
        result = IncidentSourceDocument.model_validate(row.payload)
        if result.content_digest != content_digest:
            raise HTTPException(409, "This document revision is immutable. Import a new revision.")
        return result

    found = database_operation(existing)
    if found:
        return found
    document = IncidentSourceDocument(
        id=f"SRC-{uuid4().hex[:12]}",
        content=content,
        content_digest=content_digest,
        submitted_by=actor,
        created_at=timestamp(),
    )

    def save(session):
        session.add(
            SourceDocumentRecord(
                id=document.id,
                source_key=source_key,
                revision=1,
                payload=document.model_dump(mode="json"),
            )
        )
        session.flush()
        return document

    try:
        return database_operation(save)
    except IntegrityError:
        found = database_operation(existing)
        if found is None:
            raise
        return found


def unresolved_conflicts(session) -> list[SourceConflict]:
    conflicts = [
        SourceConflict.model_validate(row.payload)
        for row in session.scalars(select(SourceConflictRecord))
    ]
    return [conflict for conflict in conflicts if conflict.status == "unresolved"]


def review_document(source_id: str, request: SourceReviewRequest, actor: str):
    def review(session):
        document = load_document(session, source_id)
        if document.revision != request.revision:
            raise HTTPException(409, "Source review changed. Reload the latest revision.")
        if request.decision == "publish":
            if any(source_id in conflict.source_ids for conflict in unresolved_conflicts(session)):
                raise HTTPException(
                    422, "Resolve the recorded source conflicts before publication."
                )
            content = document.content
            if content.authority == "controlled_procedure" and (
                content.original_sha256 is None
                or content.document_revision.strip().casefold() in {"unknown", "unverified", "n/a"}
            ):
                raise HTTPException(
                    422,
                    "Controlled publication needs the original's integrity "
                    "reference and verified document revision.",
                )
        document.revision += 1
        document.status = "published" if request.decision == "publish" else "withdrawn"
        document.reviews.append(
            SourceReview(
                version=len(document.reviews) + 1,
                decision=request.decision,
                actor=actor,
                notes=request.notes,
                timestamp=timestamp(),
            )
        )
        result = session.execute(
            update(SourceDocumentRecord)
            .where(
                SourceDocumentRecord.id == source_id,
                SourceDocumentRecord.revision == request.revision,
            )
            .values(revision=document.revision, payload=document.model_dump(mode="json"))
        )
        if result.rowcount != 1:
            raise HTTPException(409, "Source changed while reviewing. Reload and try again.")
        return document

    return database_operation(review)


def applicable_sources(
    configuration: str, q: str = "", *, session=None
) -> list[ApplicableSourcePassage]:
    normalized = " ".join(configuration.casefold().split())
    terms = q.casefold().split()

    def retrieve(session):
        conflicts = unresolved_conflicts(session)
        passages = []
        for row in session.scalars(select(SourceDocumentRecord)):
            document = IncidentSourceDocument.model_validate(row.payload)
            content = document.content
            applicable = bool(normalized) and normalized in {
                " ".join(value.casefold().split()) for value in content.configurations
            }
            conflict_ids = [item.id for item in conflicts if document.id in item.source_ids]
            allowed = bool(
                applicable
                and not conflict_ids
                and document.status == "published"
                and content.authority == "controlled_procedure"
            )
            status = (
                "conflicted"
                if conflict_ids
                else "withdrawn"
                if document.status == "withdrawn"
                else "unverified"
                if document.status == "draft"
                else "approved"
                if content.authority == "controlled_procedure"
                else "reviewed_reference"
            )
            for passage in content.passages:
                haystack = " ".join(
                    (content.title, content.document_id, passage.section, passage.text)
                ).casefold()
                if not all(term in haystack for term in terms):
                    continue
                limitations = []
                if not applicable:
                    limitations.append("Configuration does not exactly match this source revision.")
                if conflict_ids:
                    limitations.append("Recorded conflicts remain unresolved.")
                if document.status != "published":
                    limitations.append(f"Source status is {document.status}.")
                if content.authority != "controlled_procedure":
                    limitations.append("Contextual reference only; not an operating procedure.")
                if allowed:
                    limitations.append(
                        "Reviewed applicable source; site role, prerequisites and "
                        "test authorization are still required before equipment use."
                    )
                passages.append(
                    ApplicableSourcePassage(
                        id=f"{document.id}:{passage.id}",
                        source_id=document.id,
                        document_id=content.document_id,
                        title=content.title,
                        revision=content.document_revision,
                        section=passage.section,
                        page=passage.page,
                        file_path=content.original_ref,
                        configurations=content.configurations,
                        authority=content.authority,
                        approval_status=status,
                        passage=passage.text,
                        applicable=applicable,
                        operational_allowed=allowed,
                        limitation=" ".join(limitations),
                        original_sha256=content.original_sha256,
                        content_digest=document.content_digest,
                        publication_version=len(document.reviews),
                        conflict_ids=conflict_ids,
                    )
                )
        return sorted(
            passages,
            key=lambda item: (
                not item.operational_allowed,
                not item.applicable,
                item.document_id,
                item.id,
            ),
        )

    return retrieve(session) if session is not None else database_operation(retrieve)


router = APIRouter(prefix="/api/incident-knowledge", tags=["incident sources"])
ViewActor = Annotated[object, Depends(require_permission("view"))]
EditActor = Annotated[object, Depends(require_permission("edit"))]
PublishActor = Annotated[object, Depends(require_permission("publish_knowledge"))]


@router.get("", response_model=list[IncidentSourceDocument])
def list_documents(actor: ViewActor):
    return database_operation(
        lambda session: [
            IncidentSourceDocument.model_validate(row.payload)
            for row in session.scalars(select(SourceDocumentRecord))
        ]
    )


@router.post("", response_model=IncidentSourceDocument, status_code=201)
def add_document(request: SourceDocumentInput, actor: EditActor):
    return create_document(request, actor.subject)


@router.get("/passages", response_model=list[ApplicableSourcePassage])
def passages(
    actor: ViewActor,
    configuration: str = Query(default="", max_length=150),
    q: str = Query(default="", max_length=200),
):
    return applicable_sources(configuration, q)


@router.get("/conflicts", response_model=list[SourceConflict])
def conflicts(actor: ViewActor):
    return database_operation(
        lambda session: [
            SourceConflict.model_validate(row.payload)
            for row in session.scalars(select(SourceConflictRecord))
        ]
    )


@router.post("/conflicts", response_model=SourceConflict, status_code=201)
def add_conflict(request: SourceConflictInput, actor: EditActor):
    conflict = SourceConflict(
        id=f"CONFLICT-{uuid4().hex[:12]}",
        source_ids=request.source_ids,
        description=request.description,
        submitted_by=actor.subject,
        created_at=timestamp(),
    )

    def save(session):
        for source_id in request.source_ids:
            load_document(session, source_id)
        session.add(
            SourceConflictRecord(
                id=conflict.id,
                revision=1,
                payload=conflict.model_dump(mode="json"),
            )
        )
        return conflict

    return database_operation(save)


@router.post("/conflicts/{conflict_id}/reviews", response_model=SourceConflict)
def review_conflict(conflict_id: str, request: ConflictReviewRequest, actor: PublishActor):
    def review(session):
        row = session.get(SourceConflictRecord, conflict_id)
        if row is None:
            raise HTTPException(404, "Source conflict not found.")
        conflict = SourceConflict.model_validate(row.payload)
        if conflict.revision != request.revision:
            raise HTTPException(409, "Conflict review changed. Reload the latest revision.")
        conflict.revision += 1
        conflict.status = "resolved" if request.decision == "resolve" else "unresolved"
        conflict.reviews.append(
            ConflictReview(
                version=len(conflict.reviews) + 1,
                decision=request.decision,
                actor=actor.subject,
                notes=request.notes,
                timestamp=timestamp(),
            )
        )
        result = session.execute(
            update(SourceConflictRecord)
            .where(
                SourceConflictRecord.id == conflict_id,
                SourceConflictRecord.revision == request.revision,
            )
            .values(revision=conflict.revision, payload=conflict.model_dump(mode="json"))
        )
        if result.rowcount != 1:
            raise HTTPException(409, "Conflict changed while reviewing. Reload and try again.")
        return conflict

    return database_operation(review)


@router.get("/{source_id}", response_model=IncidentSourceDocument)
def get_document(source_id: str, actor: ViewActor):
    return database_operation(lambda session: load_document(session, source_id))


@router.post("/{source_id}/reviews", response_model=IncidentSourceDocument)
def publish_document(source_id: str, request: SourceReviewRequest, actor: PublishActor):
    return review_document(source_id, request, actor.subject)
