import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  catmullRom,
  explodeAmounts,
  explodeOffsets,
  groupIds,
  fitCameraFov,
  partAnnotations,
  sampleCamera,
  settle,
  smootherstep,
} from "../apps/web/src/scene/shots.ts";
import { experimentShots } from "../apps/web/src/scene/experimentShots.ts";
import { assemblyGuide } from "../apps/web/src/incidents/assemblyGuide.ts";

const close = (a, b, epsilon = 1e-9) =>
  a.every((value, index) => Math.abs(value - b[index]) < epsilon);

const components = {
  restriction: ["pickup_tube", "feed_tube", "fluid_qd", "nozzle"],
  unstable_delivery: ["bfs_bottle", "bfs_air", "pickup_tube", "fluid_qd"],
  material_condition: ["bfs_bottle", "feed_tube", "dj2200_valve", "nozzle"],
};

const bytes = readFileSync(
  new URL(
    "../apps/web/public/models/generic-fluid-dispenser.glb",
    import.meta.url,
  ),
);
const model = JSON.parse(
  bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
);
const descendants = (node) => [
  node,
  ...(node.children ?? []).flatMap((id) => descendants(model.nodes[id])),
];

test("easing starts and settles without a jolt and never overshoots", () => {
  assert.equal(smootherstep(0), 0);
  assert.equal(smootherstep(1), 1);
  assert.equal(smootherstep(-1), 0);
  assert.equal(smootherstep(2), 1);
  let previous = 0;
  for (let step = 1; step <= 100; step += 1) {
    const value = smootherstep(step / 100);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  // Slope near zero at both ends.
  assert.ok(smootherstep(0.01) < 0.0001 && 1 - smootherstep(0.99) < 0.0001);
});

test("the camera spline passes through every keyframe", () => {
  const points = [
    [0, 0, 0],
    [1, 2, 0],
    [3, 2, 1],
    [4, 0, 1],
  ];
  points.forEach((point, index) =>
    assert.ok(close(catmullRom(points, index / (points.length - 1)), point)),
  );
  assert.ok(close(catmullRom([[1, 2, 3]], 0.5), [1, 2, 3]));
});

test("a shot leaves from the current framing and ends on its last keyframe", () => {
  const [shot] = experimentShots("restriction", components.restriction);
  const from = { position: [9, 9, 9], target: [1, 1, 1], fov: 50 };
  const start = sampleCamera(shot, 0, from, false);
  assert.ok(close(start.position, from.position));
  assert.equal(start.fov, 50);
  assert.equal(start.progress, 0);
  const end = sampleCamera(shot, shot.durationMs, from, false);
  assert.ok(close(end.position, shot.position.at(-1)));
  assert.ok(close(end.target, shot.target.at(-1)));
  assert.equal(end.fov, shot.fov[1]);
  // Reduced motion is a clean cut to the final frame at any time.
  const cut = sampleCamera(shot, 0, from, true);
  assert.deepEqual(cut, { ...end, progress: 1 });
});

test("interrupting or reversing a camera move starts at the frame currently shown", () => {
  const shots = experimentShots("restriction", components.restriction);
  let current = sampleCamera(shots[0], shots[0].durationMs, null, false);
  for (const shot of [shots[1], shots[4], shots[0]]) {
    const start = sampleCamera(shot, 0, current, false);
    assert.ok(close(start.position, current.position));
    assert.ok(close(start.target, current.target));
    assert.equal(start.fov, current.fov);
    const next = sampleCamera(shot, 1, current, false);
    assert.ok(close(next.position, current.position, 0.000001));
    assert.ok(close(next.target, current.target, 0.000001));
    const middle = sampleCamera(shot, shot.durationMs * 0.3, current, false);
    assert.ok(!close(middle.position, start.position));
    assert.ok(!close(middle.position, shot.position.at(-1)));
    current = middle;
  }
});

test("parts separate one after another and return when a shot lists none", () => {
  const shots = experimentShots("restriction", components.restriction);
  const apart = shots.find((shot) => shot.id === "apart");
  const early = explodeAmounts(apart, 0.15);
  const done = explodeAmounts(apart, 1);
  const order = apart.explode;
  assert.ok(early[order[0]] > early[order.at(-1)]);
  for (const id of order) assert.equal(done[id], 1);
  assert.deepEqual(explodeAmounts(shots.at(-1), 1), {});
  assert.equal(settle(1, 0, 1), 0);
  assert.equal(settle(0.4, 1, 0), 0.4);
  // The valve is the anchor and never moves.
  assert.deepEqual(explodeOffsets.dj2200_valve, [0, 0, 0]);
});

test("interrupted exploded views ease from each part's current position in either direction", () => {
  const shots = experimentShots("restriction", components.restriction);
  const shot = { ...shots[4], explode: ["fluid_qd", "nozzle"] };
  const from = { fluid_qd: 0.6, nozzle: 1, feed_tube: 0.8 };
  assert.deepEqual(explodeAmounts(shot, 0, from), from);
  const early = explodeAmounts(shot, 0.01, from);
  assert.ok(early.fluid_qd > from.fluid_qd);
  assert.ok(early.fluid_qd - from.fluid_qd < 0.001);
  const middle = explodeAmounts(shot, 0.2, from);
  assert.ok(middle.fluid_qd > from.fluid_qd && middle.fluid_qd < 1);
  assert.ok(middle.feed_tube > 0 && middle.feed_tube < from.feed_tube);
  assert.equal(middle.nozzle, 1);
  assert.deepEqual(explodeAmounts(shot, 1, from), {
    fluid_qd: 1,
    nozzle: 1,
    feed_tube: 0,
  });
  const reassemble = shots.at(-1);
  assert.deepEqual(explodeAmounts(reassemble, 0, middle), middle);
  const returning = explodeAmounts(reassemble, 0.2, middle);
  assert.ok(returning.fluid_qd > 0 && returning.fluid_qd < middle.fluid_qd);
  assert.deepEqual(explodeAmounts(shot, 0, returning), returning);
  assert.ok(
    explodeAmounts(shot, 0.01, returning).fluid_qd > returning.fluid_qd,
  );
  for (const amount of Object.values(explodeAmounts(reassemble, 1, middle)))
    assert.equal(amount, 0);
});

test("each experiment takes apart only its own parts, in the order the liquid meets them", () => {
  for (const [mechanism, ids] of Object.entries(components)) {
    const shots = experimentShots(mechanism, ids);
    assert.deepEqual(
      shots.map((shot) => shot.id),
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
    const apart = shots[2];
    const related = [
      ...ids,
      ...(ids.includes("nozzle") ? ["air_cap", "nozzle_nut"] : []),
      ...(ids.includes("bfs_bottle") ? ["bfs_lid", "bfs_sensors"] : []),
    ];
    for (const id of apart.explode)
      assert.ok(related.includes(id), `${mechanism}: ${id}`);
    assert.ok(!apart.explode.includes("dj2200_valve"));
    for (const id of apart.ghost) assert.ok(!apart.explode.includes(id));
    assert.deepEqual(apart.labels, [
      ...apart.explode.filter(
        (id) => !["bfs_lid", "bfs_sensors", "nozzle_nut"].includes(id),
      ),
      "dj2200_valve",
    ]);
    assert.ok(
      shots[0].explode.length > 0,
      "guide opens on an exploded assembly",
    );
    assert.deepEqual(
      shots[3].explode,
      apart.explode,
      "mechanism keeps relevant parts separated",
    );
    assert.ok(shots[4].explode.includes("valve_air"));
    assert.ok(shots[5].explode.includes("air_cap"));
    assert.ok(shots[5].explode.includes("nozzle"));
    for (const shot of shots) {
      assert.ok(shot.durationMs >= 1000 && shot.durationMs <= 3000);
      assert.ok(shot.position.length >= 1 && shot.target.length >= 1);
      for (const id of [
        ...shot.explode,
        ...shot.ghost,
        ...shot.xray,
        ...shot.labels,
      ])
        assert.ok(groupIds.includes(id), id);
    }
    // Only the restriction marks a (hypothetical) location; only the substrate shot builds the deposit.
    assert.equal(
      shots.filter((shot) => shot.marker === "narrowing").length,
      mechanism === "restriction" ? 1 : 0,
    );
    assert.deepEqual(
      shots.filter((shot) => shot.deposit === "build").map((shot) => shot.id),
      ["substrate"],
    );
  }
  const unstable = experimentShots(
    "unstable_delivery",
    components.unstable_delivery,
  );
  assert.deepEqual(unstable[2].explode, [
    "bfs_air",
    "bfs_bottle",
    "pickup_tube",
    "fluid_qd",
    "bfs_lid",
    "bfs_sensors",
  ]);
});

test("annotations attach to a named mesh in the correct part, at a point on that mesh", () => {
  for (const id of groupIds) {
    const annotation = partAnnotations[id];
    const group = model.nodes.find((node) => node.name === id);
    const anchor = descendants(group).find(
      (node) => node.name === annotation.mesh,
    );
    assert.ok(
      anchor?.mesh !== undefined,
      `${id}: anchor is a mesh within its part`,
    );
    const primitive = model.meshes[anchor.mesh].primitives[0];
    const bounds = model.accessors[primitive.attributes.POSITION];
    annotation.point.forEach((value, axis) => {
      assert.ok(
        value >= bounds.min[axis] - 0.001 && value <= bounds.max[axis] + 0.001,
        `${id}: anchor lies on the mesh bounds`,
      );
    });
  }
  assert.equal(partAnnotations.fluid_qd.text, "Valve fluid QD");
  assert.equal(partAnnotations.coaxial_air.text, "Coaxial atomizing air");
});

test("the reference guide covers the full assembly independently of simulated experiments", () => {
  const { steps } = assemblyGuide();
  assert.deepEqual(
    steps.map((step) => step.id),
    [
      "establish",
      "follow",
      "apart",
      "valve",
      "nozzle",
      "motion",
      "vision",
      "service",
      "assembled",
    ],
  );
  const labeled = new Set(steps.flatMap((step) => step.shot.labels));
  for (const id of [
    "bfs_lid",
    "bfs_sensors",
    "needle_assembly",
    "valve_heater",
    "nozzle_nut",
    "motion_gantry",
    "conveyor",
    "carrier_sensors",
    "laser_height_sensor",
    "lookup_camera",
    "weigh_station",
    "purge_station",
    "waste_bottle",
    "machine_enclosure",
  ])
    assert.ok(labeled.has(id), `${id}: introduced in the assembly guide`);
  assert.ok(steps[0].shot.explode.length > 0);
  assert.deepEqual(steps.at(-1).shot.explode, []);
  for (const step of steps) {
    assert.equal(step.shot.marker, null, `${step.id}: no hypothetical defect`);
    assert.equal(step.position, null, `${step.id}: no experiment result`);
    for (const id of [
      ...step.shot.labels,
      ...step.shot.explode,
      ...step.shot.ghost,
      ...step.shot.xray,
    ])
      assert.ok(groupIds.includes(id), `${step.id}: ${id} is a model group`);
  }
});

test("the model retains documented assembly details and identifies its geometry as illustrative", () => {
  const nodesIn = (id) =>
    descendants(model.nodes.find((node) => node.name === id));
  assert.equal(
    nodesIn("bfs_lid").filter((node) => node.name === "lid-clamping-knob")
      .length,
    3,
  );
  const conveyor = nodesIn("conveyor");
  assert.equal(
    conveyor.filter((node) => node.name === "conveyor-rail").length,
    4,
  );
  assert.equal(
    conveyor.filter((node) => node.name === "conveyor-pulley").length,
    20,
  );
  const needle = nodesIn("needle_assembly");
  for (const name of [
    "needle-shaft",
    "air-piston",
    "return-spring",
    "needle-seat",
  ])
    assert.ok(
      needle.some((node) => node.name === name && node.mesh !== undefined),
      `${name}: physical detail in the needle assembly`,
    );
  const metadata = model.nodes.find(
    (node) => node.name === "generic_fluid_dispenser",
  ).extras;
  assert.match(metadata.geometryStatus, /illustrative.*not manufacturer CAD/i);
  assert.match(metadata.configuration, /BFS.*DJ-2200/);
  assert.ok(metadata.sources.includes("docs/S932_3D_Model_Sources.md"));
});

test("completed camera frames remain fixed beyond the step duration", () => {
  for (const shot of experimentShots("restriction", components.restriction)) {
    const done = sampleCamera(shot, shot.durationMs, null, false);
    assert.deepEqual(
      sampleCamera(shot, shot.durationMs + 12000, null, false),
      done,
    );
  }
});

test("portrait framing preserves horizontal space for the labeled parts", () => {
  assert.ok(Math.abs(fitCameraFov(38, 1.7) - 38) < 1e-9);
  const horizontalSpan = (aspect) =>
    Math.tan((fitCameraFov(38, aspect) * Math.PI) / 360) * aspect;
  assert.ok(fitCameraFov(38, 0.6) > 38);
  assert.ok(Math.abs(horizontalSpan(0.6) - horizontalSpan(0.9)) < 1e-9);
});
