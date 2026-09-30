"""Read-only normalized export gateway. No vendor API, equipment commands or network I/O."""

import argparse
import hashlib
import os
import stat
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Literal

from fastapi import HTTPException
from pydantic import Field, ValidationError, field_validator, model_validator
from sqlalchemy import JSON, Integer, LargeBinary, String, delete, select
from sqlalchemy.orm import Mapped, mapped_column

from flowpilot.incidents.artifacts import archive_artifact
from flowpilot.incidents.models import (
    AddEvidenceAction,
    CorrectEvidenceAction,
    CreateIncident,
    EvidenceInput,
    Incident,
)
from flowpilot.incidents.service import (
    act,
    active_evidence,
    create_incident,
    database_operation,
    get_incident,
)
from flowpilot.investigations.models import Contract
from flowpilot.persistence.database import Base
from flowpilot.settings import ROOT, Settings

MAX_EXPORT_BYTES = 64 * 1024 * 1024
MAX_LINE_BYTES = 64 * 1024


class GatewayArtifact(Contract):
    relative_path: str = Field(min_length=1, max_length=500)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    media_type: str = Field(default="application/octet-stream", max_length=100)


class ExpectedSource(Contract):
    kind: Literal["image", "log", "maintenance", "context"]
    role: Literal["last_good", "first_bad", "machine_log", "pm", "context"]
    label: str = Field(min_length=1, max_length=200)
    source_ref: str = Field(min_length=1, max_length=500)


class GatewayExport(Contract):
    schema_version: Literal["1.0"] = "1.0"
    event_id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.:-]+$")
    kind: Literal["evidence", "trigger"]
    tool_id: str = Field(min_length=1, max_length=100)
    configuration: str = Field(min_length=1, max_length=150)
    exported_at: str = Field(max_length=100)
    evidence: EvidenceInput | None = None
    artifact: GatewayArtifact | None = None
    symptom: str | None = Field(default=None, min_length=1, max_length=2000)
    trigger_origin: Literal["alarm", "image_quality", "manual"] = "alarm"
    lot_id: str | None = Field(default=None, max_length=100)
    expected_sources: list[ExpectedSource] = Field(default_factory=list, max_length=30)

    @field_validator("exported_at")
    @classmethod
    def aware_export_time(cls, value):
        if datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is None:
            raise ValueError("Exporter time must include its UTC offset.")
        return value

    @model_validator(mode="after")
    def correct_payload(self):
        if self.kind == "evidence":
            if self.evidence is None or self.symptom is not None or self.expected_sources:
                raise ValueError("Evidence envelopes contain evidence and optional original only.")
            if self.evidence.tool_id != self.tool_id:
                raise ValueError("Evidence must explicitly match the envelope's tool.")
            if self.evidence.configuration != self.configuration:
                raise ValueError("Evidence must explicitly match the envelope's configuration.")
            if self.evidence.artifact_id or self.evidence.image_url:
                raise ValueError(
                    "Gateway originals use approved relative paths, not app or URL IDs."
                )
            if self.lot_id and self.evidence.lot_id != self.lot_id:
                raise ValueError("Evidence lot does not match the export envelope.")
        elif self.evidence is not None or self.artifact is not None or not self.symptom:
            raise ValueError(
                "Trigger envelopes require a symptom and no evidence/artifact payload."
            )
        if len({(item.role, item.source_ref) for item in self.expected_sources}) != len(
            self.expected_sources
        ):
            raise ValueError("Expected sources must be distinct.")
        return self


class GatewayRun(Contract):
    buffered: int = 0
    failed: int = 0
    incidents: list[str] = Field(default_factory=list)
    attached: int = 0
    unmatched: int = 0
    offset: int = 0


class GatewayCheckpoint(Base):
    __tablename__ = "incident_gateway_checkpoints"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    offset: Mapped[int] = mapped_column(Integer, nullable=False)
    prefix_sha256: Mapped[str] = mapped_column(String, nullable=False)


