"""Report context: traceable demo measurement rules, never a physical diagnosis."""

from typing import Literal

from fastapi import HTTPException
from pydantic import Field

from flowpilot.ingestion.industry_event_log import parse_industry_event_log
from flowpilot.ingestion.models import IngestionResult, LogPreviewRequest, MachineEvent
from flowpilot.investigations.models import Contract


class LogSignal(Contract):
    question_id: str
    answer: str
    summary: str
    source_refs: list[str]


class LogContextRequest(Contract):
    log: LogPreviewRequest
    board_id: str | None = None


class LogContext(Contract):
    parsed: IngestionResult
    boards: list[str]
    board_id: str | None
    signals: dict[str, LogSignal]


class ObservationChoice(Contract):
    value: str
    source: Literal["technician_input", "machine_log"] = "technician_input"
    observed_value: str | None = None
    reason: str = Field(default="", max_length=500)


class IntakeContext(Contract):
    log: LogPreviewRequest | None = None
    board_id: str | None = None
    log_confirmed: bool = False
    observations: dict[str, ObservationChoice]
    notes: str = Field(default="", max_length=2000)


class IntakeRecord(Contract):
    board_id: str | None = None
    observations: dict[str, ObservationChoice]
    notes: str = ""
    signals: dict[str, LogSignal]


def log_context(request: LogContextRequest) -> LogContext:
    parsed = IngestionResult.model_validate(
        parse_industry_event_log(
            request.log.text,
            source_name=request.log.sourceName,
            timezone_offset=request.log.timezoneOffset,
        )
    )
    # Ambiguous repeated Board IDs are not silently linked to an image.
    runs = [run for run in parsed.runs if run.complete]
    boards = [
        run.boardId for run in runs if sum(r.boardId == run.boardId for r in parsed.runs) == 1
    ]
    board = request.board_id if request.board_id is not None else (boards[-1] if boards else None)
    if board is not None and board not in boards:
        raise HTTPException(422, "Select a complete, unambiguous Board from this log.")
    result = LogContext(parsed=parsed, boards=boards, board_id=board, signals={})
    if board is None or any(w.code == "timestamp_out_of_order" for w in parsed.warnings):
        return result
    selected = next(i for i, run in enumerate(runs) if run.boardId == board)
    window = runs[max(0, selected - 2) : selected + 1]
    events_by_ref = {e.sourceRef: e for e in parsed.events}
    cutoff = events_by_ref[runs[selected].finishSourceRef].lineEnd

    def measurements(kind: str) -> list[MachineEvent]:
        events = []
        for run in window:
            if run.boardId not in boards:
                return []
            start = events_by_ref[run.startSourceRef].lineStart
            end = min(events_by_ref[run.finishSourceRef].lineEnd, cutoff)
            matches = [
                e
                for e in parsed.events
                if e.kind == kind
                and e.fields["boardId"] == run.boardId
                and start <= e.lineStart <= end
            ]
            if len(matches) != 1:
                return []
            events.extend(matches)
        return events

    def signal(key, answer, summary, events):
        result.signals[key] = LogSignal(
            question_id=key,
            answer=answer,
            summary=summary,
            source_refs=[e.sourceRef for e in events],
        )

    weights = measurements("flux_weight_result")
    if weights:
        last = weights[-1].fields
        valid = all(
            e.fields["unit"] == "mg"
            and 0 < e.fields["lower"] <= e.fields["target"] <= e.fields["upper"]
            and e.fields["measured"] >= 0
            for e in weights
        )
        same = all(
            all(e.fields[k] == last[k] for k in ("recipe", "unit", "target", "lower", "upper"))
            for e in weights
        )
        if valid and same:
            passing = last["lower"] <= last["measured"] <= last["upper"]
            signal(
                "intermittent",
                "yes" if passing else "no",
                f"Board {board}: {last['measured']:g} mg; "
                f"reference {last['lower']:g}–{last['upper']:g} mg.",
                [weights[-1]],
            )
            values = [e.fields["measured"] for e in weights]
            if len(values) == 3:
                falling = values[0] > values[1] > values[2] and values[2] <= values[0] * 0.9
                all_pass = all(last["lower"] <= value <= last["upper"] for value in values)
                if falling or all_pass:
                    series = " → ".join(f"{v:g}" for v in values)
                    signal(
                        "continuous",
                        "yes" if falling else "no",
                        f"{series} mg across Boards "
                        f"{', '.join(e.fields['boardId'] for e in weights)}. "
                        + (
                            "Falling at least 10%."
                            if falling
                            else "All within the recorded reference range."
                        ),
                        weights,
                    )
    pressures = measurements("fluid_pressure_result")
    if len(pressures) == 3:
        last = pressures[-1].fields
        if last["setpoint"] > 0 and all(
            e.fields["unit"] == "bar"
            and e.fields["recipe"] == last["recipe"]
            and e.fields["setpoint"] == last["setpoint"]
            and abs(e.fields["actual"] - last["setpoint"]) <= last["setpoint"] * 0.05
            for e in pressures
        ):
            readings = " / ".join(f"{e.fields['actual']:g}" for e in pressures)
            signal(
                "change",
                "no",
                f"{readings} bar; setpoint {last['setpoint']:g} bar. "
                "Within ±5% in this three-board window.",
                pressures,
            )
    return result
