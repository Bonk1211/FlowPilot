import { createHash } from "node:crypto";

const TIMESTAMPED_LINE =
  /^(\d{4}-\d{2}-\d{2}),(\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?),(.*)$/;
const NUMBER = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";

/**
 * Parse the observed headerless, CSV-like industry event log.
 *
 * The interface deliberately returns data rather than writing evidence. The
 * caller can preview warnings and ask for confirmation before committing the
 * returned evidence candidates to a case.
 */
export function parseIndustryEventLog(
  text,
  { sourceName = "machine.log", timezoneOffset = null } = {},
) {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  if (!sourceName || typeof sourceName !== "string") {
    throw new TypeError("sourceName must be a non-empty string");
  }
  if (timezoneOffset !== null && !isTimezoneOffset(timezoneOffset)) {
    throw new TypeError("timezoneOffset must be null or an offset such as +08:00");
  }

  const sourceDigest = createHash("sha256").update(text).digest("hex");
  const warnings = [];
  const drafts = assemblePhysicalLines(text, warnings);
  const events = drafts.map((draft) =>
    parseEvent(draft, { sourceName, sourceDigest, timezoneOffset }),
  );

  if (events.length > 0 && timezoneOffset === null) {
    warnings.push({
      code: "timezone_missing",
      message:
        "The log contains local timestamps without a timezone. No UTC conversion was attempted.",
      line: events[0].lineStart,
    });
  }

  detectOutOfOrderEvents(events, warnings);
  reportUnknownEvents(events, warnings);
  const runs = correlateExplicitRuns(events, warnings);
  const evidenceCandidates = events.flatMap(toEvidenceCandidates);
  const recognizedEventCount = events.filter(
    (event) => event.kind !== "unknown" && event.kind !== "unparsed_line",
  ).length;

  return {
    format: "industry_event_log_v1",
    sourceName,
    sourceDigest,
    timezone: timezoneOffset,
    events,
    runs,
    evidenceCandidates,
    warnings,
    timeRange: getTimeRange(events),
    stats: {
      eventCount: events.length,
      recognizedEventCount,
      unknownEventCount: events.length - recognizedEventCount,
      runCount: runs.length,
    },
  };
}

function reportUnknownEvents(events, warnings) {
  const unknown = events.filter(
    (event) => event.kind === "unknown" || event.kind === "unparsed_line",
  );
  if (unknown.length === 0) return;
  warnings.push({
    code: "unknown_events_retained",
    message: `${unknown.length} event(s) were not recognized and were retained without typed fields.`,
    line: unknown[0].lineStart,
    count: unknown.length,
  });
}

function getTimeRange(events) {
  const timestamps = events
    .map((event) => event.occurredAt)
    .filter((timestamp) => timestamp !== null)
    .sort();
  return timestamps.length === 0
    ? { start: null, end: null }
    : { start: timestamps[0], end: timestamps.at(-1) };
}

function assemblePhysicalLines(text, warnings) {
  const lines = text.split(/\r\n|\n|\r/);
  const drafts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const parseableLine = index === 0 ? rawLine.replace(/^\uFEFF/, "") : rawLine;
    const lineNumber = index + 1;
    if (parseableLine.trim() === "") continue;

    const match = parseableLine.match(TIMESTAMPED_LINE);
    if (match) {
      drafts.push({
        dateText: match[1],
        timeText: match[2],
        payload: match[3].trim(),
        raw: parseableLine,
        lineStart: lineNumber,
        lineEnd: lineNumber,
      });
      continue;
    }

    const previous = drafts.at(-1);
    if (previous) {
      previous.payload += `\n${parseableLine.trim()}`;
      previous.raw += `\n${parseableLine}`;
      previous.lineEnd = lineNumber;
      warnings.push({
        code: "continuation_line",
        message: "A non-timestamped line was retained as part of the preceding event.",
        line: lineNumber,
      });
    } else {
      drafts.push({
        dateText: null,
        timeText: null,
        payload: parseableLine,
        raw: parseableLine,
        lineStart: lineNumber,
        lineEnd: lineNumber,
      });
      warnings.push({
        code: "unparsed_line",
        message: "A line before the first timestamped event could not be classified.",
        line: lineNumber,
      });
    }
  }

  return drafts;
}

