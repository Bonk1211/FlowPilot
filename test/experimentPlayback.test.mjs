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

function run(massAt, coverageAt, channelsAt) {
  return {
    points: Array.from({ length: 13 }, (_, step) => ({
      step,
      position: step / 12,
      relative_mass: massAt(step / 12),
      coverage_fraction: coverageAt(step / 12),
      ...(channelsAt ? channelsAt(step / 12) : {}),
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

function experiment(overrides = {}, channels = true) {
  const flat = run(
    () => 1,
    () => 0.98,
  );
  const falling = (severity) =>
    run(
      (p) => 1 - 0.65 * severity * p,
      (p) => 0.98 * Math.sqrt(1 - 0.65 * severity * p),
      channels
        ? (p) => ({
            supply_pressure: 1,
            feed_flow: 1 - 0.65 * severity * p,
            path_open: 1 - 0.65 * severity * p,
            flow_resistance: 1,
            valve_duty: 1,
            spray_width: 0.98 * Math.sqrt(1 - 0.65 * severity * p),
          })
        : undefined,
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

test("eight directed shots read every number from the saved runs", () => {
  const script = experimentPlaybackSteps(
    experiment(),
    "restriction",
    copy,
    components,
    "Mass falls in a straight line.",
  );
  assert.equal(script.ok, true);
  assert.deepEqual(
    script.steps.map((step) => step.id),
    [
      "establish",
      "follow",
      "apart",
      "mechanism",
      "valve",
      "nozzle",
      "substrate",
      "readout",
    ],
  );
  for (const step of script.steps) assert.equal(step.shot.id, step.id);
  // The opening shots show the start of the sequence, before the effect builds.
  for (const id of ["establish", "follow", "apart"]) {
    const step = script.steps.find((item) => item.id === id);
    assert.equal(step.condition, "start");
    assert.equal(step.fluid.length, 1);
    assert.equal(step.fluid[0].position, 0);
  }
  const close = script.steps.find((step) => step.id === "mechanism");
  assert.equal(close.condition, "tested");
  assert.match(close.narration, /severity 0\.80/);
  assert.match(close.narration, /open path to 0\.48/);
  assert.match(close.narration, /location is hypothetical/);
  const nozzle = script.steps.find((step) => step.id === "nozzle");
  assert.match(nozzle.narration, /0\.68 against 0\.98/);
  // The substrate shot sweeps every sequence position and the marker follows it.
  const substrate = script.steps.find((step) => step.id === "substrate");
  assert.equal(substrate.fluid.length, 13);
  assert.equal(substrate.position, 1);
  assert.match(substrate.narration, /from 0\.98 to 0\.68/);
  assert.match(substrate.narration, /fade steadily/);
  assert.ok(Math.abs(substrate.partStates["visible-fluid-core"] - 0.48) < 1e-9);
  const readout = script.steps.at(-1);
  assert.match(readout.narration, /^Predicted before the run: Mass falls/);
  assert.match(readout.narration, /mass ends at 0\.48 against 1\.00/);
});

test("runs saved before the illustrative channels fall back to mass and coverage", () => {
  const script = experimentPlaybackSteps(
    experiment({}, false),
    "restriction",
    copy,
    components,
  );
  const end = script.steps.find((step) => step.id === "valve").fluid[0];
  assert.ok(Math.abs(end.feedFlow - 0.48) < 1e-9);
  assert.equal(end.channels, false);
  assert.ok(Math.abs(end.sprayWidth - end.coverage) < 1e-12);
  // No channel that was never simulated is quoted.
  const close = script.steps.find((step) => step.id === "mechanism");
  assert.doesNotMatch(close.narration, /open path/);
  assert.match(
    close.narration,
    /saved before the model's illustrative channels/,
  );
});

test("the teardown names this explanation's parts and the narration never claims a cause", () => {
  const script = experimentPlaybackSteps(
    experiment(),
    "restriction",
    copy,
    components,
  );
  const apart = script.steps.find((step) => step.id === "apart");
  assert.match(
    apart.narration,
    /the pickup tube, the feed tube, the quick disconnect, the nozzle and the air cap/,
  );
  for (const step of script.steps) {
    assert.match(step.caution, /not a measurement/);
    assert.doesNotMatch(
      step.narration,
      /most likely|confirmed cause|root cause is/i,
    );
    for (const value of Object.values(step.partStates))
      assert.ok(value >= 0 && value <= 1);
  }
  assert.match(
    script.steps.at(-1).narration,
    /do not confirm a physical cause/,
  );
  assert.match(
    script.steps.at(-1).narration,
    /Raising severity from 0\.2 to 0\.8/,
  );
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
