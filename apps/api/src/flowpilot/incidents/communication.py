"""Explicitly approved engineer handoffs; SMTP acceptance is not delivery."""

import hashlib
import json
import re
import smtplib
import ssl
from datetime import UTC, datetime
from email.message import EmailMessage
from email.policy import SMTP
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlalchemy import JSON, Integer, String, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from flowpilot.incidents.access import Actor, require_permission
from flowpilot.incidents.models import Incident
from flowpilot.incidents.service import IncidentRecord, active_evidence, database_operation
from flowpilot.incidents.service import load_incident as current_incident
from flowpilot.investigations.models import Contract
from flowpilot.persistence.database import Base
from flowpilot.settings import Settings

CommunicationStatus = Literal[
    "approved", "sending", "accepted", "failed", "unknown", "delivered", "acknowledged"
]


class CommunicationApprovalRequest(Contract):
    incident_revision: int = Field(ge=0)
    draft_version: int = Field(ge=1)
    recipients: list[str] = Field(min_length=1, max_length=20)

    @field_validator("recipients")
    @classmethod
    def valid_recipients(cls, values):
        normalized = [normalize_address(value) for value in values]
        if any(not valid_address(value) for value in normalized):
            raise ValueError(
                "Use plain email addresses without display names or control characters."
            )
        if len(set(normalized)) != len(normalized):
            raise ValueError("Recipients must be unique.")
        return sorted(normalized)


class CommunicationSendRequest(Contract):
    revision: int = Field(ge=1)


class CommunicationReceiptRequest(Contract):
    revision: int = Field(ge=1)
    status: Literal["unknown", "delivered", "acknowledged"]
    reference: str = Field(min_length=1, max_length=1000, pattern=r".*\S.*")
    notes: str = Field(min_length=1, max_length=3000, pattern=r"[\s\S]*\S[\s\S]*")


class CommunicationAttempt(Contract):
    number: int
    actor: str
    started_at: str
    finished_at: str | None = None
    status: Literal["sending", "accepted", "failed", "unknown"] = "sending"
    retryable: bool = False
    detail: str = "SMTP attempt claimed; delivery has not been established."
    message_id: str


class CommunicationReceipt(Contract):
    version: int
    status: Literal["unknown", "delivered", "acknowledged"]
    reference: str
    notes: str
    actor: str
    recorded_at: str


class IncidentCommunication(Contract):
    id: str
    revision: int = 1
    incident_id: str
    incident_revision: int
    draft_version: int
    subject: str
    body: str
    recipients: list[str]
    approved_by: str
    approved_at: str
    snapshot_sha256: str
    status: CommunicationStatus = "approved"
    attempts: list[CommunicationAttempt] = Field(default_factory=list)
    receipts: list[CommunicationReceipt] = Field(default_factory=list)
    transport: Literal["smtp", "mock"] = "smtp"


class CommunicationRecord(Base):
    __tablename__ = "incident_communications"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    incident_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    approval_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


def timestamp():
    return datetime.now(UTC).isoformat()


def valid_address(value: str) -> bool:
    return (
        len(value) <= 254
        and re.fullmatch(
            r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
            r"@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+"
            r"[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?",
            value,
        )
        is not None
    )


def normalize_address(value: str) -> str:
    local, separator, domain = value.strip().rpartition("@")
    return local + separator + domain.lower()


def allowed_recipients(recipients: list[str], settings: Settings):
    allowlist = {normalize_address(value) for value in settings.incident_email_recipients}
    if not set(recipients) <= allowlist:
        raise HTTPException(422, "Every recipient must match the configured engineer allowlist.")


def current_communication(session, incident_id: str, communication_id: str):
    row = session.get(CommunicationRecord, communication_id)
    if row is None or row.incident_id != incident_id:
        raise HTTPException(404, "Approved communication not found for this incident.")
    return IncidentCommunication.model_validate(row.payload)


def ensure_current_draft(incident: Incident, revision: int, version: int):
    if incident.revision != revision or incident.handoff.version != version:
        raise HTTPException(409, "Incident or draft changed; review and approve the current draft.")
    if incident.handoff.source_revision != revision:
        raise HTTPException(
            409, "The preserved draft predates new evidence. Review and save it first."
        )


