import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseIndustryEventLog } from "../src/ingestion/industryEventLog.mjs";

const SAMPLE = [
  "2026-09-13,01:13:30.268,Run Started,Board #78:",
  "2026-09-13,01:13:30.268,Begin of Timer Between Boards,Conveyor 1 Timer Between Boards Started...",
  "2026-09-13,01:15:34.934,Run Finished,Board #78, Status: PASS",
  "2026-09-13,01:15:34.095,End of Timer Between Boards,Conveyor 1 Timer Between Boards Stopped, Duration = 123.493 sec.",
  "2026-09-13,01:15:35.398,Fid Found,jedec:Fid 1,13.516,9.390,inch,Fid Score = 74",
  "2026-09-13,01:15:35.451,Frame Location-Corr Local,( 0.012 inch,-0.014 inch,-0.01 deg)",
  "2026-09-13,01:15:35.451,Frame Location-Rel to Base,(13.508 inch, 9.411 inch,0.20 deg)",
  "2026-09-13,01:15:35.920,Height Sense Results,Z-1.2626 at -5.1900,-2.0165 (inch rel to Wkpc)",
  "2026-09-13,01:15:35.921,TIME_BETWEEN_BOARDS Results,Instruction: TIME_BETWEEN_BOARDS_LANE1 <= 120.000; Run Time:",
  "TIME_BETWEEN_BOARDS_LANE1 = 123.493",
  "2026-09-13,01:16:20.085,Run Started,Board #79:",
].join("\r\n");

test("parses the first two commas as the timestamp envelope", () => {
  const result = parseIndustryEventLog(SAMPLE, {
    sourceName: "industry-sample.log",
    timezoneOffset: "+08:00",
  });

  assert.equal(result.events[0].kind, "run_started");
  assert.equal(result.events[0].fields.boardId, "78");
  assert.equal(result.events[0].payload, "Run Started,Board #78:");
  assert.equal(result.events[0].occurredAt, "2026-09-13T01:13:30.268+08:00");
  assert.equal(result.stats.eventCount, 10);
  assert.equal(result.stats.recognizedEventCount, 10);
  assert.deepEqual(result.timeRange, {
    start: "2026-09-13T01:13:30.268+08:00",
    end: "2026-09-13T01:16:20.085+08:00",
  });
});

test("extracts typed values without losing raw provenance", () => {
  const result = parseIndustryEventLog(SAMPLE, {
    sourceName: "industry-sample.log",
    timezoneOffset: "+08:00",
  });
  const timer = result.events.find(
    (event) => event.kind === "timer_between_boards_stopped",
  );
  const fiducial = result.events.find((event) => event.kind === "fiducial_found");
  const height = result.events.find(
    (event) => event.kind === "height_sense_result",
  );

  assert.deepEqual(timer.fields, { conveyor: 1, durationSeconds: 123.493 });
  assert.equal(fiducial.fields.score, 74);
  assert.equal(fiducial.fields.positionUnit, "inch");
  assert.equal(height.fields.z, -1.2626);
  assert.equal(height.fields.coordinateContext, "inch rel to Wkpc");
  assert.match(timer.sourceRef, /#L4$/);
  assert.match(timer.raw, /Duration = 123\.493 sec\./);
});

test("retains wrapped instruction output as one event", () => {
  const result = parseIndustryEventLog(SAMPLE, {
    timezoneOffset: "+08:00",
  });
  const instruction = result.events.find(
    (event) => event.kind === "timer_instruction_result",
  );

  assert.deepEqual(instruction.fields, {
    instructionMetric: "TIME_BETWEEN_BOARDS_LANE1",
    operator: "<=",
    thresholdSeconds: 120,
    runtimeMetric: "TIME_BETWEEN_BOARDS_LANE1",
    runtimeSeconds: 123.493,
  });
  assert.equal(instruction.lineStart, 9);
  assert.equal(instruction.lineEnd, 10);
  assert.ok(result.warnings.some((warning) => warning.code === "continuation_line"));
});

test("preserves source order and warns when timestamps move backwards", () => {
  const result = parseIndustryEventLog(SAMPLE, {
    timezoneOffset: "+08:00",
  });

  assert.equal(result.events[2].kind, "run_finished");
  assert.equal(result.events[3].kind, "timer_between_boards_stopped");
  assert.ok(
    result.warnings.some(
      (warning) => warning.code === "timestamp_out_of_order" && warning.line === 4,
    ),
  );
});

test("correlates only explicit board identifiers", () => {
  const result = parseIndustryEventLog(SAMPLE, {
    timezoneOffset: "+08:00",
  });

  assert.deepEqual(result.runs[0], {
    boardId: "78",
    startedAt: "2026-09-13T01:13:30.268+08:00",
    finishedAt: "2026-09-13T01:15:34.934+08:00",
    status: "PASS",
    startSourceRef: "machine.log#L1",
    finishSourceRef: "machine.log#L3",
    complete: true,
  });
  assert.equal(result.runs[1].boardId, "79");
  assert.equal(result.runs[1].complete, false);
  assert.ok(result.warnings.some((warning) => warning.code === "run_finish_missing"));
});

test("keeps unknown events and missing timezone visible", () => {
  const result = parseIndustryEventLog(
    "2026-09-13,01:00:00.000,Vendor-specific message,with,commas",
  );

  assert.equal(result.events[0].kind, "unknown");
  assert.equal(result.events[0].payload, "Vendor-specific message,with,commas");
  assert.equal(result.events[0].occurredAt, "2026-09-13T01:00:00.000");
  assert.ok(result.warnings.some((warning) => warning.code === "timezone_missing"));
  assert.ok(
    result.warnings.some(
      (warning) =>
        warning.code === "unknown_events_retained" && warning.count === 1,
    ),
  );
});

test("creates only direct provisional evidence candidates", () => {
  const result = parseIndustryEventLog(SAMPLE, {
    timezoneOffset: "+08:00",
  });
  const keys = result.evidenceCandidates.map((candidate) => candidate.key);

  assert.ok(keys.includes("machine_run_status"));
  assert.ok(keys.includes("time_between_boards"));
  assert.ok(keys.includes("fiducial_score"));
  assert.ok(keys.includes("height_sense_result"));
  assert.ok(!keys.includes("dot_diameter"));
  assert.ok(
    result.evidenceCandidates.every(
      (candidate) => candidate.verificationState === "provisional",
    ),
  );
});

test("parses the reconstructed demo fixture with full recognition", () => {
  const fixture = readFileSync(
    new URL("../fixtures/demo-industry-machine.log", import.meta.url),
    "utf8",
  );
  const result = parseIndustryEventLog(fixture, {
    sourceName: "demo-industry-machine.log",
    timezoneOffset: "+08:00",
  });

  assert.equal(result.stats.eventCount, 15);
  assert.equal(result.stats.recognizedEventCount, 15);
  assert.equal(result.stats.unknownEventCount, 0);
  assert.ok(result.warnings.some((warning) => warning.code === "timestamp_out_of_order"));
});

test("accepts a UTF-8 byte-order mark on the first line", () => {
  const result = parseIndustryEventLog(
    "\uFEFF2026-09-13,01:00:00.000,Run Started,Board #1:",
    { timezoneOffset: "+08:00" },
  );

  assert.equal(result.events[0].kind, "run_started");
  assert.equal(result.events[0].fields.boardId, "1");
});
