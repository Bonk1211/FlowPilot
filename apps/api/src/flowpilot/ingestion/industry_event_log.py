"""Compatibility port of src/ingestion/industryEventLog.mjs.

Keep the adapter's camelCase wire format, hash inputs and warning order stable.
Raw event text follows the reference's newline normalization; the digest hashes
the original UTF-8 text, including BOM and original line endings.
"""

import hashlib
import re

NUMBER = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)"
TIMESTAMPED_LINE = re.compile(r"^(\d{4}-\d{2}-\d{2}),(\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?),(.*)$")


def _match(pattern, text, flags=re.I):
    return re.search(pattern, text, flags)


def _classify(payload):
    match = _match(
        rf"^Flux Weight Results,\s*Board #([^,]+),\s*Recipe = ([^,]+),"
        rf"\s*Measured = ({NUMBER}) ([A-Za-z]+),\s*Target = ({NUMBER}),"
        rf"\s*Lower Limit = ({NUMBER}),\s*Upper Limit = ({NUMBER})$",
        payload,
    )
    if match:
        return "flux_weight_result", {
            "boardId": match[1].strip(),
            "recipe": match[2].strip(),
            "measured": float(match[3]),
            "unit": match[4],
            "target": float(match[5]),
            "lower": float(match[6]),
            "upper": float(match[7]),
        }
    match = _match(
        rf"^Fluid Pressure Results,\s*Board #([^,]+),\s*Recipe = ([^,]+),"
        rf"\s*Setpoint = ({NUMBER}) ([A-Za-z]+),\s*Actual = ({NUMBER})$",
        payload,
    )
    if match:
        return "fluid_pressure_result", {
            "boardId": match[1].strip(),
            "recipe": match[2].strip(),
            "setpoint": float(match[3]),
            "unit": match[4],
            "actual": float(match[5]),
        }
    match = _match(r"^Run Started,\s*Board #([^,:]+):?\s*$", payload)
    if match:
        return "run_started", {"boardId": match[1].strip()}
    match = _match(r"^Run Finished,\s*Board #([^,]+),\s*Status:\s*(.+?)\s*$", payload)
    if match:
        return "run_finished", {"boardId": match[1].strip(), "status": match[2].strip()}
    match = _match(
        r"^Begin of Timer Between Boards,\s*Conveyor\s+(\d+)\s+Timer Between Boards Started",
        payload,
    )
    if match:
        return "timer_between_boards_started", {"conveyor": int(match[1])}
    match = _match(
        rf"^End of Timer Between Boards,\s*Conveyor\s+(\d+)\s+Timer Between Boards Stopped,"
        rf"\s*Duration\s*=\s*({NUMBER})\s*sec\.?\s*$",
        payload,
    )
    if match:
        return "timer_between_boards_stopped", {
            "conveyor": int(match[1]),
            "durationSeconds": float(match[2]),
        }
    for text, kind in (
        ("Fiducial Find Begin", "fiducial_find_started"),
        ("Fiducial Find End", "fiducial_find_finished"),
        ("Height Sense Begin", "height_sense_started"),
        ("Height Sense End", "height_sense_finished"),
    ):
        if _match(rf"^{text}\s*$", payload):
            return kind, {}
    match = _match(
        rf"^Fid Found,\s*jedec:Fid\s+([^,]+),\s*({NUMBER}),\s*({NUMBER}),"
        rf"\s*([^,]+),\s*Fid Score\s*=\s*({NUMBER})\s*$",
        payload,
    )
    if match:
        return "fiducial_found", {
            "fiducialId": match[1].strip(),
            "x": float(match[2]),
            "y": float(match[3]),
            "positionUnit": match[4].strip().lower(),
            "score": float(match[5]),
        }
    for prefix, kind in (
        ("Frame Location-Corr Local", "frame_location_correction"),
        ("Frame Location-Rel to Base", "frame_location_relative_to_base"),
    ):
        match = _match(
            rf"^{prefix},\s*\(\s*({NUMBER})\s+([^,]+),\s*({NUMBER})\s+([^,]+),"
            rf"\s*({NUMBER})\s+([^\)]+)\)\s*$",
            payload,
        )
        if match:
            return kind, {
                "x": float(match[1]),
                "xUnit": match[2].strip().lower(),
                "y": float(match[3]),
                "yUnit": match[4].strip().lower(),
                "rotation": float(match[5]),
                "rotationUnit": match[6].strip().lower(),
            }
    match = _match(
        rf"^Height Sense Results,\s*Z({NUMBER})\s+at\s+({NUMBER}),\s*({NUMBER})"
        rf"\s*\(([^\)]+)\)\s*$",
        payload,
    )
    if match:
        return "height_sense_result", {
            "z": float(match[1]),
            "x": float(match[2]),
            "y": float(match[3]),
            "coordinateContext": match[4].strip(),
        }
    match = _match(
        rf"^TIME_BETWEEN_BOARDS Results,\s*Instruction:\s*([A-Z0-9_]+)\s*(<=|>=|==|<|>)"
        rf"\s*({NUMBER})\s*;\s*Run Time:\s*([A-Z0-9_]+)\s*=\s*({NUMBER})\s*$",
        payload,
        re.I | re.S,
    )
    if match:
        return "timer_instruction_result", {
            "instructionMetric": match[1],
            "operator": match[2],
            "thresholdSeconds": float(match[3]),
            "runtimeMetric": match[4],
            "runtimeSeconds": float(match[5]),
        }
    return "unknown", {}