def save_revision(session, communication: IncidentCommunication, expected_revision: int):
    result = session.execute(
        update(CommunicationRecord)
        .where(
            CommunicationRecord.id == communication.id,
            CommunicationRecord.revision == expected_revision,
        )
        .values(revision=communication.revision, payload=communication.model_dump(mode="json"))
    )
    if result.rowcount != 1:
        raise HTTPException(409, "Communication changed; this stale action was not saved.")


def approve_communication(incident_id: str, request: CommunicationApprovalRequest, actor: str):
    allowed_recipients(request.recipients, Settings())

    def approve(session):
        incident = current_incident(session, incident_id)
        ensure_current_draft(incident, request.incident_revision, request.draft_version)
        if any(character in incident.handoff.subject for character in "\r\n\x00"):
            raise HTTPException(
                422, "The draft subject must be a single line without control bytes."
            )
        snapshot = {
            "incident_id": incident_id,
            "incident_revision": incident.revision,
            "draft_version": incident.handoff.version,
            "subject": incident.handoff.subject,
            "body": incident.handoff.body,
            "recipients": request.recipients,
        }
        identity = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
        existing = session.scalar(
            select(CommunicationRecord).where(CommunicationRecord.approval_key == identity)
        )
        if existing:
            return IncidentCommunication.model_validate(existing.payload)
        # Claim the exact incident revision while approving, without changing its business state.
        result = session.execute(
            update(IncidentRecord)
            .where(
                IncidentRecord.id == incident_id,
                IncidentRecord.revision == incident.revision,
            )
            .values(revision=incident.revision)
        )
        if result.rowcount != 1:
            raise HTTPException(409, "Incident changed while approving this snapshot.")
        communication = IncidentCommunication(
            id=f"MAIL-{uuid4().hex[:12]}",
            **snapshot,
            approved_by=actor,
            approved_at=timestamp(),
            snapshot_sha256=identity,
        )
        session.add(
            CommunicationRecord(
                id=communication.id,
                incident_id=incident_id,
                approval_key=identity,
                revision=1,
                payload=communication.model_dump(mode="json"),
            )
        )
        session.flush()
        return communication

    try:
        return database_operation(approve)
    except IntegrityError:
        # A concurrent identical approval returns the immutable winner; no new send is initiated.
        return database_operation(approve)


def smtp_configuration(settings: Settings):
    if settings.incident_auth_mode != "configured":
        raise HTTPException(403, "Sending is disabled in demonstration mode.")
    if not settings.incident_smtp_host or not settings.incident_smtp_from:
        raise HTTPException(503, "The authenticated SMTP deployment is not configured.")
    if not valid_address(settings.incident_smtp_from):
        raise HTTPException(503, "The configured sender must be a plain email address.")
    if not settings.incident_smtp_starttls and settings.incident_smtp_port != 465:
        raise HTTPException(503, "SMTP requires STARTTLS or implicit TLS on port 465.")


def send_smtp(communication: IncidentCommunication, settings: Settings):
    """Return acceptance/failure certainty; never infer delivery from an SMTP response."""
    message = EmailMessage(policy=SMTP)
    message["From"] = settings.incident_smtp_from
    message["To"] = ", ".join(communication.recipients)
    message["Subject"] = communication.subject
    message["Message-ID"] = communication.attempts[-1].message_id
    message.set_content(communication.body)
    connection = None
    data_started = False
    try:
        context = ssl.create_default_context()
        if settings.incident_smtp_starttls:
            connection = smtplib.SMTP(
                settings.incident_smtp_host, settings.incident_smtp_port, timeout=10
            )
            connection.ehlo()
            connection.starttls(context=context)
            connection.ehlo()
        else:
            connection = smtplib.SMTP_SSL(
                settings.incident_smtp_host,
                settings.incident_smtp_port,
                timeout=10,
                context=context,
            )
            connection.ehlo()
        if settings.incident_smtp_username:
            password = settings.incident_smtp_password
            if password is None:
                return "failed", True, "SMTP credentials are incomplete; no message submitted."
            connection.login(settings.incident_smtp_username, password.get_secret_value())
        code, _ = connection.mail(settings.incident_smtp_from)
        if code != 250:
            return "failed", True, f"SMTP envelope rejected ({code}); no message submitted."
        for recipient in communication.recipients:
            code, _ = connection.rcpt(recipient)
            if code not in {250, 251}:
                return "failed", True, f"SMTP recipient rejected ({code}); no message submitted."
        data_started = True
        code, _ = connection.data(message.as_bytes())
        if code == 250:
            return "accepted", False, "SMTP accepted the message. Delivery remains unverified."
        return "failed", True, f"SMTP explicitly rejected message data ({code})."
    except smtplib.SMTPDataError as error:
        return "failed", True, f"SMTP explicitly rejected message data ({error.smtp_code})."
    except Exception:
        if data_started:
            return (
                "unknown",
                False,
                (
                    "Connection failed after message submission began. Do not retry; verify with "
                    "the mail service using the Message-ID."
                ),
            )
        return "failed", True, "SMTP failed before message submission; an explicit retry is safe."
    finally:
        if connection is not None:
            try:
                connection.close()
            except Exception:
                pass  # Closing an accepted connection cannot change acceptance into failure.


