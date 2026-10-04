/**
 * Camera direction for the dispenser model, as plain data and pure maths so it
 * can be tested without a renderer. Coordinates are the model's illustrative
 * units (Y up), taken from scripts/build-dispenser-model.mjs.
 */
export type Vec3 = readonly [number, number, number];

export const groupIds = [
  "bfs_bottle",
  "pickup_tube",
  "bfs_air",
  "feed_tube",
  "fluid_qd",
  "dj2200_valve",
  "valve_air",
  "coaxial_air",
  "air_cap",
  "nozzle",
  "vision_camera",
  "substrate_tray",
  "support_frame",
  "spray_visualization",
] as const;
export type GroupId = (typeof groupIds)[number];

/**
 * Where each part moves when the machine is taken apart, at full separation.
 * The valve is the anchor; the liquid path parts move up and out along the
 * way the liquid travels, the outlet parts move down.
 */
export const explodeOffsets: Record<GroupId, Vec3> = {
  bfs_bottle: [-1.1, 0, 0],
  pickup_tube: [-1.1, 1.55, 0.5],
  bfs_air: [-1.6, 0.35, 0],
  feed_tube: [-0.5, 0.85, 0.35],
  fluid_qd: [-0.55, 0.35, 0.95],
  dj2200_valve: [0, 0, 0],
  valve_air: [0.65, 0.35, 0],
  coaxial_air: [0.75, -0.1, 0.35],
  // The outlet parts come forward, clear of the substrate below them.
  air_cap: [0, -0.15, 1.05],
  nozzle: [0, -0.3, 1.9],
  vision_camera: [0.9, 0, 0],
  substrate_tray: [0, -0.35, 0],
  support_frame: [0, 0, 0],
  spray_visualization: [0, -0.3, 1.9],
};

export type Shot = {
  id: string;
  /** Short name of the camera move, for the step list. */
  name: string;
  durationMs: number;
  /** Keyframes the camera passes through; the target is what it looks at. */
  position: Vec3[];
  target: Vec3[];
  fov: readonly [number, number];
  /** Parts separated in this shot, in the order they move apart. */
  explode: GroupId[];
  /** Parts drawn faint so the subject stands out. */
  ghost: GroupId[];
  /** Parts whose shells turn see-through so the flow inside shows. */
  xray: GroupId[];
  /** Parts named on screen with a leader line. */
  labels: GroupId[];
  /** A marked, hypothetical location where the mechanism could act. */
  marker: "narrowing" | null;
  /** How the deposit on the substrate is shown. */
  deposit: "hidden" | "build" | "full";
};

export type CameraFrame = {
  position: Vec3;
  target: Vec3;
  fov: number;
};

const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));

/** Zero slope at both ends, so a move starts and settles without a jolt. */
export function smootherstep(t: number) {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** A point on a Catmull-Rom spline through `points`, t from 0 to 1. */
export function catmullRom(points: readonly Vec3[], t: number): Vec3 {
  if (points.length === 1) return points[0];
  const span = clamp(t) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(span));
  const local = span - index;
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  const l2 = local * local;
  const l3 = l2 * local;
  return [0, 1, 2].map(
    (axis) =>
      0.5 *
      (2 * p1[axis] +
        (-p0[axis] + p2[axis]) * local +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * l2 +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * l3),
  ) as unknown as Vec3;
}

/**
 * Where the camera is `elapsedMs` into a shot. The camera leaves from wherever
 * it was (`from`), so cutting between shots never jumps; under reduced motion
 * the shot is a clean cut to its final frame.
 */
export function sampleCamera(
  shot: Shot,
  elapsedMs: number,
  from: CameraFrame | null,
  reduced: boolean,
): CameraFrame & { progress: number } {
  const progress = reduced ? 1 : clamp(elapsedMs / shot.durationMs);
  const eased = smootherstep(progress);
  const positions = from ? [from.position, ...shot.position] : shot.position;
  const targets = from ? [from.target, ...shot.target] : shot.target;
  const startFov = from?.fov ?? shot.fov[0];
  // Settle on the first keyframe's framing early, then drift to the last.
  const fov =
    eased < 0.35
      ? lerp(startFov, shot.fov[0], eased / 0.35)
      : lerp(shot.fov[0], shot.fov[1], (eased - 0.35) / 0.65);
  return {
    position: catmullRom(positions, eased),
    target: catmullRom(targets, eased),
    fov,
    progress,
  };
}

/**
 * How far each part has separated: parts leave one after another over the
 * first part of the shot and all return together in a shot that lists none.
 */
export function explodeAmounts(
  shot: Shot,
  progress: number,
): Partial<Record<GroupId, number>> {
  const count = shot.explode.length;
  return Object.fromEntries(
    shot.explode.map((id, order) => {
      const start = count > 1 ? (order / count) * 0.45 : 0;
      return [id, smootherstep((progress - start) / 0.4)];
    }),
  );
}

/** Ease a value from where it was toward where the shot wants it. */
export function settle(from: number, to: number, progress: number) {
  return lerp(from, to, smootherstep(progress / 0.4));
}
