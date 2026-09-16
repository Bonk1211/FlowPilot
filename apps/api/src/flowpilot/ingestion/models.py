from typing import Literal

from pydantic import Field, JsonValue

from flowpilot.investigations.models import Contract


class LogPreviewRequest(Contract):
    text: str = Field(max_length=2_000_000)
    sourceName: str = Field(default="machine.log", min_length=1, max_length=255)
    timezoneOffset: str | None = Field(
        default=None, pattern=r"^[+-](?:[01][0-9]|2[0-3]):[0-5][0-9]$"
    )


class MachineEvent(Contract):
    id: str
    kind: str
    occurredAt: str | None
    localTimestamp: str | None
    lineStart: int
    lineEnd: int
    sourceRef: str
    raw: str
    payload: str
    fields: dict[str, JsonValue]


class MachineRun(Contract):
    boardId: str
    startedAt: str | None
    finishedAt: str | None
    status: str | None
    startSourceRef: str | None
    finishSourceRef: str | None
    complete: bool


class EvidenceCandidate(Contract):
    sourceType: Literal["machine_log"]
    sourceRef: str
    timestamp: str | None
    verificationState: Literal["provisional"]
    key: str
    value: JsonValue
    unit: str | dict[str, str] | None
    context: dict[str, JsonValue] | None


class IngestionWarning(Contract):
    code: str
    message: str
    line: int
    relatedLine: int | None = None
    count: int | None = None


class TimeRange(Contract):
    start: str | None
    end: str | None


class IngestionStats(Contract):
    eventCount: int
    recognizedEventCount: int
    unknownEventCount: int
    runCount: int


class IngestionResult(Contract):
    format: Literal["industry_event_log_v1"]
    sourceName: str
    sourceDigest: str
    timezone: str | None
    events: list[MachineEvent]
    runs: list[MachineRun]
    evidenceCandidates: list[EvidenceCandidate]
    warnings: list[IngestionWarning]
    timeRange: TimeRange
    stats: IngestionStats