function parseEvent(draft, { sourceName, sourceDigest, timezoneOffset }) {
  const localTimestamp =
    draft.dateText && draft.timeText
      ? `${draft.dateText}T${draft.timeText}`
      : null;
  const parsed = classifyPayload(draft.payload);
  const lineRange =
    draft.lineStart === draft.lineEnd
      ? `L${draft.lineStart}`
      : `L${draft.lineStart}-L${draft.lineEnd}`;
  const sourceRef = `${sourceName}#${lineRange}`;
  const id = createHash("sha256")
    .update(`${sourceDigest}:${draft.lineStart}:${draft.lineEnd}`)
    .digest("hex")
    .slice(0, 20);

  return {
    id: `LOG-${id}`,
    kind: draft.dateText === null ? "unparsed_line" : parsed.kind,
    occurredAt: localTimestamp
      ? `${localTimestamp}${timezoneOffset ?? ""}`
      : null,
    localTimestamp,
    lineStart: draft.lineStart,
    lineEnd: draft.lineEnd,
    sourceRef,
    raw: draft.raw,
    payload: draft.payload,
    fields: parsed.fields,
  };
}

function classifyPayload(payload) {
  let match;

  match = payload.match(/^Run Started,\s*Board #([^,:]+):?\s*$/i);
  if (match) return parsed("run_started", { boardId: match[1].trim() });

  match = payload.match(
    /^Run Finished,\s*Board #([^,]+),\s*Status:\s*(.+?)\s*$/i,
  );
  if (match) {
    return parsed("run_finished", {
      boardId: match[1].trim(),
      status: match[2].trim(),
    });
  }

  match = payload.match(
    /^Begin of Timer Between Boards,\s*Conveyor\s+(\d+)\s+Timer Between Boards Started/i,
  );
  if (match) return parsed("timer_between_boards_started", { conveyor: +match[1] });

  match = payload.match(
    new RegExp(
      `^End of Timer Between Boards,\\s*Conveyor\\s+(\\d+)\\s+Timer Between Boards Stopped,\\s*Duration\\s*=\\s*(${NUMBER})\\s*sec\\.?\\s*$`,
      "i",
    ),
  );
  if (match) {
    return parsed("timer_between_boards_stopped", {
      conveyor: +match[1],
      durationSeconds: +match[2],
    });
  }

  if (/^Fiducial Find Begin\s*$/i.test(payload)) {
    return parsed("fiducial_find_started");
  }
  if (/^Fiducial Find End\s*$/i.test(payload)) {
    return parsed("fiducial_find_finished");
  }

  match = payload.match(
    new RegExp(
      `^Fid Found,\\s*jedec:Fid\\s+([^,]+),\\s*(${NUMBER}),\\s*(${NUMBER}),\\s*([^,]+),\\s*Fid Score\\s*=\\s*(${NUMBER})\\s*$`,
      "i",
    ),
  );
  if (match) {
    return parsed("fiducial_found", {
      fiducialId: match[1].trim(),
      x: +match[2],
      y: +match[3],
      positionUnit: match[4].trim().toLowerCase(),
      score: +match[5],
    });
  }

  match = payload.match(
    new RegExp(
      `^Frame Location-Corr Local,\\s*\\(\\s*(${NUMBER})\\s+([^,]+),\\s*(${NUMBER})\\s+([^,]+),\\s*(${NUMBER})\\s+([^\\)]+)\\)\\s*$`,
      "i",
    ),
  );
  if (match) {
    return parsed("frame_location_correction", vectorFields(match));
  }

  match = payload.match(
    new RegExp(
      `^Frame Location-Rel to Base,\\s*\\(\\s*(${NUMBER})\\s+([^,]+),\\s*(${NUMBER})\\s+([^,]+),\\s*(${NUMBER})\\s+([^\\)]+)\\)\\s*$`,
      "i",
    ),
  );
  if (match) {
    return parsed("frame_location_relative_to_base", vectorFields(match));
  }

  if (/^Height Sense Begin\s*$/i.test(payload)) {
    return parsed("height_sense_started");
  }
  if (/^Height Sense End\s*$/i.test(payload)) {
    return parsed("height_sense_finished");
  }

  match = payload.match(
    new RegExp(
      `^Height Sense Results,\\s*Z(${NUMBER})\\s+at\\s+(${NUMBER}),\\s*(${NUMBER})\\s*\\(([^\\)]+)\\)\\s*$`,
      "i",
    ),
  );
  if (match) {
    return parsed("height_sense_result", {
      z: +match[1],
      x: +match[2],
      y: +match[3],
      coordinateContext: match[4].trim(),
    });
  }

  match = payload.match(
    new RegExp(
      `^TIME_BETWEEN_BOARDS Results,\\s*Instruction:\\s*([A-Z0-9_]+)\\s*(<=|>=|==|<|>)\\s*(${NUMBER})\\s*;\\s*Run Time:\\s*([A-Z0-9_]+)\\s*=\\s*(${NUMBER})\\s*$`,
      "is",
    ),
  );
  if (match) {
    return parsed("timer_instruction_result", {
      instructionMetric: match[1],
      operator: match[2],
      thresholdSeconds: +match[3],
      runtimeMetric: match[4],
      runtimeSeconds: +match[5],
    });
  }

  return parsed("unknown");
}

function parsed(kind, fields = {}) {
  return { kind, fields };
}

function vectorFields(match) {
  return {
    x: +match[1],
    xUnit: match[2].trim().toLowerCase(),
    y: +match[3],
    yUnit: match[4].trim().toLowerCase(),
    rotation: +match[5],
    rotationUnit: match[6].trim().toLowerCase(),
  };
}

function detectOutOfOrderEvents(events, warnings) {
  let previous = null;
  for (const event of events) {
    if (!event.localTimestamp) continue;
    if (previous && event.localTimestamp < previous.localTimestamp) {
      warnings.push({
        code: "timestamp_out_of_order",
        message:
          "Event timestamps moved backwards; source order was preserved and no events were reordered.",
        line: event.lineStart,
        relatedLine: previous.lineStart,
      });
    }
    previous = event;
  }
}

function correlateExplicitRuns(events, warnings) {
  const runs = [];
  const openByBoard = new Map();

  for (const event of events) {
    if (event.kind === "run_started") {
      const boardId = event.fields.boardId;
      if (openByBoard.has(boardId)) {
        warnings.push({
          code: "duplicate_run_start",
          message: `Board ${boardId} started again before its previous run finished.`,
          line: event.lineStart,
        });
      }
      const run = {
        boardId,
        startedAt: event.occurredAt,
        finishedAt: null,
        status: null,
        startSourceRef: event.sourceRef,
        finishSourceRef: null,
        complete: false,
      };
      runs.push(run);
      openByBoard.set(boardId, run);
    }

    if (event.kind === "run_finished") {
      const boardId = event.fields.boardId;
      let run = openByBoard.get(boardId);
      if (!run) {
        run = {
          boardId,
          startedAt: null,
          finishedAt: event.occurredAt,
          status: event.fields.status,
          startSourceRef: null,
          finishSourceRef: event.sourceRef,
          complete: false,
        };
        runs.push(run);
        warnings.push({
          code: "run_start_missing",
          message: `Board ${boardId} finished without a matching start in this file.`,
          line: event.lineStart,
        });
      } else {
        run.finishedAt = event.occurredAt;
        run.status = event.fields.status;
        run.finishSourceRef = event.sourceRef;
        run.complete = true;
        openByBoard.delete(boardId);
      }
    }
  }

  for (const run of openByBoard.values()) {
    warnings.push({
      code: "run_finish_missing",
      message: `Board ${run.boardId} started without a matching finish in this file.`,
      line: Number(run.startSourceRef.match(/#L(\d+)/)?.[1] ?? 0),
    });
  }

  return runs;
}

function toEvidenceCandidates(event) {
  const base = {
    sourceType: "machine_log",
    sourceRef: event.sourceRef,
    timestamp: event.occurredAt,
    verificationState: "provisional",
  };

  switch (event.kind) {
    case "run_finished":
      return [
        {
          ...base,
          key: "machine_run_status",
          value: event.fields.status,
          unit: null,
          context: { boardId: event.fields.boardId },
        },
      ];
    case "timer_between_boards_stopped":
      return [
        {
          ...base,
          key: "time_between_boards",
          value: event.fields.durationSeconds,
          unit: "s",
          context: { conveyor: event.fields.conveyor },
        },
      ];
    case "fiducial_found":
      return [
        {
          ...base,
          key: "fiducial_score",
          value: event.fields.score,
          unit: null,
          context: { fiducialId: event.fields.fiducialId },
        },
        {
          ...base,
          key: "fiducial_position",
          value: { x: event.fields.x, y: event.fields.y },
          unit: event.fields.positionUnit,
          context: { fiducialId: event.fields.fiducialId },
        },
      ];
    case "frame_location_correction":
    case "frame_location_relative_to_base":
      return [
        {
          ...base,
          key:
            event.kind === "frame_location_correction"
              ? "frame_location_correction"
              : "frame_location_relative_to_base",
          value: {
            x: event.fields.x,
            y: event.fields.y,
            rotation: event.fields.rotation,
          },
          unit: {
            x: event.fields.xUnit,
            y: event.fields.yUnit,
            rotation: event.fields.rotationUnit,
          },
          context: null,
        },
      ];
    case "height_sense_result":
      return [
        {
          ...base,
          key: "height_sense_result",
          value: {
            z: event.fields.z,
            x: event.fields.x,
            y: event.fields.y,
          },
          unit: event.fields.coordinateContext,
          context: null,
        },
      ];
    default:
      return [];
  }
}

function isTimezoneOffset(value) {
  const match = value.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return false;
  return +match[2] <= 23 && +match[3] <= 59;
}