def _assemble(text, warnings):
    drafts = []
    for index, raw in enumerate(re.split(r"\r\n|\n|\r", text)):
        line = raw.removeprefix("\ufeff") if index == 0 else raw
        number = index + 1
        if not line.strip():
            continue
        match = TIMESTAMPED_LINE.match(line)
        if match:
            drafts.append(
                {
                    "dateText": match[1],
                    "timeText": match[2],
                    "payload": match[3].strip(),
                    "raw": line,
                    "lineStart": number,
                    "lineEnd": number,
                }
            )
        elif drafts:
            drafts[-1]["payload"] += "\n" + line.strip()
            drafts[-1]["raw"] += "\n" + line
            drafts[-1]["lineEnd"] = number
            warnings.append(
                {
                    "code": "continuation_line",
                    "line": number,
                    "message": (
                        "A non-timestamped line was retained as part of the preceding event."
                    ),
                }
            )
        else:
            drafts.append(
                {
                    "dateText": None,
                    "timeText": None,
                    "payload": line,
                    "raw": line,
                    "lineStart": number,
                    "lineEnd": number,
                }
            )
            warnings.append(
                {
                    "code": "unparsed_line",
                    "line": number,
                    "message": "A line before the first timestamped event could not be classified.",
                }
            )
    return drafts


def _event(draft, source_name, digest, offset):
    local = f"{draft['dateText']}T{draft['timeText']}" if draft["dateText"] else None
    kind, fields = _classify(draft["payload"])
    start, end = draft["lineStart"], draft["lineEnd"]
    line_range = f"L{start}" if start == end else f"L{start}-L{end}"
    event_id = hashlib.sha256(f"{digest}:{start}:{end}".encode()).hexdigest()[:20]
    return {
        "id": f"LOG-{event_id}",
        "kind": kind if draft["dateText"] else "unparsed_line",
        "occurredAt": f"{local}{offset or ''}" if local else None,
        "localTimestamp": local,
        "lineStart": start,
        "lineEnd": end,
        "sourceRef": f"{source_name}#{line_range}",
        "raw": draft["raw"],
        "payload": draft["payload"],
        "fields": fields,
    }


def _runs(events, warnings):
    runs, open_by_board = [], {}
    for event in events:
        if event["kind"] not in ("run_started", "run_finished"):
            continue
        board = event["fields"]["boardId"]
        if event["kind"] == "run_started":
            if board in open_by_board:
                warnings.append(
                    {
                        "code": "duplicate_run_start",
                        "line": event["lineStart"],
                        "message": f"Board {board} started again before its previous run finished.",
                    }
                )
            run = {
                "boardId": board,
                "startedAt": event["occurredAt"],
                "finishedAt": None,
                "status": None,
                "startSourceRef": event["sourceRef"],
                "finishSourceRef": None,
                "complete": False,
            }
            runs.append(run)
            open_by_board[board] = run
        else:
            run = open_by_board.pop(board, None)
            if run is None:
                run = {"boardId": board, "startedAt": None, "startSourceRef": None}
                runs.append(run)
                warnings.append(
                    {
                        "code": "run_start_missing",
                        "line": event["lineStart"],
                        "message": f"Board {board} finished without a matching start in this file.",
                    }
                )
            run.update(
                {
                    "finishedAt": event["occurredAt"],
                    "status": event["fields"]["status"],
                    "finishSourceRef": event["sourceRef"],
                    "complete": run["startedAt"] is not None,
                }
            )
    for board, run in open_by_board.items():
        warnings.append(
            {
                "code": "run_finish_missing",
                "message": f"Board {board} started without a matching finish in this file.",
                "line": int(re.search(r"#L(\d+)", run["startSourceRef"])[1]),
            }
        )
    return runs