def send_communication(
    incident_id: str, communication_id: str, request: CommunicationSendRequest, actor: str
):
    settings = Settings()
    smtp_configuration(settings)

    def claim(session):
        communication = current_communication(session, incident_id, communication_id)
        if communication.transport == "mock":
            raise HTTPException(403, "Simulated handoffs cannot be submitted to SMTP.")
        if communication.status in {"sending", "accepted", "unknown", "delivered", "acknowledged"}:
            return communication, False
        if communication.revision != request.revision:
            raise HTTPException(409, "Communication changed; reload before sending.")
        if communication.status == "failed" and not communication.attempts[-1].retryable:
            raise HTTPException(409, "Submission outcome is uncertain; do not retry.")
        incident = current_incident(session, incident_id)
        ensure_current_draft(incident, communication.incident_revision, communication.draft_version)
        allowed_recipients(communication.recipients, settings)
        communication.revision += 1
        communication.status = "sending"
        domain = settings.incident_smtp_from.split("@", 1)[1]
        communication.attempts.append(
            CommunicationAttempt(
                number=len(communication.attempts) + 1,
                actor=actor,
                started_at=timestamp(),
                message_id=f"<{communication.id}@{domain}>",
            )
        )
        save_revision(session, communication, request.revision)
        return communication, True

    communication, claimed = database_operation(claim)
    if not claimed:
        return communication
    expected_revision = communication.revision
    # The sending claim is durable before network I/O. Process death cannot cause automatic resend.
    status, retryable, detail = send_smtp(communication, settings)
    communication.status = status
    attempt = communication.attempts[-1]
    attempt.status, attempt.retryable, attempt.detail = status, retryable, detail
    attempt.finished_at = timestamp()
    communication.revision += 1
    database_operation(lambda session: save_revision(session, communication, expected_revision))
    return communication


router = APIRouter(prefix="/api/incidents", tags=["engineer communication"])
ViewActor = Annotated[Actor, Depends(require_permission("view"))]
SendActor = Annotated[Actor, Depends(require_permission("send_email"))]


@router.get("/{incident_id}/communications", response_model=list[IncidentCommunication])
def list_communications(incident_id: str, actor: ViewActor):
    def listing(session):
        current_incident(session, incident_id)
        return [
            IncidentCommunication.model_validate(row.payload)
            for row in session.scalars(
                select(CommunicationRecord).where(CommunicationRecord.incident_id == incident_id)
            )
        ]

    return database_operation(listing)


@router.post(
    "/{incident_id}/communications/approvals", response_model=IncidentCommunication, status_code=201
)
def approve(incident_id: str, request: CommunicationApprovalRequest, actor: SendActor):
    return approve_communication(incident_id, request, actor.subject)


@router.post(
    "/{incident_id}/communications/{communication_id}/send", response_model=IncidentCommunication
)
def send(
    incident_id: str, communication_id: str, request: CommunicationSendRequest, actor: SendActor
):
    return send_communication(incident_id, communication_id, request, actor.subject)


@router.post(
    "/{incident_id}/communications/{communication_id}/receipts",
    response_model=IncidentCommunication,
)
def record_receipt(
    incident_id: str, communication_id: str, request: CommunicationReceiptRequest, actor: SendActor
):
    def record(session):
        communication = current_communication(session, incident_id, communication_id)
        if communication.revision != request.revision:
            raise HTTPException(409, "Communication changed; reload before recording a receipt.")
        if communication.status not in {
            "sending",
            "accepted",
            "unknown",
            "delivered",
            "acknowledged",
        }:
            raise HTTPException(422, "A delivery receipt requires a submitted message.")
        if communication.status == "acknowledged" and request.status != "acknowledged":
            raise HTTPException(422, "An acknowledged message cannot be downgraded.")
        if communication.status == "delivered" and request.status == "unknown":
            raise HTTPException(422, "A delivered message cannot be downgraded to unknown.")
        communication.revision += 1
        communication.status = request.status
        communication.receipts.append(
            CommunicationReceipt(
                version=len(communication.receipts) + 1,
                status=request.status,
                reference=request.reference,
                notes=request.notes,
                actor=actor.subject,
                recorded_at=timestamp(),
            )
        )
        save_revision(session, communication, request.revision)
        return communication

    return database_operation(record)


