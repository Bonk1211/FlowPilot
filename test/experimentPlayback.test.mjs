import test from "node:test";
import assert from "node:assert/strict";
import {
  experimentPlaybackSteps,
  trackSummary,
} from "../apps/web/src/incidents/experimentPlayback.ts";

const copy = {
  title: "Fluid-path restriction",
  mechanism: "A restriction could reduce the quantity reaching the substrate.",
  assumption: "The location and degree are hypothetical.",
};

function run(massAt, coverageAt) {
  return {
    points: Array.from({ length: 13 }, (_, step) => ({
      step,
      position: step / 12,
      relative_mass: massAt(step / 12),
      coverage_fraction: coverageAt(step / 12),
    })),
  };
}

function result(hypothesis, severity, baseline, repetition, response) {
  return {
    condition: {
      hypothesis_id: hypothesis,
      baseline,
      repetition,
      parameters: { severity },
    },
    run: response,
  };
}

function experiment(overrides = {}) {
  const flat = run(
    () => 1,
    () => 0.98,
  );
  const falling = (severity) =>
    run(
      (p) => 1 - 0.65 * severity * p,
      (p) => 0.98 * Math.sqrt(1 - 0.65 * severity * p),
    );
  return {
    status: "completed",
    results: [
      result("restriction", 0.7, true, 0, flat),
      result("restriction", 0.2, false, 1, falling(0.2)),
      result("restriction", 0.8, false, 1, falling(0.8)),
      result("unstable_delivery", 0.7, true, 0, flat),
    ],
    analysis: {
      summary: "Simulated differences were found.",
      effects: [
        {
          hypothesis_id: "restriction",
          factor: "severity",
          low_level: 0.2,
          high_level: 0.8,
          main_effect: -0.2,
        },
      ],
    },
    ...overrides,
  };
}

const components = ["pickup_tube", "feed_tube", "fluid_qd", "nozzle"];

test("steps follow the strongest tested severity and read every number from the saved runs", () => {
  const script = experimentPlaybackSteps(
    experiment(),
    "restriction",
    copy,
    components,
  );
  assert.equal(script.ok, true);
  assert.deepEqual(
    script.steps.map((step) => step.id),
    [
      "baseline",
      "mechanism",
      "position-0",
      "position-3",
      "position-6",
      "position-9",
      "position-12",
      "summary",
    ],
  );
  const last = script.steps.find((step) => step.id === "position-12");
  assert.match(last.narration, /severity 0\.80/);
  assert.match(last.narration, /mass is 0\.48 \(0\.52 below the control condition\)/);
  assert.equal(last.position, 1);
  assert.ok(Math.abs(last.partStates["visible-fluid-core"] - 0.48) < 1e-9);
  const start = script.steps.find((step) => step.id === "position-0");
  assert.match(start.narration, /level with the control condition/);
});

test("the mechanism step highlights its components and frames the camera on the nozzle", () => {
  const script = experimentPlaybackSteps(
    experiment(),
    "restriction",
    copy,
    components,
  );
  const step = script.steps.find((item) => item.id === "mechanism");
  assert.deepEqual(step.highlightIds, components);
  assert.equal(step.camera, "nozzle_closeup");
  assert.equal(step.modelNode, "nozzle");
  const valve = experimentPlaybackSteps(experiment(), "restriction", copy, [
    "bfs_bottle",
    "dj2200_valve",
  ]).steps.find((item) => item.id === "mechanism");
  assert.equal(valve.camera, "valve_closeup");
  const other = experimentPlaybackSteps(experiment(), "restriction", copy, [
    "bfs_bottle",
    "bfs_air",
  ]).steps.find((item) => item.id === "mechanism");
  assert.equal(other.camera, "assembly_overview");
});

test("every step is labelled simulated and the summary never claims a cause", () => {
  const script = experimentPlaybackSteps(
    experiment(),
    "restriction",
    copy,
    components,
  );
  for (const step of script.steps)
    assert.match(step.caution, /not a measurement/);
  const summary = script.steps.at(-1).narration;
  assert.match(summary, /do not confirm a physical cause/);
  assert.match(summary, /raising severity from 0\.2 to 0\.8/);
  for (const step of script.steps)
    for (const value of Object.values(step.partStates))
      assert.ok(value >= 0 && value <= 1);
});

test("an unfinished, incomplete or too-short experiment produces no playback", () => {
  assert.equal(
    experimentPlaybackSteps(
      experiment({ status: "approved" }),
      "restriction",
      copy,
      components,
    ).ok,
    false,
  );
  assert.equal(
    experimentPlaybackSteps(experiment(), "unstable_delivery", copy, components)
      .ok,
    false,
  );
  assert.equal(
    experimentPlaybackSteps(
      experiment({ results: undefined }),
      "restriction",
      copy,
      components,
    ).ok,
    false,
  );
  const short = experiment();
  short.results[2].run = { points: short.results[2].run.points.slice(0, 1) };
  assert.equal(
    experimentPlaybackSteps(short, "restriction", copy, components).ok,
    false,
  );
});

test("the card summary compares the strongest run with its baseline", () => {
  const summary = trackSummary(experiment(), "restriction");
  assert.equal(summary.severity, 0.8);
  assert.ok(Math.abs(summary.mass - 0.48) < 1e-9);
  assert.equal(summary.baselineMass, 1);
  assert.equal(summary.controlSeverity, 0.7);
  assert.equal(summary.mainEffect, -0.2);
  assert.equal(trackSummary(experiment(), "unstable_delivery"), null);
});
