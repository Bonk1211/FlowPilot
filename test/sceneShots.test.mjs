import test from "node:test";
import assert from "node:assert/strict";
import {
  catmullRom,
  explodeAmounts,
  explodeOffsets,
  groupIds,
  sampleCamera,
  settle,
  smootherstep,
} from "../apps/web/src/scene/shots.ts";
import { experimentShots } from "../apps/web/src/scene/experimentShots.ts";

const close = (a, b, epsilon = 1e-9) =>
  a.every((value, index) => Math.abs(value - b[index]) < epsilon);

const components = {
  restriction: ["pickup_tube", "feed_tube", "fluid_qd", "nozzle"],
  unstable_delivery: ["bfs_bottle", "bfs_air", "pickup_tube", "fluid_qd"],
  material_condition: ["bfs_bottle", "feed_tube", "dj2200_valve", "nozzle"],
};

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

test("parts separate one after another and return when a shot lists none", () => {
  const shots = experimentShots("restriction", components.restriction);
  const apart = shots.find((shot) => shot.id === "apart");
  const early = explodeAmounts(apart, 0.15);
  const done = explodeAmounts(apart, 1);
  const order = apart.explode;
  assert.ok(early[order[0]] > early[order.at(-1)]);
  for (const id of order) assert.equal(done[id], 1);
  assert.deepEqual(explodeAmounts(shots[3], 1), {});
  assert.equal(settle(1, 0, 1), 0);
  assert.equal(settle(0.4, 1, 0), 0.4);
  // The valve is the anchor and never moves.
  assert.deepEqual(explodeOffsets.dj2200_valve, [0, 0, 0]);
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
    for (const id of apart.explode)
      assert.ok(ids.includes(id) || id === "air_cap", `${mechanism}: ${id}`);
    assert.ok(!apart.explode.includes("dj2200_valve"));
    for (const id of apart.ghost) assert.ok(!apart.explode.includes(id));
    assert.deepEqual(apart.labels, apart.explode);
    for (const shot of shots) {
      assert.ok(shot.durationMs >= 6000);
      assert.ok(shot.position.length >= 2 && shot.target.length >= 2);
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
  ]);
});