def _evidence(event):
    base = {
        "sourceType": "machine_log",
        "sourceRef": event["sourceRef"],
        "timestamp": event["occurredAt"],
        "verificationState": "provisional",
    }
    kind, fields = event["kind"], event["fields"]

    def fact(key, value, unit=None, context=None):
        return {**base, "key": key, "value": value, "unit": unit, "context": context}

    if kind in ("flux_weight_result", "fluid_pressure_result"):
        return [fact(kind, fields, fields["unit"], {"boardId": fields["boardId"]})]
    if kind == "run_finished":
        return [
            fact("machine_run_status", fields["status"], context={"boardId": fields["boardId"]})
        ]
    if kind == "timer_between_boards_stopped":
        return [
            fact(
                "time_between_boards",
                fields["durationSeconds"],
                "s",
                {"conveyor": fields["conveyor"]},
            )
        ]
    if kind == "fiducial_found":
        context = {"fiducialId": fields["fiducialId"]}
        return [
            fact("fiducial_score", fields["score"], context=context),
            fact(
                "fiducial_position",
                {"x": fields["x"], "y": fields["y"]},
                fields["positionUnit"],
                context,
            ),
        ]
    if kind in ("frame_location_correction", "frame_location_relative_to_base"):
        return [
            fact(
                kind,
                {key: fields[key] for key in ("x", "y", "rotation")},
                {key: fields[key + "Unit"] for key in ("x", "y", "rotation")},
            )
        ]
    if kind == "height_sense_result":
        return [
            fact(kind, {key: fields[key] for key in ("z", "x", "y")}, fields["coordinateContext"])
        ]
    return []


def parse_industry_event_log(text, *, source_name="machine.log", timezone_offset=None):
    if not isinstance(text, str):
        raise TypeError("text must be a string")
    if not isinstance(source_name, str) or not source_name:
        raise TypeError("sourceName must be a non-empty string")
    if timezone_offset is not None and (
        not isinstance(timezone_offset, str)
        or not re.fullmatch(r"[+-](?:[01][0-9]|2[0-3]):[0-5][0-9]", timezone_offset)
    ):
        raise TypeError("timezoneOffset must be null or an offset such as +08:00")
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    warnings = []
    events = [
        _event(draft, source_name, digest, timezone_offset) for draft in _assemble(text, warnings)
    ]
    if events and timezone_offset is None:
        warnings.append(
            {
                "code": "timezone_missing",
                "line": events[0]["lineStart"],
                "message": "The log contains local timestamps without a timezone. "
                "No UTC conversion was attempted.",
            }
        )
    previous = None
    for event in events:
        if not event["localTimestamp"]:
            continue
        if previous and event["localTimestamp"] < previous["localTimestamp"]:
            warnings.append(
                {
                    "code": "timestamp_out_of_order",
                    "line": event["lineStart"],
                    "relatedLine": previous["lineStart"],
                    "message": "Event timestamps moved backwards; source order was preserved "
                    "and no events were reordered.",
                }
            )
        previous = event
    unknown = [event for event in events if event["kind"] in ("unknown", "unparsed_line")]
    if unknown:
        warnings.append(
            {
                "code": "unknown_events_retained",
                "line": unknown[0]["lineStart"],
                "count": len(unknown),
                "message": f"{len(unknown)} event(s) were not recognized "
                "and were retained without typed fields.",
            }
        )
    runs = _runs(events, warnings)
    times = sorted(event["occurredAt"] for event in events if event["occurredAt"] is not None)
    return {
        "format": "industry_event_log_v1",
        "sourceName": source_name,
        "sourceDigest": digest,
        "timezone": timezone_offset,
        "events": events,
        "runs": runs,
        "evidenceCandidates": [fact for event in events for fact in _evidence(event)],
        "warnings": warnings,
        "timeRange": {"start": times[0] if times else None, "end": times[-1] if times else None},
        "stats": {
            "eventCount": len(events),
            "recognizedEventCount": len(events) - len(unknown),
            "unknownEventCount": len(unknown),
            "runCount": len(runs),
        },
    }