class GatewayEventRecord(Base):
    __tablename__ = "incident_gateway_events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    source_key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    raw_line: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    original: Mapped[bytes | None] = mapped_column(LargeBinary)
    status: Mapped[str] = mapped_column(String, nullable=False)
    detail: Mapped[str] = mapped_column(String, nullable=False)
    received_at: Mapped[str] = mapped_column(String, nullable=False)
    incident_id: Mapped[str | None] = mapped_column(String)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_under_root(root: Path, relative: str, limit: int) -> bytes:
    """Open every path component relative to a directory FD, rejecting symlink traversal."""
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts or not path.parts or "\\" in relative:
        raise ValueError("Original path must remain inside the approved export root.")
    descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
    try:
        for index, part in enumerate(path.parts):
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            if index < len(path.parts) - 1:
                flags |= os.O_DIRECTORY
            child = os.open(part, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise ValueError("Only ordinary export files can be read.")
        chunks, length = [], 0
        while chunk := os.read(descriptor, min(65536, limit + 1 - length)):
            chunks.append(chunk)
            length += len(chunk)
            if length > limit:
                raise ValueError("Export exceeds the configured byte limit.")
        return b"".join(chunks)
    finally:
        os.close(descriptor)


def buffer_exports(root: Path, filename: str, settings: Settings, result: GatewayRun, mock: bool):
    source_key = sha256(str(root).encode())
    checkpoint_id = sha256(f"{root}/{filename}".encode())
    # ponytail: bounded local scan; use rotated partitions when export volume outgrows 64 MB.
    data = read_under_root(root, filename, MAX_EXPORT_BYTES)

    def checkpoint(session):
        saved = session.get(GatewayCheckpoint, checkpoint_id)
        if saved and sha256(data[: saved.offset]) == saved.prefix_sha256:
            return saved.offset
        return 0  # Rotated/replaced exports are replayed through stable event IDs.

    offset = database_operation(checkpoint)
    prefix = hashlib.sha256(data[:offset])
    while offset < len(data):
        end = data.find(b"\n", offset)
        if end < 0:
            break  # A writer may still be appending this line; never consume a partial record.
        raw = data[offset : end + 1]
        next_offset = end + 1
        status, detail, original, payload = "buffered", "", None, {}
        try:
            if len(raw) > MAX_LINE_BYTES:
                raise ValueError("Normalized export line exceeds 64 KB.")
            event = GatewayExport.model_validate_json(raw)
            if mock and event.evidence is not None and not event.evidence.synthetic:
                raise HTTPException(422, "Mock gateway refuses non-synthetic evidence.")
            payload = event.model_dump(mode="json")
            event_id = sha256(f"{source_key}:{event.event_id}".encode())
            if event.artifact:
                try:
                    original = read_under_root(
                        root, event.artifact.relative_path, settings.incident_artifact_limit_bytes
                    )
                    if sha256(original) != event.artifact.sha256:
                        raise ValueError("Original byte hash does not match the export manifest.")
                except (OSError, ValueError):
                    status, detail = (
                        "failed",
                        "Original missing, outside approved root, or hash-invalid.",
                    )
                    original = None
        except (ValueError, ValidationError):
            event_id = sha256(f"{source_key}:{offset}:".encode() + raw)
            status, detail = "failed", "Malformed complete export line; inspect normalized schema."
        prefix.update(raw)
        prefix_hash = prefix.hexdigest()

        def save(session):
            existing = session.get(GatewayEventRecord, event_id)
            if existing is None:
                session.add(
                    GatewayEventRecord(
                        id=event_id,
                        source_key=source_key,
                        payload=payload,
                        raw_line=raw,
                        original=original,
                        status=status,
                        detail=detail,
                        received_at=datetime.now(UTC).isoformat(),
                        incident_id=None,
                    )
                )
                result.failed += status == "failed"
                result.buffered += status == "buffered"
            elif existing.payload != payload:
                raise ValueError(
                    "Stable export event ID was reused with changed content; use a new ID."
                )
            saved = session.get(GatewayCheckpoint, checkpoint_id)
            if saved is None:
                session.add(
                    GatewayCheckpoint(
                        id=checkpoint_id,
                        offset=next_offset,
                        prefix_sha256=prefix_hash,
                    )
                )
            else:
                saved.offset, saved.prefix_sha256 = next_offset, prefix_hash

        database_operation(save)
        offset = next_offset
    result.offset = offset
    return source_key


def matching_exports(trigger: GatewayExport, records, pre_seconds: int, post_seconds: int):
    trigger_time = datetime.fromisoformat(trigger.exported_at.replace("Z", "+00:00"))
    start, end = (
        trigger_time - timedelta(seconds=pre_seconds),
        trigger_time + timedelta(seconds=post_seconds),
    )
    matches = []
    for row in records:
        if row.payload.get("kind") != "evidence":
            continue
        event = GatewayExport.model_validate(row.payload)
        exported = datetime.fromisoformat(event.exported_at.replace("Z", "+00:00"))
        if (
            event.tool_id != trigger.tool_id
            or event.configuration != trigger.configuration
            or not start <= exported <= end
        ):
            continue
        if trigger.lot_id and event.evidence.lot_id and event.evidence.lot_id != trigger.lot_id:
            continue
        if trigger.lot_id and event.evidence.kind == "image" and event.evidence.lot_id is None:
            continue  # Unknown image scope is not assigned to the trigger's known lot.
        matches.append((row, event))
    # Exporters mark good/bad explicitly. Preserve the nearest preceding known-good boundary.
    good = [
        (row, event)
        for row, event in matches
        if event.evidence.role == "last_good"
        and datetime.fromisoformat(event.exported_at.replace("Z", "+00:00")) <= trigger_time
    ]
    best_good = max(
        good,
        key=lambda pair: datetime.fromisoformat(pair[1].exported_at.replace("Z", "+00:00")),
        default=None,
    )
    bad = [(row, event) for row, event in matches if event.evidence.role == "first_bad"]
    first_bad = min(
        bad,
        key=lambda pair: datetime.fromisoformat(pair[1].exported_at.replace("Z", "+00:00")),
        default=None,
    )
    return [
        (row, event)
        for row, event in matches
        if event.evidence.role not in {"last_good", "first_bad"}
        or row.id
        in {best_good[0].id if best_good else None, first_bad[0].id if first_bad else None}
    ]


def append_evidence(incident: Incident, item: EvidenceInput):
    if any(existing.id == item.id for existing in incident.evidence):
        return incident, False
    pending = next(
        (
            existing
            for existing in active_evidence(incident)
            if existing.source_ref == item.source_ref
            and existing.role == item.role
            and existing.status != "collected"
        ),
        None,
    )
    if pending:
        action = CorrectEvidenceAction(
            action="correct_evidence",
            revision=incident.revision,
            evidence_id=pending.id,
            replacement=item,
            reason="Read-only gateway received a new source status or original.",
        )
    else:
        action = AddEvidenceAction(action="add_evidence", revision=incident.revision, evidence=item)
    return act(incident.id, action, actor="gateway:approved-export"), True


def collect_trigger(
    row,
    trigger: GatewayExport,
    records,
    settings: Settings,
    result: GatewayRun,
    now: datetime,
    mock: bool,
):
    expected = [
        EvidenceInput(
            id=f"pending-{index}",
            **item.model_dump(),
            tool_id=trigger.tool_id,
            configuration=trigger.configuration,
            lot_id=trigger.lot_id,
            status="pending",
            synthetic=mock,
            provenance="Expected source declared by the approved export manifest.",
        )
        for index, item in enumerate(trigger.expected_sources)
    ]
    request = CreateIncident(
        trigger_id=f"gateway:{trigger.event_id}",
        tool_id=trigger.tool_id,
        configuration=trigger.configuration,
        symptom=trigger.symptom,
        mode="synthetic" if mock else "live",
        trigger_origin=trigger.trigger_origin,
        trigger_time=trigger.exported_at,
        evidence=expected,
    )
    incident = (
        get_incident(row.incident_id)
        if row.incident_id
        else create_incident(request, owner="gateway:mock" if mock else "gateway:approved-export")
    )
    if mock and incident.mode != "synthetic":
        raise ValueError("Mock exports cannot reuse an incident associated with a live gateway.")
    if row.incident_id is None:

        def associate(session):
            session.get(GatewayEventRecord, row.id).incident_id = incident.id

        database_operation(associate)
    result.incidents.append(incident.id)
    from flowpilot.incidents.coordinator import schedule_incident

    if mock or settings.incident_auto_process:
        schedule_incident(incident)
    for evidence_row, event in matching_exports(
        trigger,
        records,
        settings.incident_gateway_pre_seconds,
        settings.incident_gateway_post_seconds,
    ):
        item = event.evidence.model_copy(deep=True)
        if any(existing.id == item.id for existing in incident.evidence):
            continue
        if evidence_row.status == "failed":
            item.status = "failed"
            item.values = {**item.values, "collection_error": evidence_row.detail}
        elif item.status == "collected":
            data = evidence_row.original if event.artifact else evidence_row.raw_line
            try:
                artifact = archive_artifact(
                    incident.id,
                    data,
                    PurePosixPath(event.artifact.relative_path).name
                    if event.artifact
                    else f"{event.event_id}.json",
                    event.artifact.media_type if event.artifact else "application/json",
                    "gateway:approved-export",
                    event.artifact.sha256 if event.artifact else sha256(data),
                )
                if artifact.status != "available":
                    item.status = "unavailable"
                    item.values = {
                        **item.values,
                        "collection_error": "Original was retained as a deletion tombstone.",
                    }
                else:
                    item.artifact_id = artifact.id
                    if artifact.media_type.startswith("image/"):
                        item.image_url = f"/api/incidents/{incident.id}/artifacts/{artifact.id}"
            except HTTPException as error:
                if error.status_code >= 500:
                    raise
                item.status = "failed"
                item.values = {
                    **item.values,
                    "collection_error": "Original could not pass archive validation.",
                }
        incident, attached = append_evidence(incident, item)
        result.attached += attached
    trigger_time = datetime.fromisoformat(trigger.exported_at.replace("Z", "+00:00"))
    if now > trigger_time + timedelta(seconds=settings.incident_gateway_post_seconds):
        for pending in [item for item in active_evidence(incident) if item.status == "pending"]:
            replacement = EvidenceInput.model_validate(
                {
                    key: value
                    for key, value in pending.model_dump().items()
                    if key in EvidenceInput.model_fields
                }
            )
            replacement.id = f"window-ended-{sha256(pending.id.encode())[:20]}"
            replacement.status = "unavailable"
            replacement.values = {
                "collection_error": "Source did not arrive within the configured post-event window."
            }
            incident, attached = append_evidence(incident, replacement)
            result.attached += attached
    if mock or settings.incident_auto_process:
        schedule_incident(incident)


def run_once(
    filename: str = "events.jsonl",
    settings: Settings | None = None,
    now: datetime | None = None,
    mock: bool = False,
    mock_root: Path | None = None,
) -> GatewayRun:
    settings = settings or Settings()
    if not mock and (
        settings.incident_auth_mode != "configured" or settings.incident_gateway_root is None
    ):
        raise ValueError(
            "Gateway requires configured access mode and an explicitly approved export root."
        )
    if (
        not 0 <= settings.incident_gateway_pre_seconds <= 86400
        or not 0 <= settings.incident_gateway_post_seconds <= 86400
    ):
        raise ValueError("Gateway windows must be between zero and one day.")
    root = (
        (mock_root or ROOT / "fixtures/s932-gateway") if mock else settings.incident_gateway_root
    ).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("The approved export root must be a directory.")
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("Gateway evaluation time must include a UTC offset.")
    result = GatewayRun()
    source_key = buffer_exports(root, filename, settings, result, mock)

    def buffered(session):
        rows = list(
            session.scalars(
                select(GatewayEventRecord).where(GatewayEventRecord.source_key == source_key)
            )
        )

        session.expunge_all()
        return rows

    records = database_operation(buffered)
    if mock and any(
        row.payload.get("kind") == "evidence"
        and not row.payload.get("evidence", {}).get("synthetic", False)
        for row in records
    ):
        raise HTTPException(422, "Mock gateway refuses buffered non-synthetic evidence.")
    matched = set()
    for row in records:
        if row.payload.get("kind") == "trigger" and row.status != "failed":
            trigger = GatewayExport.model_validate(row.payload)
            collect_trigger(row, trigger, records, settings, result, now, mock)
            matched.update(
                item.id
                for item, _ in matching_exports(
                    trigger,
                    records,
                    settings.incident_gateway_pre_seconds,
                    settings.incident_gateway_post_seconds,
                )
            )
    result.unmatched = sum(
        row.payload.get("kind") == "evidence" and row.id not in matched for row in records
    )
    cutoff = now - timedelta(
        seconds=max(
            settings.incident_gateway_pre_seconds + settings.incident_gateway_post_seconds, 3600
        )
    )

    def prune(session):
        for row in session.scalars(
            select(GatewayEventRecord).where(GatewayEventRecord.source_key == source_key)
        ):
            if datetime.fromisoformat(row.received_at) < cutoff:
                session.execute(delete(GatewayEventRecord).where(GatewayEventRecord.id == row.id))

    database_operation(prune)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--once", action="store_true", help="Read one complete export batch (default)"
    )
    mode.add_argument("--watch", action="store_true", help="Repeat with a bounded polling interval")
    parser.add_argument(
        "--mock", action="store_true", help="Use bundled synthetic exports; no site credentials"
    )
    parser.add_argument(
        "--file", default="events.jsonl", help="Relative JSONL path inside approved root"
    )
    parser.add_argument("--interval", type=float, default=5, help="Polling seconds, from 1 to 60")
    args = parser.parse_args()
    if not 1 <= args.interval <= 60:
        parser.error("--interval must be between 1 and 60 seconds")
    try:
        while True:
            print(run_once(args.file, mock=args.mock).model_dump_json(), flush=True)
            if not args.watch:
                break
            time.sleep(args.interval)
    except (ValueError, OSError, HTTPException) as error:
        parser.exit(
            1,
            f"Gateway stopped safely: {type(error).__name__}. "
            "Inspect approved configuration/export.\n",
        )


if __name__ == "__main__":
    main()