class MockApproval(Contract):
    incident_revision: int = Field(ge=0)
    draft_version: int = Field(ge=1)


class MockCommunicationEvent(Contract):
    revision: int = Field(ge=1)
    status: Literal["accepted", "failed", "unknown", "delivered", "acknowledged"]


@router.post("/{incident_id}/communications/mock", response_model=IncidentCommunication)
def mock_approval(
    incident_id: str,
    request: MockApproval,
    actor: Actor = Depends(require_permission("edit")),
):
    def create(session):
        incident = current_incident(session, incident_id)
        ensure_current_draft(incident, request.incident_revision, request.draft_version)
        if incident.mode == "live" or any(not item.synthetic for item in active_evidence(incident)):
            raise HTTPException(
                422, "Mock handoffs require an entirely synthetic incident package."
            )
        identity = hashlib.sha256(
            f"mock:{incident_id}:{request.incident_revision}:{request.draft_version}".encode()
        ).hexdigest()
        old = session.scalar(
            select(CommunicationRecord).where(CommunicationRecord.approval_key == identity)
        )
        if old:
            return IncidentCommunication.model_validate(old.payload)
        result = IncidentCommunication(
            id=f"MOCK-{uuid4().hex[:12]}",
            incident_id=incident_id,
            incident_revision=incident.revision,
            draft_version=incident.handoff.version,
            subject=incident.handoff.subject,
            body=incident.handoff.body,
            recipients=["engineer@example.invalid"],
            approved_by=actor.subject or "demo",
            approved_at=timestamp(),
            snapshot_sha256=identity,
            transport="mock",
        )
        session.add(
            CommunicationRecord(
                id=result.id,
                incident_id=incident_id,
                approval_key=identity,
                revision=1,
                payload=result.model_dump(mode="json"),
            )
        )
        session.flush()
        return result

    try:
        return database_operation(create)
    except IntegrityError:
        return database_operation(create)


@router.post(
    "/{incident_id}/communications/{communication_id}/mock-event",
    response_model=IncidentCommunication,
)
def mock_event(
    incident_id: str,
    communication_id: str,
    request: MockCommunicationEvent,
    actor: Actor = Depends(require_permission("edit")),
):
    def record(session):
        communication = current_communication(session, incident_id, communication_id)
        if communication.transport != "mock":
            raise HTTPException(403, "Mock events cannot change a real communication.")
        if communication.revision != request.revision:
            raise HTTPException(409, "Communication changed; reload the simulated handoff.")
        allowed = {
            "approved": {"accepted", "failed", "unknown"},
            "failed": {"accepted", "failed", "unknown"},
            "unknown": {"delivered", "acknowledged"},
            "accepted": {"delivered", "acknowledged"},
            "delivered": {"acknowledged"},
        }
        if request.status not in allowed.get(communication.status, set()):
            raise HTTPException(
                422, "That simulated transition is not valid from the current state."
            )
        if communication.status in {"approved", "failed"}:
            incident = current_incident(session, incident_id)
            ensure_current_draft(
                incident, communication.incident_revision, communication.draft_version
            )
            communication.attempts.append(
                CommunicationAttempt(
                    number=len(communication.attempts) + 1,
                    actor=actor.subject or "demo",
                    started_at=timestamp(),
                    finished_at=timestamp(),
                    status=request.status,
                    retryable=request.status == "failed",
                    message_id=f"<mock-{communication.id}@example.invalid>",
                    detail="Simulated transport event. No email was submitted or delivered.",
                )
            )
        else:
            communication.receipts.append(
                CommunicationReceipt(
                    version=len(communication.receipts) + 1,
                    status=request.status,
                    reference="mock:communication-fixture",
                    notes="Simulated receipt; no engineer was contacted.",
                    actor=actor.subject or "demo",
                    recorded_at=timestamp(),
                )
            )
        communication.status = request.status
        communication.revision += 1
        save_revision(session, communication, request.revision)
        return communication

    return database_operation(record)
